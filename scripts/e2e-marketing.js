// End-to-End-Test Phase 4 gegen ein lokales Supabase (siehe README, Abschnitt "Tests"):
// Bewertungsanfrage in der App (gut → Google-Hinweis, schlecht → nur intern),
// Rückhol-Gutschein nach 6 Wochen, Push-Aktion aus dem Dashboard, Bewertungsseite.
// Push-Nachrichten gehen dabei an einen lokalen Test-Server statt an Expo.
// Aufruf: node scripts/e2e-marketing.js <app-web-export> <dashboard-out> <screenshot-ordner>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { execSync } = require('child_process');

const [APP_ROOT, DASH_ROOT, OUT] = process.argv.slice(2);
const API = 'http://127.0.0.1:54321';
const SECRET = execSync('npx -y supabase@3.0.0 status -o json 2>/dev/null').toString().match(/"SECRET_KEY":\s*"([^"]+)"/)[1];
const MAIL = 'http://127.0.0.1:54324/api/v1';
const sql = (q) => execSync('docker exec -i supabase_db_salon-bonus psql -U postgres -tA -v ON_ERROR_STOP=1', { input: q }).toString().trim();
const GATEWAY = execSync("docker network inspect supabase_network_salon-bonus -f '{{range .IPAM.Config}}{{.Gateway}}{{end}}'").toString().trim();

const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf', '.txt': 'text/plain' };
function serve(root, port, spaFallback) {
  return http.createServer((req, res) => {
    let p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
    if (!fs.existsSync(p)) p = fs.existsSync(p + '.html') ? p + '.html' : spaFallback ? path.join(root, 'index.html') : null;
    if (!p) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'credentialless' });
    fs.createReadStream(p).pipe(res);
  }).listen(port);
}

// Nachgebauter Expo Push Service
const pushed = [];
const pushServer = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    const msgs = JSON.parse(b);
    pushed.push(...msgs);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: msgs.map(() => ({ status: 'ok', id: 'test' })) }));
  });
}).listen(8799, '0.0.0.0');

async function createUser(email, first, role) {
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!r.ok) throw new Error('createUser ' + (await r.text()));
  sql(`update public.profiles set first_name='${first}', role='${role}' where email='${email}';`);
  return sql(`select id from public.profiles where email='${email}';`);
}

