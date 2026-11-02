// End-to-End-Test im Browser gegen ein lokales Supabase (siehe README, Abschnitt "Tests").
// Aufruf: node scripts/e2e-web.js <web-export-ordner> <screenshot-ordner>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const ROOT = process.argv[2], OUT = process.argv[3];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = fs.existsSync(p + '.html') ? p + '.html' : path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' });
  fs.createReadStream(p).pipe(res);
}).listen(8766);
const MAIL = 'http://127.0.0.1:54324/api/v1';
const sql = (q) => execSync(`docker exec -i supabase_db_salon-bonus psql -U postgres -tA`, { input: q }).toString().trim();

async function latestCode(email) {
  for (let i = 0; i < 30; i++) {
    const r = await (await fetch(`${MAIL}/search?query=to:${encodeURIComponent(email)}`)).json();
    if (r.messages?.length) {
      const m = await (await fetch(`${MAIL}/message/${r.messages[0].ID}`)).json();
      const code = (m.Text || '').match(/\b(\d{6})\b/);
      if (code) return code[1];
      console.log('mail without code:', m.Text?.slice(0, 300));
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('no code for ' + email);
}
async function login(page, email, first, shotPrefix) {
  await page.goto('http://localhost:8766/');
  await page.getByPlaceholder('name@beispiel.de').fill(email);
  await page.getByText('Code anfordern').click();
  const code = await latestCode(email);
  await page.getByPlaceholder('123456').waitFor();
  if (shotPrefix) await page.screenshot({ path: `${OUT}/${shotPrefix}-code.png` });
  await page.getByPlaceholder('123456').fill(code);
  await page.getByText('Anmelden', { exact: true }).click();
  await page.getByText('Wie heißt du?').waitFor({ timeout: 15000 });
  if (shotPrefix) await page.screenshot({ path: `${OUT}/${shotPrefix}-name.png` });
  await page.locator('input').first().fill(first);
  await page.getByText('Weiter').click();
}
(async () => {
  const b = await chromium.launch();
  const errs = [];
  const mk = async () => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 } });
    const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('console', m => m.type() === 'error' && errs.push(m.text()));
    return p;
  };

  // 1) Kunde registriert sich
  const cust = await mk();
  await cust.goto('http://localhost:8766/');
  await cust.getByText('Code anfordern').waitFor({ timeout: 20000 });
  await cust.screenshot({ path: `${OUT}/1-login.png` });
  await login(cust, 'max@test.de', 'Max', '2');
  await cust.getByText('Hallo Max!').waitFor({ timeout: 15000 });
  await cust.waitForTimeout(1000);
  await cust.screenshot({ path: `${OUT}/3-home-leer.png`, fullPage: true });

  // 2) Admin anlegen
  const adm = await mk();
  await login(adm, 'chef@test.de', 'Chef');
  await adm.getByText('Hallo Chef!').waitFor({ timeout: 15000 });
  sql(`update public.profiles set role='admin' where email='chef@test.de';`);
  await adm.reload();
  await adm.waitForTimeout(3000);
  await adm.screenshot({ path: `${OUT}/4-admin-scanner.png` });

  // 3) Scan simulieren: Kamera gibt es headless nicht, also 5 alte Besuche + heutigen Scan per RPC des Admins
  const token = sql(`select qr_token from public.profiles where email='max@test.de';`);
  const custId = sql(`select id from public.profiles where email='max@test.de';`);
  sql(`insert into public.visits(customer_id, visit_date) select '${custId}', current_date - g from generate_series(1,5) g;`);
  const result = await adm.evaluate(async (token) => {
    const key = Object.keys(localStorage).find(k => k.includes('auth-token'));
    const at = JSON.parse(localStorage.getItem(key)).access_token;
    const r = await fetch('http://127.0.0.1:54321/rest/v1/rpc/record_visit', {
      method: 'POST',
      headers: { apikey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH', Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_qr_token: token }),
    });
    return r.json();
  }, token).catch(e => ({ evalError: String(e) }));
  console.log('record_visit:', JSON.stringify(result));
  await adm.goto('http://localhost:8766/admin/result?data=' + encodeURIComponent(JSON.stringify(result)));
  await adm.getByText('Stempel 6 von 12').waitFor({ timeout: 15000 });
  await adm.screenshot({ path: `${OUT}/5-admin-ergebnis.png`, fullPage: true });
  await adm.getByText('Jetzt einlösen').click();
  await adm.getByText('Eingelöst').waitFor({ timeout: 10000 });
  await adm.screenshot({ path: `${OUT}/6-admin-eingeloest.png`, fullPage: true });

  // 4) Kunde sieht neuen Stand nach automatischer Aktualisierung
  await cust.waitForTimeout(11000);
  await cust.screenshot({ path: `${OUT}/7-home-6-stempel.png`, fullPage: true });

  // 5) Sicherheit: Kunde darf nicht scannen
  const denied = await cust.evaluate(async (token) => {
    const key = Object.keys(localStorage).find(k => k.includes('auth-token'));
    const at = JSON.parse(localStorage.getItem(key)).access_token;
    const r = await fetch('http://127.0.0.1:54321/rest/v1/rpc/record_visit', {
      method: 'POST',
      headers: { apikey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH', Authorization: `Bearer ${at}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_qr_token: token }),
    });
    return r.status + ' ' + (await r.text());
  }, token);
  console.log('customer record_visit:', denied);
  console.log('rewards:', sql(`select type||':'||status from public.rewards;`));
  console.log('errors:', JSON.stringify(errs));
  server.close(); await b.close();
})().catch(async e => { console.error(e); process.exit(1); });
