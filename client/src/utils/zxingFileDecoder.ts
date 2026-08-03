import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

// Self-hosted instead of the library's default (fetching from jsDelivr's
// CDN) — avoids a third-party network dependency for a core scanning
// feature. The .wasm binary is copied from
// node_modules/zxing-wasm/dist/reader/zxing_reader.wasm into client/public/
// (served at the site root by Vite) — see README "Serving via Web or CDN".
prepareZXingModule({
  overrides: {
    locateFile: (path: string) => (path.endsWith(".wasm") ? "/zxing_reader.wasm" : path),
  },
});

// Real ZXing-C++ (compiled to WASM) instead of html5-qrcode's bundled
// ZXing-JS port, used only for one-shot photo-upload decoding. Confirmed by
// direct testing against real handheld photos of a rotated/skewed barcode:
// the JS port fails every time (it doesn't attempt rotated orientations at
// all), while this decoder reads them cleanly — tryHarder/tryRotate/
// tryInvert are the actual C++ ZXing algorithms, not a naive JS scanline
// pass. Live camera scanning is unaffected — it still uses html5-qrcode,
// since users can physically reorient the camera in real time there.
export async function decodeBarcodeFromFile(file: File): Promise<string> {
  const results = await readBarcodes(file, {
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    tryDownscale: true,
  });

  const match = results.find((result) => result.isValid && result.text);
  if (!match) {
    throw new Error("No barcode detected in image");
  }
  return match.text;
}
