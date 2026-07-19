import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { Html5Qrcode } from "html5-qrcode";
import { getMedicineVerificationProfile, getNearbyPharmacies, scanBarcode } from "../api/medicines";
import type { MedicineVerificationProfile, NearbyPharmacy, ScanResult } from "../types/medicine";

const BARCODE_PATTERN = /^\d{8,13}$/;

type Step = "scan" | "identified" | "photos" | "package" | "safety" | "pharmacy";

const STEPS: Array<{ key: Step; label: string }> = [
  { key: "scan", label: "Scan" },
  { key: "identified", label: "Medicine identified" },
  { key: "photos", label: "Reference photos" },
  { key: "package", label: "Package verification" },
  { key: "safety", label: "Safety information" },
  { key: "pharmacy", label: "Nearby pharmacy" },
];

const CAMERA_ELEMENT_ID = "barcode-reader";
const FILE_SCAN_ELEMENT_ID = "barcode-file-reader";

function StepIndicator({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="step-indicator">
      {STEPS.map((step, index) => (
        <li
          key={step.key}
          className={
            index === currentIndex ? "step active" : index < currentIndex ? "step done" : "step"
          }
        >
          {step.label}
        </li>
      ))}
    </ol>
  );
}

export default function BarcodeScanPage() {
  const [step, setStep] = useState<Step>("scan");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const [isFileScanning, setIsFileScanning] = useState(false);
  const [fileScanError, setFileScanError] = useState<string | null>(null);
  const fileScannerRef = useRef<Html5Qrcode | null>(null);

  const [profile, setProfile] = useState<MedicineVerificationProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [comparisonChecks, setComparisonChecks] = useState<Record<string, boolean>>({});

  const [pharmacies, setPharmacies] = useState<NearbyPharmacy[] | null>(null);
  const [pharmacyStatus, setPharmacyStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);

  useEffect(() => {
    if (!isCameraActive) return;

    const html5QrCode = new Html5Qrcode(CAMERA_ELEMENT_ID);
    html5QrCodeRef.current = html5QrCode;
    let decoded = false;

    html5QrCode
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText) => {
          if (decoded) return;
          decoded = true;
          setIsCameraActive(false);
          submitBarcode(decodedText);
        },
        () => {
          // Per-frame decode misses while the user is still aiming the camera; not an error.
        }
      )
      .catch((err) => {
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
      });

    return () => {
      html5QrCode
        .stop()
        .then(() => html5QrCode.clear())
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setComparisonChecks({});
    setPharmacies(null);
    setPharmacyStatus("idle");
    setPharmacyError(null);
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

    try {
      fileScannerRef.current ??= new Html5Qrcode(FILE_SCAN_ELEMENT_ID);
      const decodedText = await fileScannerRef.current.scanFile(file, false);
      await submitBarcode(decodedText);
    } catch (err) {
      console.error("Failed to read code from image", err);
      setFileScanError("Couldn't find a scannable code in that photo. Try a clearer, well-lit shot square to the package.");
    } finally {
      setIsFileScanning(false);
    }
  }

  async function goToPhotos() {
    setStep("photos");
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

  function toggleComparisonCheck(label: string) {
    setComparisonChecks((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function goToPharmacyStep() {
    setStep("pharmacy");
    if (pharmacyStatus !== "idle") return;
    findNearbyPharmacies();
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
          const results = await getNearbyPharmacies(position.coords.latitude, position.coords.longitude);
          setPharmacies(results);
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

  return (
    <main className="page-shell">
      <section className="page-card">
        <h1 className="page-title">Barcode scanner</h1>
        <p className="page-subtitle">Verify barcodes from the local Hakikisha database only.</p>

        {step !== "scan" && <StepIndicator current={step} />}

        {step === "scan" && (
          <>
            <div className="scan-mode-row">
              <button type="button" onClick={toggleCamera}>
                {isCameraActive ? "Stop camera" : "Scan with camera"}
              </button>
            </div>

            {isCameraActive && (
              <div className="camera-viewfinder">
                <div id={CAMERA_ELEMENT_ID} />
              </div>
            )}
            {cameraError && <p className="page-status error">{cameraError}</p>}

            <div className="scan-fallback">
              <p className="page-status">Camera denied or not working? Enter the code manually.</p>
              <form className="barcode-form" onSubmit={handleManualSubmit}>
                <input
                  className="barcode-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter the barcode number"
                  value={manualBarcode}
                  onChange={(event) => setManualBarcode(event.target.value)}
                />
                <button type="submit" disabled={isScanning}>
                  {isScanning ? "Verifying..." : "Verify"}
                </button>
              </form>
            </div>

            <div className="scan-fallback">
              <p className="page-status">Or upload a photo of the QR code instead.</p>
              <label className="file-upload-button">
                {isFileScanning ? "Reading photo..." : "Upload photo"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={isFileScanning}
                  hidden
                />
              </label>
              {/* Kept mounted (hidden) so the file-scan Html5Qrcode instance always has an element to bind to. */}
              <div id={FILE_SCAN_ELEMENT_ID} style={{ display: "none" }} />
            </div>

            {fileScanError && <p className="page-status error">{fileScanError}</p>}
            {(isScanning || isFileScanning) && <p className="page-status">Verifying...</p>}
            {scanError && <p className="page-status error">{scanError}</p>}

            {scanResult && !scanResult.medicine && (
              <div className="scan-card unverified">
                <h2>UNVERIFIED</h2>
                <p>{scanResult.message ?? "This barcode does not exist in the Hakikisha database."}</p>
                <p>This does NOT necessarily mean the medicine is counterfeit.</p>
                <p>Please verify with the manufacturer or pharmacy.</p>
                <p className="page-link-row">
                  <Link to="/report" state={{ scanId: scanResult.scanId }}>
                    Report this as counterfeit
                  </Link>
                </p>
              </div>
            )}
          </>
        )}

        {step === "identified" && scanResult?.medicine && (
          <div className={`scan-card ${scanResult.status === "VERIFIED" ? "verified" : "unverified"}`}>
            <h2>{scanResult.status === "VERIFIED" ? "✓ VERIFIED" : "⚠ UNVERIFIED"}</h2>
            {scanResult.message && <p>{scanResult.message}</p>}
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Name</span>
                <span className="detail-value">{scanResult.medicine.name}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Manufacturer</span>
                <span className="detail-value">{scanResult.medicine.manufacturer}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Batch</span>
                <span className="detail-value">{scanResult.batchNumber ?? "Not listed"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Approval status</span>
                <span className="detail-value">{scanResult.medicine.approvalStatus}</span>
              </div>
            </div>
            <p className="page-link-row">
              <button type="button" onClick={goToPhotos}>
                Continue to reference photos
              </button>{" "}
              <Link to="/report" state={{ scanId: scanResult.scanId, productName: scanResult.medicine.name }}>
                Report this as counterfeit
              </Link>
            </p>
          </div>
        )}

        {step === "photos" && (
          <div className="barcode-result">
            <h2>Reference photos</h2>
            {profileLoading && <p className="page-status">Loading reference photos...</p>}
            {profileError && <p className="page-status error">{profileError}</p>}
            {profile && (
              <div className="photo-grid">
                <div className="photo-card">
                  <span className="detail-label">Front</span>
                  {profile.photos.front ? (
                    <img src={profile.photos.front} alt={`${profile.medicine.name} front packaging`} />
                  ) : (
                    <p className="page-status">No front photo available.</p>
                  )}
                </div>
                <div className="photo-card">
                  <span className="detail-label">Back</span>
                  {profile.photos.back ? (
                    <img src={profile.photos.back} alt={`${profile.medicine.name} back packaging`} />
                  ) : (
                    <p className="page-status">No back photo available.</p>
                  )}
                </div>
              </div>
            )}
            <p className="page-link-row">
              <button type="button" onClick={() => setStep("package")}>
                Continue to package verification
              </button>
            </p>
          </div>
        )}

        {step === "package" && (
          <div className="barcode-result">
            <h2>How to Identify a Genuine Package</h2>
            {profile && profile.packageVerification.length > 0 ? (
              <ul className="checklist">
                {profile.packageVerification.map((label) => (
                  <li key={label} className="checklist-item">
                    <span className="checklist-mark">&#10003;</span>
                    {label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="page-status">No package verification guidance available for this medicine yet.</p>
            )}
            <p className="page-link-row">
              <button type="button" onClick={() => setStep("safety")}>
                Continue to safety information
              </button>
            </p>
          </div>
        )}

        {step === "safety" && (
          <div className="barcode-result">
            <h2>Things to Compare</h2>
            {profile && profile.safetyComparison.length > 0 ? (
              <ul className="checklist">
                {profile.safetyComparison.map((label) => (
                  <li key={label} className="checklist-item">
                    <label>
                      <input
                        type="checkbox"
                        checked={!!comparisonChecks[label]}
                        onChange={() => toggleComparisonCheck(label)}
                      />
                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="page-status">No comparison points available for this medicine yet.</p>
            )}
            <p className="page-link-row">
              <button type="button" onClick={goToPharmacyStep}>
                Continue to nearby pharmacy
              </button>
            </p>
          </div>
        )}

        {step === "pharmacy" && (
          <div className="barcode-result">
            <h2>Nearby pharmacy</h2>
            {pharmacyStatus === "loading" && <p className="page-status">Finding nearby pharmacies...</p>}
            {pharmacyStatus === "error" && (
              <>
                <p className="page-status error">{pharmacyError}</p>
                <button type="button" onClick={findNearbyPharmacies}>
                  Try again
                </button>
              </>
            )}
            {pharmacyStatus === "success" && pharmacies && pharmacies.length === 0 && (
              <p className="page-status">No pharmacies found near you.</p>
            )}
            {pharmacyStatus === "success" && pharmacies && pharmacies.length > 0 && (
              <ul className="result-list">
                {pharmacies.map((pharmacy) => (
                  <li key={pharmacy.id} className="pharmacy-card">
                    <div className="result-top">
                      <span className="result-name">{pharmacy.name}</span>
                      <span>{pharmacy.distanceKm} km</span>
                    </div>
                    <div className="result-meta">{pharmacy.address}</div>
                    {pharmacy.phone && <div className="result-meta">{pharmacy.phone}</div>}
                  </li>
                ))}
              </ul>
            )}
            <p className="page-link-row">
              <button type="button" onClick={resetFlow}>
                Scan another barcode
              </button>
            </p>
          </div>
        )}

        <p className="page-link-row">
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
