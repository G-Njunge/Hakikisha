import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { isAxiosError } from "axios";
import { Html5Qrcode } from "html5-qrcode";
import { getMedicineVerificationProfile, getNearbyPharmacies, scanBarcode } from "../api/medicines";
import type { MedicineVerificationProfile, NearbyPharmacy, ScanResult } from "../types/medicine";
import PharmacyMap from "../components/PharmacyMap";
import AuthNav from "../components/AuthNav";
import { HTML5_QRCODE_CONFIG } from "../utils/html5QrcodeConfig";
import { decodeBarcodeFromFile } from "../utils/zxingFileDecoder";

const BARCODE_PATTERN = /^\d{8,13}$/;

// Laptops/desktops almost never have a rear-facing camera, so the app falls
// back to a fixed webcam — holding a package steady in front of a screen is
// inherently slower/more awkward than a handheld phone camera, worth calling
// out explicitly rather than letting it look like the scanner is broken.
function isLikelyMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent);
}

type Step = "scan" | "identified" | "photos" | "package" | "pharmacy";

const STEPS: Array<{ key: Step; label: string }> = [
  { key: "scan", label: "Scan" },
  { key: "identified", label: "Medicine identified" },
  { key: "photos", label: "Reference photos" },
  { key: "package", label: "Package verification" },
  { key: "pharmacy", label: "Nearby pharmacy" },
];

const CAMERA_ELEMENT_ID = "barcode-reader";

function chipStyle(active: boolean): { border: string; background: string; color: string } {
  return active
    ? { border: "#103c1c", background: "#103c1c0f", color: "#103c1c" }
    : { border: "#1A1A2E22", background: "transparent", color: "#1A1A2E88" };
}

// "scan" is always reachable (it's the start of the flow); every later step
// needs an identified medicine behind it, so those chips stay disabled until
// scanResult.medicine exists — jumping to "photos"/"package" still needs to
// trigger the same profile-loading a normal "Continue" click would.
function StepIndicator({ current, canNavigate, onSelect }: { current: Step; canNavigate: boolean; onSelect: (step: Step) => void }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 30, flexWrap: "wrap" }}>
      {STEPS.map((step, index) => {
        const active = step.key === current;
        const s = chipStyle(active);
        const clickable = step.key === "scan" || canNavigate;
        return (
          <button
            key={step.key}
            type="button"
            onClick={() => clickable && onSelect(step.key)}
            disabled={!clickable}
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: `1.5px solid ${s.border}`,
              background: s.background,
              color: index < currentIndex ? "#2f8f52" : s.color,
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
              cursor: clickable ? "pointer" : "not-allowed",
              opacity: clickable ? 1 : 0.45,
            }}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}

const panelStyle: CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "100%",
  maxWidth: 640,
  background: "#E4E7ED",
  borderRadius: 32,
  padding: "44px 40px",
  boxShadow: "0 30px 60px -24px rgba(16,60,28,0.4)",
  margin: "0 auto",
};

const fieldInputStyle: CSSProperties = {
  padding: "14px 18px",
  borderRadius: 999,
  fontSize: 14.5,
  fontFamily: "'Inter', sans-serif",
  color: "#1A1A2E",
  border: "none",
  width: "100%",
  boxSizing: "border-box",
};

const primaryButtonStyle: CSSProperties = {
  padding: "13px 28px",
  border: "none",
  borderRadius: 999,
  background: "#103c1c",
  color: "#FDFBF7",
  fontSize: 14.5,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
};

