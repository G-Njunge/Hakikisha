import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { getMedicineVerificationProfile, getNearbyPharmacies, verifyBarcode } from "../api/medicines";
import type {
  BarcodeVerificationResult,
  MedicineVerificationProfile,
  NearbyPharmacy,
} from "../types/medicine";

type Step = "scan" | "identified" | "photos" | "package" | "safety" | "pharmacy";

const STEPS: Array<{ key: Step; label: string }> = [
  { key: "scan", label: "Scan" },
  { key: "identified", label: "Medicine identified" },
  { key: "photos", label: "Reference photos" },
  { key: "package", label: "Package verification" },
  { key: "safety", label: "Safety information" },
  { key: "pharmacy", label: "Nearby pharmacy" },
];

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
  const [barcode, setBarcode] = useState("");
  const [step, setStep] = useState<Step>("scan");
  const [scanResult, setScanResult] = useState<BarcodeVerificationResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [profile, setProfile] = useState<MedicineVerificationProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [comparisonChecks, setComparisonChecks] = useState<Record<string, boolean>>({});

  const [pharmacies, setPharmacies] = useState<NearbyPharmacy[] | null>(null);
  const [pharmacyStatus, setPharmacyStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);

  function resetFlow() {
    setBarcode("");
    setStep("scan");
    setScanResult(null);
    setScanError(null);
    setProfile(null);
    setProfileError(null);
    setComparisonChecks({});
    setPharmacies(null);
    setPharmacyStatus("idle");
    setPharmacyError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!barcode.trim()) {
      setScanError("Please enter a barcode.");
      setScanResult(null);
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    try {
      const response = await verifyBarcode(barcode.trim());
      setScanResult(response);
      if (response.found) {
        setStep("identified");
      }
    } catch (err) {
      console.error("Barcode verification failed", err);
      setScanError("Unable to verify barcode. Please try again.");
    } finally {
      setIsScanning(false);
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
            <form className="barcode-form" onSubmit={handleSubmit}>
              <input
                className="barcode-input"
                type="text"
                placeholder="Enter barcode number"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
              />
              <button type="submit" disabled={isScanning}>
                {isScanning ? "Verifying..." : "Verify"}
              </button>
            </form>

            {scanError && <p className="page-status error">{scanError}</p>}

            {scanResult && !scanResult.found && (
              <div className="barcode-result">
                <h2>Unknown Product</h2>
                <p>This barcode does not exist in the Hakikisha database.</p>
                <p>This does NOT necessarily mean the medicine is counterfeit.</p>
                <p>Please verify with the manufacturer or pharmacy.</p>
              </div>
            )}
          </>
        )}

        {step === "identified" && scanResult?.medicine && (
          <div className="barcode-result">
            <h2>✓ Medicine identified</h2>
            <p>{scanResult.medicine.name}</p>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Manufacturer</span>
                <span className="detail-value">{scanResult.medicine.manufacturer}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Batch</span>
                <span className="detail-value">{scanResult.batchNumber ?? "Not listed"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Expiry</span>
                <span className="detail-value">{scanResult.expiryDate ?? "Not listed"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Registration status</span>
                <span className="detail-value">{scanResult.registrationStatus ?? "Not listed"}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Verification status</span>
                <span className="detail-value">{scanResult.verificationStatus ?? "Not listed"}</span>
              </div>
            </div>
            <p className="page-link-row">
              <button type="button" onClick={goToPhotos}>
                Continue to reference photos
              </button>
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
