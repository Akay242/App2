// End-to-End-Test Phase 5 (Web-App) gegen ein lokales Supabase:
// - echter QR-Scan im Browser: Chromium bekommt den QR-Code des Kunden als Kamerabild
// - QR-Erkennung wird vom eigenen Server geladen (kein fremdes CDN)
// - Impressum/Datenschutz ohne Login erreichbar, mit Angaben aus den Einstellungen
// - Installations-Hinweis auf dem iPhone, Konto löschen
// Aufruf: node scripts/e2e-web-start.js <app-web-export> <screenshot-ordner>
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { execSync } = require('child_process');
const QRCode = require(path.join(__dirname, '..', 'app', 'node_modules', 'qrcode'));

const [APP_ROOT, OUT] = process.argv.slice(2);
const API = 'http://127.0.0.1:54321';
const SECRET = execSync('npx -y supabase@3.0.0 status -o json 2>/dev/null').toString().match(/"SECRET_KEY":\s*"([^"]+)"/)[1];
const MAIL = 'http://127.0.0.1:54324/api/v1';
const sql = (q) => execSync('docker exec -i supabase_db_salon-bonus psql -U postgres -tA -v ON_ERROR_STOP=1', { input: q }).toString().trim();
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf' };
const served = [];
const external = []; // Anfragen des Browsers an fremde Server (außer lokal)
const pages = [];
const server = http.createServer((req, res) => {
  served.push(req.url);
  let p = path.join(APP_ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(APP_ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(8766);

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

async function login(page, email) {
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
  sql(`update public.salon_settings set name='Barbershop Akay', imprint_owner='Akay Mustermann',
       imprint_email='barbershop.akay@gmail.com' where id=1;`);
  await createUser('chef@test.de', 'Chef', 'admin');
  await createUser('max@test.de', 'Max', 'customer');
  const token = sql(`select qr_token from public.profiles where email='max@test.de';`);

  // QR-Code des Kunden als Kamerabild (wie ein Handy-Display vor der Kamera)
  const png = path.join(OUT, 'qr.png'), y4m = path.join(OUT, 'qr.y4m');
  await QRCode.toFile(png, token, { width: 360, margin: 4 });
  execSync(`ffmpeg -y -loglevel error -loop 1 -i ${png} -vf "scale=360:360,pad=640:480:140:60:white,format=yuv420p" -t 3 -r 10 ${y4m}`);

  const b = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${y4m}`],
  });
  const errs = [];
  const mk = async (opts = {}) => {
    const c = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'], ...opts });
    const p = await c.newPage();
    pages.push(p);
    p.on('request', (r) => {
      const host = new URL(r.url()).hostname;
      if (!['localhost', '127.0.0.1'].includes(host) && !r.url().startsWith('data:')) external.push(r.url());
    });
    p.on('pageerror', (e) => errs.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
    p.on('dialog', (d) => d.accept());
    p.on('response', (r) => r.status() >= 400 && errs.push(`${r.status()} ${r.request().method()} ${r.url()}`));
    return p;
  };

  // 1) Rechtliches ohne Login
  const g = await mk();
  await g.goto('http://localhost:8766/');
  await g.getByText('Datenschutz', { exact: true }).click();
  await g.getByText('1. Verantwortlicher').waitFor({ timeout: 15000 });
  await g.getByText('Akay Mustermann (Barbershop Akay)').waitFor();
  await g.screenshot({ path: `${OUT}/w1-datenschutz.png` });
  await g.goto('http://localhost:8766/impressum');
  await g.getByText('Angaben gemäß § 5 DDG').waitFor({ timeout: 15000 });
  await g.getByText('E-Mail: barbershop.akay@gmail.com').waitFor();
  await g.screenshot({ path: `${OUT}/w2-impressum.png` });
  check(true, 'Impressum und Datenschutz ohne Anmeldung erreichbar, mit Salon-Angaben');

  // 2) Admin scannt mit der Browser-Kamera
  const a = await mk();
  await login(a, 'chef@test.de');
  // Die Kamera "sieht" sofort den QR-Code, der Scanner springt direkt zum Ergebnis.
  await a.getByText('Stempel 1 von 12').waitFor({ timeout: 30000 });
  await a.screenshot({ path: `${OUT}/w4-gescannt.png` });
  check(sql(`select count(*) from public.visits;`) === '1', 'echter QR-Scan über die Browser-Kamera trägt den Besuch ein');
  check(served.includes('/zxing_reader.wasm'), 'QR-Erkennung kommt vom eigenen Server');

  // 3) Kunde auf dem iPhone: Installations-Hinweis, Konto löschen
  const k = await mk({ userAgent: IPHONE_UA });
  await login(k, 'max@test.de');
  await k.getByText('Hallo Max!').waitFor({ timeout: 15000 });
  await k.getByText('Als App auf dem Home-Bildschirm').waitFor({ timeout: 15000 });
  await k.screenshot({ path: `${OUT}/w5-install-hinweis.png`, fullPage: true });
  check(true, 'iPhone-Nutzer sieht Anleitung „Zum Home-Bildschirm“');
  await k.getByRole('tab', { name: /Salon/ }).click();
  await k.getByText('Mein Konto').waitFor();
  await k.screenshot({ path: `${OUT}/w6-konto.png`, fullPage: true });
  await k.getByText('Konto löschen').click();
  await k.getByText('Code anfordern').waitFor({ timeout: 15000 });
  check(sql(`select count(*) from auth.users where email='max@test.de';`) === '0', 'Konto löschen entfernt den Kunden');
  check(sql(`select count(*) from public.visits;`) === '0', 'mit dem Konto verschwinden auch die Besuche');

  check(external.length === 0, `Browser lädt nichts von fremden Servern ${external.slice(0, 3).join(' ')}`);
  // Erwartet: Nach dem Löschen meldet supabase-js beim Server ab, der den Nutzer nicht mehr
  // kennt (403). Die lokale Sitzung wird trotzdem entfernt.
  const unexpected = errs.filter((e) => !/auth\/v1\/logout|status of 403/.test(e));
  check(unexpected.length === 0, `keine unerwarteten Fehler ${JSON.stringify(unexpected)}`);
  server.close();
  await b.close();
})().catch(async (e) => {
  console.error(e);
  // Bei Fehlern: Zustand aller Seiten festhalten
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${OUT}/fehler-${i}.png` }).catch(() => {});
  process.exit(1);
});
