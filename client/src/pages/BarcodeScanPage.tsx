import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { Html5Qrcode } from "html5-qrcode";
import { getMedicineVerificationProfile, getNearbyPharmacies, scanBarcode, searchMedicines } from "../api/medicines";
import type { MedicineSearchResult, MedicineVerificationProfile, NearbyPharmacy, ScanResult } from "../types/medicine";

const BARCODE_PATTERN = /^\d{8,13}$/;

// Laptops/desktops almost never have a rear-facing camera, so the app falls
// back to a fixed webcam — holding a package steady in front of a screen is
// inherently slower/more awkward than a handheld phone camera, worth calling
// out explicitly rather than letting it look like the scanner is broken.
function isLikelyMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|webOS/i.test(navigator.userAgent);
}

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MedicineSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [isMobileDevice] = useState(() => isLikelyMobileDevice());

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

  // Nudges the user toward the manual-entry/upload/search fallbacks if the
  // camera hasn't found a code within a few seconds, instead of leaving them
  // staring at a viewfinder with no feedback on what to do next.
  const [showScanningTip, setShowScanningTip] = useState(false);

  useEffect(() => {
    setShowScanningTip(false);
    if (!isCameraActive) return;

    const timer = setTimeout(() => setShowScanningTip(true), 7000);
    return () => clearTimeout(timer);
  }, [isCameraActive]);

  function resetFlow() {
    setStep("scan");
    setScanResult(null);
    setScanError(null);
    setManualBarcode("");
    setSearchQuery("");
    setSearchResults(null);
    setSearchError(null);
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

  async function runMedicineSearch(query: string, targetPage = 1) {
    if (!query.trim()) {
      setSearchError("Please enter a medicine name.");
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      const data = await searchMedicines(query.trim(), targetPage);
      setSearchResults(data);
    } catch (err) {
      console.error("Medicine search failed", err);
      setSearchError("Unable to search right now. Please try again.");
      setSearchResults(null);
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runMedicineSearch(searchQuery);
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
              <>
                <div className="camera-viewfinder">
                  <div id={CAMERA_ELEMENT_ID} />
                </div>
                <p className="page-status scan-tip">
                  Hold your phone steady, about 10–15cm from the package. Center the QR code in
                  the box, with even lighting and no glare.
                </p>
                {!isMobileDevice && (
                  <p className="page-status scan-tip warn">
                    Using a laptop or desktop webcam? Scanning may take noticeably longer than on
                    a phone — try holding the package steady close to the camera, or use manual
                    entry, photo upload, or search below instead.
                  </p>
                )}
                {showScanningTip && (
                  <p className="page-status scan-tip warn">
                    Still not scanning? Try moving a little closer or further away, or use manual
                    entry, photo upload, or search below instead.
                  </p>
                )}
              </>
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

            <div className="scan-fallback">
              <p className="page-status">Still stuck? Search for the medicine by name instead.</p>
              <form className="barcode-form" onSubmit={handleSearchSubmit}>
                <input
                  className="barcode-input"
                  type="text"
                  placeholder="e.g. Panadol"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <button type="submit" disabled={isSearching}>
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </form>
              {searchError && <p className="page-status error">{searchError}</p>}
              {searchResults && searchResults.results.length === 0 && (
                <p className="page-status">No medicines matched that search.</p>
              )}
              {searchResults && searchResults.results.length > 0 && (
                <ul className="result-list">
                  {searchResults.results.map((medicine) => (
                    <li key={medicine.id}>
                      <Link to={`/medicines/${medicine.id}`} className="search-result-card">
                        <div className="result-top">
                          <span className="result-name">{medicine.name}</span>
                        </div>
                        <div className="result-meta">Manufacturer: {medicine.manufacturer}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/search">Open full search page</Link>
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
