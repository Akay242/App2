// End-to-End-Test Phase 3 gegen ein lokales Supabase (siehe README, Abschnitt "Tests"):
// Dashboard-Login, Kennzahlen, Kundenliste, Leistung anlegen/ändern, Einstellungen speichern,
// danach prüfen, dass die App (Reiter Preise und Salon) die Änderungen zeigt.
// Aufruf: node scripts/e2e-dashboard.js <app-web-export> <dashboard-out> <screenshot-ordner>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { execSync } = require('child_process');

const [APP_ROOT, DASH_ROOT, OUT] = process.argv.slice(2);
const API = 'http://127.0.0.1:54321';
const PUBLISHABLE = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'; // lokaler Standardwert
const SECRET = execSync('npx -y supabase@3.0.0 status -o json 2>/dev/null').toString().match(/"SECRET_KEY":\s*"([^"]+)"/)[1];
const MAIL = 'http://127.0.0.1:54324/api/v1';
const sql = (q) => execSync('docker exec -i supabase_db_salon-bonus psql -U postgres -tA', { input: q }).toString().trim();

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

async function createUser(email, first, role) {
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!r.ok) throw new Error('createUser ' + (await r.text()));
  sql(`update public.profiles set first_name='${first}', role='${role}' where email='${email}';`);
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

async function dashLogin(page, email) {
  await page.goto('http://localhost:8767/');
  await page.getByPlaceholder('name@beispiel.de').fill(email);
  await page.getByRole('button', { name: 'Code anfordern' }).click();
  const code = await latestCode(email);
  await page.getByPlaceholder('123456').fill(code);
  await page.getByRole('button', { name: 'Anmelden' }).click();
}

