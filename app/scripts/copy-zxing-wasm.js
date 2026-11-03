// Kopiert die QR-Erkennung (WebAssembly) für den Web-Scanner nach public/,
// damit sie von unserem eigenen Server statt von einem fremden CDN geladen wird.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const candidates = [
  'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm',
  'node_modules/barcode-detector/node_modules/zxing-wasm/dist/reader/zxing_reader.wasm',
].map((p) => path.join(root, p));

const src = candidates.find((p) => fs.existsSync(p));
if (!src) {
  console.error('zxing_reader.wasm nicht gefunden – ist barcode-detector installiert?');
  process.exit(1);
}
fs.copyFileSync(src, path.join(root, 'public', 'zxing_reader.wasm'));
console.log('zxing_reader.wasm -> public/');
