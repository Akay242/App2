import { setZXingModuleOverrides } from 'barcode-detector';

/**
 * Web: Die QR-Erkennung (zxing-wasm) wird von unserem eigenen Server geladen
 * (public/zxing_reader.wasm) statt von einem fremden CDN.
 */
setZXingModuleOverrides({
  locateFile: (file: string, prefix: string) => (file.endsWith('.wasm') ? `/${file}` : prefix + file),
});