(async () => {
  await fetch(`${MAIL}/messages`, { method: 'DELETE' });
  await createUser('chef@test.de', 'Chef', 'admin');
  await createUser('max@test.de', 'Max', 'customer');
  await createUser('tom@test.de', 'Tom', 'customer');
  const max = sql(`select id from public.profiles where email='max@test.de';`);
  sql(`insert into public.visits(customer_id, visit_date) select '${max}', current_date - g from generate_series(0,7) g;
       update public.profiles set last_visit_at = now() where id='${max}';`);

  const appServer = serve(APP_ROOT, 8766, true);
  const dashServer = serve(DASH_ROOT, 8767, false);
  const b = await chromium.launch();
  const errs = [];
  const mk = async (w = 1280, h = 860) => {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    const p = await c.newPage();
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    return p;
  };

  // Unbekannte E-Mail und Nicht-Admin werden abgewiesen
  const guest = await mk();
  await guest.goto('http://localhost:8767/');
  await guest.getByPlaceholder('name@beispiel.de').fill('niemand@test.de');
  await guest.getByRole('button', { name: 'Code anfordern' }).click();
  await guest.getByText('kein Konto').waitFor({ timeout: 10000 });
  console.log('unbekannte E-Mail: abgewiesen');
  await dashLogin(guest, 'tom@test.de');
  await guest.getByText('Kein Zugriff').waitFor({ timeout: 10000 });
  console.log('Nicht-Admin: kein Zugriff');

  // Admin
  const d = await mk();
  await d.goto('http://localhost:8767/');
  await d.screenshot({ path: `${OUT}/d1-login.png` });
  await dashLogin(d, 'chef@test.de');
  await d.getByText('Besuche heute').waitFor({ timeout: 10000 });
  await d.waitForTimeout(800);
  await d.screenshot({ path: `${OUT}/d2-uebersicht.png` });

  await d.getByRole('link', { name: 'Kunden', exact: true }).click();
  await d.getByText('max@test.de').waitFor();
  await d.screenshot({ path: `${OUT}/d3-kunden.png` });

  await d.getByRole('link', { name: 'Preise & Leistungen', exact: true }).click();
  await d.getByText('Herrenhaarschnitt').waitFor();
  await d.getByRole('button', { name: '+ Neue Leistung' }).click();
  await d.getByLabel('Name').fill('Augenbrauen');
  await d.getByLabel('Kategorie').fill('Extras');
  await d.getByLabel('Preis in €').fill('5,50');
  await d.getByLabel('Dauer in Minuten (optional)').fill('10');
  await d.screenshot({ path: `${OUT}/d4-neue-leistung.png` });
  await d.getByRole('button', { name: 'Speichern' }).click();
  await d.getByRole('cell', { name: 'Augenbrauen' }).waitFor();
  // Preis ändern: Herrenhaarschnitt 25 → 27
  const row = d.getByRole('row', { name: /Herrenhaarschnitt/ });
  await row.getByRole('button', { name: 'Bearbeiten' }).click();
  await d.getByLabel('Preis in €').fill('27');
  await d.getByRole('button', { name: 'Speichern' }).click();
  await d.getByRole('cell', { name: '27,00 €' }).waitFor();
  // Ungültiger Preis wird abgefangen
  await d.getByRole('button', { name: '+ Neue Leistung' }).click();
  await d.getByLabel('Name').fill('Test');
  await d.getByLabel('Preis in €').fill('abc');
  await d.getByRole('button', { name: 'Speichern' }).click();
  await d.getByText('gültigen Preis').waitFor();
  await d.getByRole('button', { name: 'Abbrechen' }).click();
  await d.screenshot({ path: `${OUT}/d5-leistungen.png`, fullPage: true });

  await d.getByRole('link', { name: 'Einstellungen', exact: true }).click();
  await d.getByLabel('Name des Salons').fill('Barbershop Akay');
  await d.getByRole('button', { name: '+ Zeile hinzufügen' }).click();
  await d.getByLabel('Tage', { exact: true }).last().fill('Feiertage');
  await d.getByLabel('Zeiten', { exact: true }).last().fill('geschlossen');
  // Ungültige Regel wird abgefangen
  await d.getByLabel('Kleines Extra beim Stempel Nr.').fill('12');
  await d.getByRole('button', { name: 'Speichern' }).click();
  await d.getByText('vor dem Gratis-Haarschnitt').waitFor();
  await d.getByLabel('Kleines Extra beim Stempel Nr.').fill('6');
  await d.getByRole('button', { name: 'Speichern' }).click();
  await d.getByText('Gespeichert.').waitFor();
  await d.screenshot({ path: `${OUT}/d6-einstellungen.png`, fullPage: true });

  // App: Kunde sieht Änderungen
  const a = await mk(390, 844);
  await a.goto('http://localhost:8766/');
  await a.getByPlaceholder('name@beispiel.de').fill('max@test.de');
  await a.getByText('Code anfordern').click();
  await new Promise((r) => setTimeout(r, 1500));
  const code = await latestCode('max@test.de');
  await a.getByPlaceholder('123456').fill(code);
  await a.getByText('Anmelden', { exact: true }).click();
  await a.getByText('Hallo Max!').waitFor({ timeout: 15000 });
  await a.waitForTimeout(800);
  await a.screenshot({ path: `${OUT}/a1-karte.png` });
  await a.getByRole('tab', { name: /Preise/ }).click();
  await a.getByText('Augenbrauen').waitFor({ timeout: 10000 });
  await a.getByText('27,00 €').waitFor();
  await a.screenshot({ path: `${OUT}/a2-preise.png` });
  await a.getByRole('tab', { name: /Salon/ }).click();
  await a.getByText('Barbershop Akay').waitFor({ timeout: 10000 });
  await a.getByText('Feiertage').waitFor();
  await a.screenshot({ path: `${OUT}/a3-salon.png` });

  console.log('services:', sql(`select name||'='||price_cents from public.services where name in ('Augenbrauen','Herrenhaarschnitt') order by name;`).replace(/\n/g, ', '));
  console.log('errors:', JSON.stringify(errs));
  appServer.close();
  dashServer.close();
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
