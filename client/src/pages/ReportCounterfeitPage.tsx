import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { createReport } from "../api/reports";
import type { ReportDetail } from "../types/report";

type Step = "product" | "location" | "description";

const STEPS: Array<{ key: Step; label: string }> = [
  { key: "product", label: "Product" },
  { key: "location", label: "Location & photo" },
  { key: "description", label: "Description" },
];

interface LocationState {
  scanId?: string;
  productName?: string;
}

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB raw file, comfortably under the server's base64 cap

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ReportCounterfeitPage() {
  const { user } = useAuth();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const [step, setStep] = useState<Step>("product");

  const [scanId] = useState<string | undefined>(state?.scanId);
  const [productName, setProductName] = useState(state?.productName ?? "");

  const [purchaseLocation, setPurchaseLocation] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<ReportDetail | null>(null);

  const hasProductInfo = !!scanId || productName.trim().length > 0;

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setPhotoError(null);

    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("That photo is too large (max 4MB). Try a smaller image.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setPhotoDataUrl(dataUrl);
    } catch (err) {
      console.error("Failed to read photo", err);
      setPhotoError("Couldn't read that photo. Please try another file.");
    }
  }

  function handleProductNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasProductInfo) return;
    setStep("location");
  }

  function handleLocationNext(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStep("description");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!description.trim()) {
      setSubmitError("Please describe what made you suspicious.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const report = await createReport({
        scanId,
        productName: productName.trim() || undefined,
        description: description.trim(),
        purchaseLocation: purchaseLocation.trim() || undefined,
        photoUrl: photoDataUrl ?? undefined,
      });
      setSubmittedReport(report);
    } catch (err) {
      console.error("Failed to submit report", err);
      if (isAxiosError(err) && err.response && err.response.status < 500) {
        setSubmitError((err.response.data as { error?: string })?.error ?? "Please check your report and try again.");
      } else if (isAxiosError(err) && !err.response) {
        setSubmitError("Network error — check your connection and try again.");
      } else {
        setSubmitError("Something went wrong submitting your report. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ProtectedRoute already redirects to /login before this renders when
  // logged out; this is just a type-narrowing guard for the render below.
  if (!user) {
    return null;
  }

  if (submittedReport) {
    return (
      <main className="page-shell">
        <section className="page-card">
          <div className="scan-card unverified">
            <h2>Report submitted</h2>
            <p>Thanks for the report. Our team is reviewing it and will get back to you within the next 48 hours.</p>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">{submittedReport.status.toUpperCase()}</span>
              </div>
              {submittedReport.productName && (
                <div className="detail-item">
                  <span className="detail-label">Product</span>
                  <span className="detail-value">{submittedReport.productName}</span>
                </div>
              )}
            </div>
          </div>
          <p className="page-link-row">
            <Link to="/">Back to home</Link>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="page-card">
        <h1 className="page-title">Report counterfeit medicine</h1>
        <p className="page-subtitle">Tell us what you found so it can be investigated.</p>

        <StepIndicator current={step} />

        {step === "product" && (
          <form onSubmit={handleProductNext}>
            {scanId ? (
              <p className="page-status">
                Reporting on: <strong>{productName || "the scanned medicine"}</strong>
              </p>
            ) : (
              <input
                className="barcode-input"
                type="text"
                placeholder="Product name"
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
              />
            )}
            <p className="page-link-row">
              <button type="submit" disabled={!hasProductInfo}>
                Next
              </button>
            </p>
          </form>
        )}

        {step === "location" && (
          <form onSubmit={handleLocationNext}>
            <input
              className="barcode-input"
              type="text"
              placeholder="Where did you buy it? (pharmacy, city, ...)"
              value={purchaseLocation}
              onChange={(event) => setPurchaseLocation(event.target.value)}
            />

            <div className="scan-fallback">
              <p className="page-status">Add a photo of the product or packaging (optional)</p>
              <label className="file-upload-button">
                Upload photo
                <input type="file" accept="image/*" onChange={handlePhotoChange} hidden />
              </label>
              {photoDataUrl && (
                <div className="photo-card" style={{ marginTop: 12 }}>
                  <img src={photoDataUrl} alt="Attached evidence" />
                  <button type="button" onClick={() => setPhotoDataUrl(null)}>
                    Remove photo
                  </button>
                </div>
              )}
            </div>
            {photoError && <p className="page-status error">{photoError}</p>}

            <p className="page-link-row">
              <button type="button" onClick={() => setStep("product")}>
                Back
              </button>{" "}
              <button type="submit">Next</button>
            </p>
          </form>
        )}

        {step === "description" && (
          <form onSubmit={handleSubmit}>
            <textarea
              className="barcode-input"
              style={{ width: "100%", minHeight: 120, boxSizing: "border-box" }}
              placeholder="Describe what made you suspicious (packaging, effects, price, seller, ...)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            {submitError && <p className="page-status error">{submitError}</p>}
            <p className="page-link-row">
              <button type="button" onClick={() => setStep("location")}>
                Back
              </button>{" "}
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </p>
          </form>
        )}

        <p className="page-link-row">
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
