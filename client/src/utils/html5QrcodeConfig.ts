import type { Html5QrcodeFullConfig } from "html5-qrcode";

// Used only for live camera scanning now — photo-upload decoding switched to
// zxing-wasm (see zxingFileDecoder.ts) after direct testing showed
// html5-qrcode's bundled ZXing-JS decoder fails on real-world handheld
// photos (skewed/rotated barcodes) that a proper decoder reads cleanly.
//
// useBarCodeDetectorIfSupported: when true and the browser supports the
// native BarcodeDetector API (Chromium-based browsers only — not Firefox/
// Safari, and desktop support varies by version), html5-qrcode uses it as
// the *primary* decoder for the live camera feed instead of its bundled
// ZXing port. Strictly additive: silently no-ops to ZXing-only where
// unsupported.
//
// verbose: surfaces html5-qrcode's own internal decode-attempt logging.
export const HTML5_QRCODE_CONFIG: Html5QrcodeFullConfig = {
  verbose: true,
  useBarCodeDetectorIfSupported: true,
};