export default function BarcodeScanPage() {
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<Step>("scan");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  const [isCameraActive, setIsCameraActive] = useState(() => searchParams.get("method") === "camera");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  // Every start()/stop() call chains onto this instead of running
  // independently — see the effect below for why.
  const cameraOperationChainRef = useRef<Promise<void>>(Promise.resolve());
  const [isMobileDevice] = useState(() => isLikelyMobileDevice());

  const [isFileScanning, setIsFileScanning] = useState(false);
  const [fileScanError, setFileScanError] = useState<string | null>(null);

  const [profile, setProfile] = useState<MedicineVerificationProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [pharmacies, setPharmacies] = useState<NearbyPharmacy[] | null>(null);
  const [pharmacyStatus, setPharmacyStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Arriving from Home's "Enter code manually"/"Upload a photo" cards with a
  // ?code= param (already-decoded barcode) auto-submits it once, so those
  // launcher cards actually verify instead of just landing on an empty form.
  const autoSubmittedCode = useRef(false);
  useEffect(() => {
    const code = searchParams.get("code");
    if (code && !autoSubmittedCode.current) {
      autoSubmittedCode.current = true;
      setManualBarcode(code);
      submitBarcode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isCameraActive) return;

    let cancelled = false; // flips true once *this* invocation's cleanup fires
    let scanner: Html5Qrcode | null = null;
    let decoded = false;

    // Every start()/stop() — across every effect invocation, including
    // React 18 StrictMode's dev-only double-invoke (mount → cleanup → mount
    // again) — chains onto the same ref-held promise instead of running
    // independently. Without this, a second "mount" starts a brand new
    // camera while the first one's start() is still pending; the two race
    // over the same DOM element/camera stream, and whichever loses gets its
    // <video> ripped out mid-play() (the "AbortError: play() request was
    // interrupted" you saw) or has stop() called before it ever finished
    // starting (a synchronous throw — html5-qrcode's stop() throws
    // directly, not via a rejected promise, so a plain `.catch()` doesn't
    // catch it, and that used to crash the whole page). Chaining strictly
    // serializes every operation: this invocation's start only begins once
    // any prior invocation's full start-then-stop lifecycle has settled.
    cameraOperationChainRef.current = cameraOperationChainRef.current.then(async () => {
      if (cancelled) return; // cleanup already fired before our turn came up

      const html5QrCode = new Html5Qrcode(CAMERA_ELEMENT_ID, HTML5_QRCODE_CONFIG);
      scanner = html5QrCode;
      html5QrCodeRef.current = html5QrCode;

      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          // qrbox must be square (or close to it) for QR codes — the previous
          // 250x150 wide-rectangle box clipped the top/bottom off any QR code
          // sized to fill its width, causing repeated failed scans until the
          // user happened to reposition it just right. fps bumped slightly for
          // snappier detection on capable devices.
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (decoded) return;
            decoded = true;
            setIsCameraActive(false);
            submitBarcode(decodedText);
          },
          () => {
            // Per-frame decode misses while the user is still aiming the camera; not an error.
          }
        );
      } catch (err) {
        console.error("Failed to start camera", err);
        const message = String(err);
        if (/NotAllowedError|PermissionDenied/i.test(message)) {
          setCameraError("Camera access was denied. Enter the code manually below or upload a photo instead.");
        } else if (/NotFoundError/i.test(message)) {
          setCameraError("No camera was found on this device. Enter the code manually below or upload a photo instead.");
        } else {
          setCameraError("Unable to access the camera. Enter the code manually below or upload a photo instead.");
        }
        setIsCameraActive(false);
        scanner = null;
        return;
      }

      if (cancelled) {
        // Cleanup fired while we were mid-start — stop right away rather
        // than leaving an orphaned camera stream running.
        try {
          await html5QrCode.stop();
          await html5QrCode.clear();
        } catch {
          // already stopped
        }
        scanner = null;
      }
    });

    return () => {
      cancelled = true;
      cameraOperationChainRef.current = cameraOperationChainRef.current.then(async () => {
        if (!scanner) return;
        try {
          await scanner.stop();
          await scanner.clear();
        } catch {
          // never actually started, or already stopped
        }
        scanner = null;
      });
    };
  }, [isCameraActive]);

  // Nudges the user toward repositioning the barcode if the camera hasn't
  // found a code within a few seconds, instead of leaving them staring at a
  // viewfinder with no feedback on what to do next.
  const [showScanningTip, setShowScanningTip] = useState(false);
  // A hard stop if scanning drags on — at that point it's very unlikely the
  // barcode is actually visible to the camera, so we stop guessing silently
  // and tell the user plainly that it failed and why.
  const [scanTimedOut, setScanTimedOut] = useState(false);
  const [scanElapsedSeconds, setScanElapsedSeconds] = useState(0);
  const SCAN_TIP_SECONDS = 6;
  const SCAN_TIMEOUT_SECONDS = 25;

  // Tracks which isCameraActive value showScanningTip was last reset for, so
  // the reset can happen during render (React's recommended way to adjust
  // state in response to a prop/state change) instead of as a synchronous
  // setState call inside the effect below.
  const [tipResetForActive, setTipResetForActive] = useState(isCameraActive);

  if (tipResetForActive !== isCameraActive) {
    setTipResetForActive(isCameraActive);
    setShowScanningTip(false);
  }

  // Only resets on activation (not deactivation) — a timeout deliberately
  // turns isCameraActive off while leaving scanTimedOut true, so the failure
  // message stays visible until the user tries again.
  useEffect(() => {
    if (isCameraActive) {
      setScanTimedOut(false);
      setScanElapsedSeconds(0);
    }
  }, [isCameraActive]);

  useEffect(() => {
    if (!isCameraActive) return;

    const tipTimer = setTimeout(() => setShowScanningTip(true), SCAN_TIP_SECONDS * 1000);
    const failureTimer = setTimeout(() => {
      setScanTimedOut(true);
      setIsCameraActive(false);
    }, SCAN_TIMEOUT_SECONDS * 1000);
    // A successful decode also flips isCameraActive off, which tears this
    // effect down via the cleanup below — so failureTimer only ever fires
    // when nothing was found in time.
    const tickTimer = setInterval(() => {
      setScanElapsedSeconds((prev) => Math.min(prev + 1, SCAN_TIMEOUT_SECONDS));
    }, 1000);

    return () => {
      clearTimeout(tipTimer);
      clearTimeout(failureTimer);
      clearInterval(tickTimer);
    };
  }, [isCameraActive]);

  function resetFlow() {
    setStep("scan");
    setScanResult(null);
    setScanError(null);
    setManualBarcode("");
    setIsCameraActive(false);
    setCameraError(null);
    setFileScanError(null);
    setProfile(null);
    setProfileError(null);
    setPharmacies(null);
    setPharmacyStatus("idle");
    setPharmacyError(null);
    setUserCoords(null);
  }

  async function submitBarcode(value: string) {
    const trimmed = value.trim();

    if (!trimmed) {
      setScanError("No code detected. Please try again.");
      setScanResult(null);
      return;
    }

    if (!BARCODE_PATTERN.test(trimmed)) {
      setScanError("That doesn't look like a valid barcode (must be 8-13 digits).");
      setScanResult(null);
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const response = await scanBarcode(trimmed);
      setScanResult(response);
      if (response.medicine) {
        setStep("identified");
      }
    } catch (err) {
      console.error("Barcode scan failed", err);
      if (isAxiosError(err)) {
        if (err.response?.status === 400) {
          setScanError("That doesn't look like a valid barcode (must be 8-13 digits).");
        } else if (err.response) {
          setScanError("Something went wrong verifying this code. Please try again in a moment.");
        } else {
          setScanError("Network error — check your connection and try again.");
        }
      } else {
        setScanError("Unable to verify barcode. Please try again.");
      }
    } finally {
      setIsScanning(false);
    }
  }

  function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitBarcode(manualBarcode);
  }

  function toggleCamera() {
    setCameraError(null);
    setIsCameraActive((prev) => !prev);
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsCameraActive(false);
    setFileScanError(null);
    setIsFileScanning(true);

    console.log("[photo-scan] file selected", { name: file.name, type: file.type, sizeBytes: file.size });

    try {
      const decodedText = await decodeBarcodeFromFile(file);
      console.log("[photo-scan] decoded:", decodedText);
      await submitBarcode(decodedText);
    } catch (err) {
      console.error("[photo-scan] Failed to read code from image — full error object:", err);
      setFileScanError("Couldn't find a scannable code in that photo. Try a clearer, well-lit shot square to the package.");
    } finally {
      setIsFileScanning(false);
    }
  }

  async function ensureProfileLoaded() {
    if (profile || !scanResult?.medicine) return;

    setProfileLoading(true);
    setProfileError(null);
    try {
      const result = await getMedicineVerificationProfile(scanResult.medicine.id);
      setProfile(result);
    } catch (err) {
      console.error("Failed to load verification profile", err);
      setProfileError("Unable to load reference photos and verification details.");
    } finally {
      setProfileLoading(false);
    }
  }

  function goToPhotos() {
    setStep("photos");
    ensureProfileLoaded();
  }

  function goToPharmacyStep() {
    setStep("pharmacy");
    if (pharmacyStatus !== "idle") return;
    findNearbyPharmacies();
  }

  // Lets the step chips act as real tabs: "scan" is always reachable, every
  // later step needs an identified medicine (StepIndicator already disables
  // those chips otherwise), and jumping straight to "photos"/"package"
  // triggers the same profile load a normal "Continue" click would.
  function handleStepSelect(target: Step) {
    if (target === "scan") {
      setStep("scan");
      return;
    }
    if (!scanResult?.medicine) return;
    if (target === "pharmacy") {
      goToPharmacyStep();
      return;
    }
    if (target === "photos" || target === "package") {
      ensureProfileLoaded();
    }
    setStep(target);
  }

  function findNearbyPharmacies() {
    if (!("geolocation" in navigator)) {
      setPharmacyStatus("error");
      setPharmacyError("Location is not available in this browser.");
      return;
    }

    setPharmacyStatus("loading");
    setPharmacyError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const results = await getNearbyPharmacies(
            position.coords.latitude,
            position.coords.longitude,
            scanResult?.medicine?.id
          );
          setPharmacies(results);
          setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setPharmacyStatus("success");
        } catch (err) {
          console.error("Failed to fetch nearby pharmacies", err);
          setPharmacyStatus("error");
          setPharmacyError("Unable to fetch nearby pharmacies.");
        }
      },
      () => {
        setPharmacyStatus("error");
        setPharmacyError("Location permission was denied. Enable it to find nearby pharmacies.");
      }
    );
  }

  const isVerified = scanResult?.status === "VERIFIED";
  const bannerColor = isVerified ? "#2f8f52" : "#b8862f";
  const bannerBg = isVerified ? "#5fbf7d22" : "#ff6b6b1a";
  const bannerBorder = isVerified ? "#5fbf7d55" : "#ff6b6b55";

  return (
    <div className="hk-page" style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#FDFBF7", position: "relative" }}>
      <img
        src="/assets/home-bg-linen.png"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />
      <AuthNav />

      <div style={{ position: "relative", zIndex: 1, padding: "40px 24px 90px" }}>
        <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 30, textAlign: "center", margin: "0 0 6px", color: "#1A1A2E" }}>
          Barcode scanner
        </h1>
        <p style={{ textAlign: "center", fontSize: 14.5, color: "#1A1A2E88", margin: "0 0 26px" }}>
          Verify barcodes from the local Hakikisha database only.
        </p>

        {step !== "scan" && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <StepIndicator current={step} canNavigate={!!scanResult?.medicine} onSelect={handleStepSelect} />
          </div>
        )}

        {step === "scan" && (
          <div style={panelStyle}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
              <button type="button" onClick={toggleCamera} className="hk-neu-btn" style={primaryButtonStyle}>
                {isCameraActive ? "Stop camera" : "Scan with camera"}
              </button>
            </div>

            {isCameraActive && (
              <>
                <div style={{ maxWidth: 320, margin: "0 auto 10px", borderRadius: 16, overflow: "hidden" }}>
                  <div id={CAMERA_ELEMENT_ID} />
                </div>
                <p style={{ textAlign: "center", fontSize: 12, color: "#1A1A2E66", margin: "0 0 10px" }}>
                  Scanning... {scanElapsedSeconds}s / {SCAN_TIMEOUT_SECONDS}s
                </p>
                <p style={{ textAlign: "center", fontSize: 13.5, color: "#1A1A2E88", maxWidth: 380, margin: "0 auto 10px" }}>
                  Hold your phone steady, about 10–15cm from the package. Center the QR code in the box, with
                  even lighting and no glare.
                </p>
                {!isMobileDevice && (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "8px 12px", maxWidth: 380, margin: "0 auto 10px" }}>
                    Using a laptop or desktop webcam? Scanning may take noticeably longer than on a phone — try
                    holding the package steady close to the camera, or use manual entry, photo upload, or search
                    below instead.
                  </p>
                )}
                {showScanningTip && (
                  <p style={{ textAlign: "center", fontSize: 13, color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "8px 12px", maxWidth: 380, margin: "0 auto 10px" }}>
                    Can't see the barcode? Try placing it flat, centered in the box, and closer to the camera —
                    a small repositioning usually fixes it.
                  </p>
                )}
              </>
            )}
            {scanTimedOut && (
              <div
                style={{
                  textAlign: "center",
                  background: "#ff6b6b1a",
                  border: "1.5px solid #ff6b6b55",
                  borderRadius: 14,
                  padding: "14px 18px",
                  maxWidth: 380,
                  margin: "0 auto 16px",
                }}
              >
                <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700, color: "#b8862f" }}>Scan failed</p>
                <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "#1A1A2E" }}>
                  We couldn't get a clear view of the barcode in time. This usually means it wasn't fully in
                  frame, was too far away, or was catching glare from a light — try repositioning it, or use
                  manual entry or photo upload below instead.
                </p>
                <button type="button" onClick={toggleCamera} className="hk-neu-btn" style={{ ...primaryButtonStyle, padding: "10px 22px", fontSize: 13.5 }}>
                  Try again
                </button>
              </div>
            )}
            {cameraError && <p style={{ textAlign: "center", color: "#b91c1c", fontSize: 13.5 }}>{cameraError}</p>}

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #1A1A2E15" }}>
              <p style={{ fontSize: 13.5, color: "#1A1A2E88", marginBottom: 10 }}>Camera denied or not working? Enter the code manually.</p>
              <form style={{ display: "flex", gap: 10, flexWrap: "wrap" }} onSubmit={handleManualSubmit}>
                <input
                  className="hk-neu-field"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter the barcode number"
                  value={manualBarcode}
                  onChange={(event) => setManualBarcode(event.target.value)}
                  style={{ ...fieldInputStyle, flex: 1, minWidth: 220 }}
                />
                <button type="submit" disabled={isScanning} className="hk-neu-btn" style={primaryButtonStyle}>
                  {isScanning ? "Verifying..." : "Verify"}
                </button>
              </form>
            </div>

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid #1A1A2E15" }}>
              <p style={{ fontSize: 13.5, color: "#1A1A2E88", marginBottom: 10 }}>Or upload a photo of the QR code instead.</p>
              <label className="hk-neu-upload" style={{ display: "inline-block", padding: "11px 22px", borderRadius: 999, color: "#1A1A2E88", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                {isFileScanning ? "Reading photo..." : "Upload photo"}
                <input type="file" accept="image/*" onChange={handleFileUpload} disabled={isFileScanning} hidden />
              </label>
            </div>

            {fileScanError && <p style={{ color: "#b91c1c", fontSize: 13.5, textAlign: "center", marginTop: 14 }}>{fileScanError}</p>}
            {(isScanning || isFileScanning) && <p style={{ textAlign: "center", fontSize: 13.5, color: "#1A1A2E88", marginTop: 14 }}>Verifying...</p>}
            {scanError && <p style={{ color: "#b91c1c", fontSize: 13.5, textAlign: "center", marginTop: 14 }}>{scanError}</p>}

            {scanResult && !scanResult.medicine && (
              <div
                style={{
                  marginTop: 22,
                  borderRadius: 20,
                  padding: "22px 26px",
                  background: "#ff6b6b1a",
                  border: "1.5px solid #ff6b6b55",
                }}
              >
                <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#b8862f", fontFamily: "'Manrope', sans-serif" }}>UNVERIFIED</h2>
                <p style={{ margin: "0 0 8px", fontSize: 14, color: "#1A1A2E" }}>
                  {scanResult.message ?? "This barcode does not exist in the Hakikisha database."}
                </p>
                <p style={{ margin: "0 0 4px", fontSize: 13, color: "#1A1A2E88" }}>This does NOT necessarily mean the medicine is counterfeit.</p>
                <p style={{ margin: 0, fontSize: 13, color: "#1A1A2E88" }}>Please verify with the manufacturer or pharmacy.</p>
              </div>
            )}
          </div>
        )}

        {step === "identified" && scanResult?.medicine && (
          <div style={{ ...panelStyle, maxWidth: 720 }}>
            <div
              style={{
                borderRadius: 20,
                padding: "20px 26px",
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: bannerBg,
                border: `1.5px solid ${bannerBorder}`,
                marginBottom: 22,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: isVerified ? "#5fbf7d" : "#ff6b6b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 22, color: "#FDFBF7" }}>{isVerified ? "✓" : "!"}</span>
              </div>
              <div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 19, color: bannerColor }}>
                  {isVerified ? "VERIFIED" : "UNVERIFIED"}
                </div>
                <div style={{ fontSize: 13, color: "#1A1A2E88" }}>Checked against the local Hakikisha registry</div>
              </div>
            </div>
            {scanResult.message && <p style={{ fontSize: 13.5, color: "#1A1A2E88", marginTop: -12, marginBottom: 18 }}>{scanResult.message}</p>}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Name", value: scanResult.medicine.name },
                { label: "Manufacturer", value: scanResult.medicine.manufacturer },
                { label: "Batch", value: scanResult.batchNumber ?? "Not listed" },
                { label: "Expiry date", value: scanResult.expiryDate ? new Date(scanResult.expiryDate).toLocaleDateString() : "Not listed" },
                { label: "Approval status", value: scanResult.medicine.approvalStatus },
              ].map((item) => (
                <div key={item.label} className="hk-neu-panel" style={{ borderRadius: 16, padding: 16 }}>
                  <div style={{ fontSize: 11, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>{item.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button type="button" onClick={goToPhotos} className="hk-neu-btn" style={primaryButtonStyle}>
                Continue to reference photos
              </button>
              <Link
                to={`/medicines/${scanResult.medicine.id}`}
                style={{ padding: "13px 24px", borderRadius: 999, border: "1.5px solid #1A1A2E22", fontSize: 14, fontWeight: 700, color: "#1A1A2E" }}
              >
                View full details
              </Link>
            </div>
          </div>
        )}

        {step === "photos" && (
          <div style={panelStyle}>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 19, color: "#1A1A2E", margin: "0 0 18px" }}>
              Reference photos
            </h2>
            {profileLoading && <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>Loading reference photos...</p>}
            {profileError && <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{profileError}</p>}
            {profile && (() => {
              // Only render panels for angles that actually have a photo —
              // e.g. most medicines here only have a package shot, not a
              // separate tablet close-up, and there's no placeholder to fall
              // back to for a missing one anymore.
              const availableAngles = (["tablet", "package"] as const).filter((angle) => profile.photos[angle]);

              if (availableAngles.length === 0) {
                return (
                  <p style={{ fontSize: 13.5, color: "#1A1A2E88", marginBottom: 22 }}>
                    No reference photos available for this medicine yet.
                  </p>
                );
              }

              return (
                // Columns capped at 260px (not 1fr) so a single photo doesn't
                // stretch to fill the whole ~600px panel width — most source
                // photos are modest resolution (many under 500px wide) and
                // visibly blur when upscaled that far.
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 260px))", gap: 16, marginBottom: 22, justifyContent: "center" }}>
                  {availableAngles.map((angle) => (
                    <div key={angle} className="hk-neu-panel" style={{ borderRadius: 16, padding: 14, textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                        {angle === "tablet" ? "Tablet" : "Package"}
                      </div>
                      <img
                        src={profile.photos[angle] as string}
                        alt={`${profile.medicine.name} ${angle}`}
                        style={{ width: "100%", height: "auto", borderRadius: 10 }}
                      />
                    </div>
                  ))}
                </div>
              );
            })()}
            <button type="button" onClick={() => setStep("package")} className="hk-neu-btn" style={primaryButtonStyle}>
              Continue to package verification
            </button>
          </div>
        )}

        {step === "package" && (
          <div style={panelStyle}>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 19, color: "#1A1A2E", margin: "0 0 18px" }}>
              How to Identify a Genuine Package
            </h2>
            {profile && profile.packageVerification.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
                {profile.packageVerification.map((label) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: "#5fbf7d",
                        color: "#0c2f16",
                        fontSize: 12,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ fontSize: 14, color: "#1A1A2E" }}>{label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>No package verification guidance available for this medicine yet.</p>
            )}
            <button type="button" onClick={goToPharmacyStep} className="hk-neu-btn" style={primaryButtonStyle}>
              Continue to nearby pharmacy
            </button>
          </div>
        )}

        {step === "pharmacy" && (
          <div style={{ ...panelStyle, maxWidth: 720 }}>
            <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 19, color: "#1A1A2E", margin: "0 0 18px" }}>
              Nearby pharmacy
            </h2>
            {pharmacyStatus === "loading" && <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>Finding nearby pharmacies...</p>}
            {pharmacyStatus === "error" && (
              <>
                <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{pharmacyError}</p>
                <button type="button" onClick={findNearbyPharmacies} className="hk-neu-btn" style={{ ...primaryButtonStyle, marginBottom: 18 }}>
                  Try again
                </button>
              </>
            )}
            {pharmacyStatus === "success" && pharmacies && (() => {
              // Only pharmacies confirmed to stock this medicine are worth
              // showing here — stocksMedicine is a real boolean (not null)
              // whenever a medicine id was passed, which is always true on
              // this step.
              const stockedPharmacies = pharmacies.filter((pharmacy) => pharmacy.stocksMedicine);

              if (stockedPharmacies.length === 0) {
                return (
                  <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>
                    No nearby pharmacies have this medicine in stock right now.
                  </p>
                );
              }

              return (
                <>
                  {userCoords && <PharmacyMap center={userCoords} pharmacies={stockedPharmacies} />}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0 22px" }}>
                    {stockedPharmacies.map((pharmacy) => (
                      <div key={pharmacy.id} className="hk-card" style={{ borderRadius: 18, padding: "16px 20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                          <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14.5, color: "#1A1A2E" }}>
                            {pharmacy.name}
                          </span>
                          <span style={{ fontSize: 13, color: "#1A1A2E77" }}>{pharmacy.distanceKm} km</span>
                        </div>
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 6,
                            padding: "2px 10px",
                            borderRadius: 999,
                            background: "#5fbf7d22",
                            color: "#2f8f52",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          Confirmed in stock
                        </span>
                        <div style={{ fontSize: 13, color: "#1A1A2E77", marginTop: 6 }}>{pharmacy.address}</div>
                        {pharmacy.phone && <div style={{ fontSize: 13, color: "#1A1A2E77" }}>{pharmacy.phone}</div>}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
            <button type="button" onClick={resetFlow} className="hk-neu-btn" style={primaryButtonStyle}>
              Scan another barcode
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", marginTop: 28 }}>
          <Link to="/" style={{ fontSize: 13.5, fontWeight: 600, color: "#3e4440", textDecoration: "underline" }}>
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