async function latestCode(email) {
  for (let i = 0; i < 30; i++) {
    const r = await (await fetch(`${MAIL}/search?query=to:${encodeURIComponent(email)}`)).json();
    if (r.messages?.length) {
      const m = await (await fetch(`${MAIL}/message/${r.messages[0].ID}`)).json();
      const code = (m.Text || '').match(/\b(\d{6})\b/);
      if (code) return code[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('no code for ' + email);
}

async function appLogin(page, email) {
  await page.goto('http://localhost:8766/');
  await page.getByPlaceholder('name@beispiel.de').fill(email);
  await page.getByText('Code anfordern').click();
  const code = await latestCode(email);
  await page.getByPlaceholder('123456').fill(code);
  await page.getByText('Anmelden', { exact: true }).click();
}

const check = (cond, label) => {
  if (!cond) throw new Error('FEHLGESCHLAGEN: ' + label);
  console.log('ok:', label);
};

(async () => {
  await fetch(`${MAIL}/messages`, { method: 'DELETE' });
  sql(`update public.app_config set value='http://${GATEWAY}:8799/push' where key='push_endpoint';
       update public.salon_settings set google_review_url='https://g.page/r/beispiel/review' where id=1;`);
  await createUser('chef@test.de', 'Chef', 'admin');
  const max = await createUser('max@test.de', 'Max', 'customer');
  const tom = await createUser('tom@test.de', 'Tom', 'customer');
  const ali = await createUser('ali@test.de', 'Ali', 'customer');
  // Max und Tom waren heute da, Ali vor 50 Tagen
  sql(`insert into public.visits(customer_id, visit_date) values ('${max}', current_date), ('${tom}', current_date);
       insert into public.visits(customer_id, visit_date, created_at) values ('${ali}', current_date - 50, now() - interval '50 days');
       update public.profiles set last_visit_at = now() where id in ('${max}', '${tom}');
       update public.profiles set last_visit_at = now() - interval '50 days', push_token = 'ExponentPushToken[ali]' where id = '${ali}';
       update public.profiles set push_token = 'ExponentPushToken[max]' where id = '${max}';`);

  const appServer = serve(APP_ROOT, 8766, true);
  const dashServer = serve(DASH_ROOT, 8767, false);
  const b = await chromium.launch();
  const errs = [];
  const mk = async (w = 390, h = 844) => {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    const p = await c.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    p.on('dialog', (d) => d.accept());
    return p;
  };

  // 1) Max: gute Bewertung → Google-Hinweis
  const m = await mk();
  await appLogin(m, 'max@test.de');
  await m.getByText('Wie war dein Besuch?').waitFor({ timeout: 15000 });
  await m.screenshot({ path: `${OUT}/m1-bewertung.png` });
  await m.getByRole('button', { name: '5 Sterne', exact: true }).click();
  await m.getByPlaceholder('Möchtest du noch etwas sagen? (optional)').fill('Top Schnitt, wie immer!');
  await m.screenshot({ path: `${OUT}/m2-5-sterne.png` });
  await m.getByText('Bewertung senden').click();
  await m.getByText('Auf Google bewerten').waitFor();
  await m.screenshot({ path: `${OUT}/m3-google.png` });
  await m.getByText('Nein danke').click();
  await m.getByText('Wie war dein Besuch?').waitFor({ state: 'detached' });
  await m.reload();
  await m.getByText('Hallo Max!').waitFor();
  await m.waitForTimeout(1500);
  check((await m.getByText('Wie war dein Besuch?').count()) === 0, 'bereits bewerteter Besuch fragt nicht erneut');

  // 2) Tom: schlechte Bewertung → kein Google-Hinweis
  const t = await mk();
  await appLogin(t, 'tom@test.de');
  await t.getByText('Wie war dein Besuch?').waitFor({ timeout: 15000 });
  await t.getByRole('button', { name: '2 Sterne', exact: true }).click();
  await t.getByPlaceholder('Was können wir besser machen? (optional)').fill('Musste 20 Minuten warten.');
  await t.getByText('Bewertung senden').click();
  await t.getByText('Danke für dein Feedback!').waitFor();
  check((await t.getByText('Auf Google bewerten').count()) === 0, 'schlechte Bewertung wird nicht zu Google geschickt');
  await t.screenshot({ path: `${OUT}/m4-kritik.png` });

  // 3) Rückholaktion (der tägliche Job, hier direkt ausgelöst)
  check(sql('select public.run_winback();') === '1', 'Rückholaktion erzeugt genau einen Gutschein (Ali)');
  check(sql('select public.run_winback();') === '0', 'zweiter Lauf erzeugt keinen doppelten Gutschein');
  await new Promise((r) => setTimeout(r, 2000));
  check(pushed.some((p) => p.to === 'ExponentPushToken[ali]' && /Wir vermissen dich, Ali/.test(p.title)), 'Ali bekommt Push „Wir vermissen dich“');
  const a = await mk();
  await appLogin(a, 'ali@test.de');
  await a.getByText('10 % Rabatt auf deinen nächsten Besuch').waitFor({ timeout: 15000 });
  await a.getByText('Gültig bis').waitFor();
  await a.screenshot({ path: `${OUT}/m5-gutschein.png`, fullPage: true });
  check(true, 'Gutschein mit Ablaufdatum in Alis App sichtbar');

  // 4) Dashboard: Push-Aktion und Bewertungen
  const d = await mk(1280, 900);
  await d.goto('http://localhost:8767/');
  await d.getByPlaceholder('name@beispiel.de').fill('chef@test.de');
  await d.getByRole('button', { name: 'Code anfordern' }).click();
  await d.getByPlaceholder('123456').fill(await latestCode('chef@test.de'));
  await d.getByRole('button', { name: 'Anmelden' }).click();
  await d.getByText('Besuche heute').waitFor({ timeout: 10000 });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/d1-uebersicht.png`, fullPage: true });

  await d.getByRole('link', { name: 'Push-Nachrichten', exact: true }).click();
  await d.getByText('Neue Nachricht').waitFor();
  await d.getByLabel(/^Titel/).fill('Diese Woche: 15 % auf Bartpflege');
  await d.getByLabel(/^Text/).fill('Nur bis Samstag – zeig einfach deinen QR-Code an der Kasse.');
  const before = pushed.length;
  await d.getByRole('button', { name: 'Jetzt senden' }).click();
  await d.getByText('Gesendet an 2 Kunden.').waitFor();
  await d.waitForTimeout(2500);
  const campaign = pushed.slice(before);
  check(campaign.length === 2 && campaign.every((p) => p.title === 'Diese Woche: 15 % auf Bartpflege'), 'Push-Aktion geht an beide Kunden mit Erlaubnis');
  await d.screenshot({ path: `${OUT}/d2-push.png`, fullPage: true });

  await d.getByRole('link', { name: 'Bewertungen', exact: true }).click();
  await d.getByText('Musste 20 Minuten warten.').waitFor();
  await d.getByText('3,5 ★').waitFor();
  await d.screenshot({ path: `${OUT}/d3-bewertungen.png`, fullPage: true });
  check(true, 'Bewertungsseite zeigt Kritik und Durchschnitt 3,5');

  console.log('reviews:', sql(`select rating||':'||forwarded_to_google from public.reviews order by rating;`).replace(/\n/g, ', '));
  console.log('errors:', JSON.stringify(errs));
  appServer.close();
  dashServer.close();
  pushServer.close();
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
