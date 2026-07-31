import { useState } from "react";
import type { ChangeEvent, CSSProperties, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { createReport } from "../api/reports";
import type { ReportDetail } from "../types/report";
import AuthNav from "../components/AuthNav";

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

// Must match server/src/db/seed.ts's health_authorities rows — a country
// picked here that has no matching row just means the alert email is
// skipped (logged server-side), not a hard error, but keeping this list in
// sync avoids that silently happening for every submission.
const HEALTH_AUTHORITY_COUNTRIES = ["Nigeria", "Kenya", "South Africa", "Rwanda", "Ghana"] as const;

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // 4MB raw file, comfortably under the server's base64 cap

function chipStyle(active: boolean): { border: string; background: string; color: string } {
  return active
    ? { border: "#103c1c", background: "#103c1c0f", color: "#103c1c" }
    : { border: "#1A1A2E22", background: "transparent", color: "#1A1A2E88" };
}

function StepChips({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 30, flexWrap: "wrap" }}>
      {STEPS.map((step) => {
        const s = chipStyle(step.key === current);
        return (
          <div
            key={step.key}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              border: `1.5px solid ${s.border}`,
              background: s.background,
              color: s.color,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Inter', sans-serif",
            }}
          >
            {step.label}
          </div>
        );
      })}
    </div>
  );
}

const fieldInputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "16px 18px",
  borderRadius: 999,
  border: "none",
  color: "#1A1A2E",
  fontSize: 15,
  fontFamily: "'Inter', sans-serif",
};

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

  const [country, setCountry] = useState(() => {
    const accountCountry = user?.country;
    return accountCountry && (HEALTH_AUTHORITY_COUNTRIES as readonly string[]).includes(accountCountry)
      ? accountCountry
      : "";
  });
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
        country,
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

  return (
    <div className="hk-page" style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#FDFBF7", position: "relative", display: "flex", flexDirection: "column" }}>
      <img
        src="/assets/home-bg-linen.png"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />
      <AuthNav />

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", position: "relative" }}>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 480,
            background: "#E4E7ED",
            borderRadius: 32,
            padding: "48px 44px",
            boxShadow: "0 30px 60px -24px rgba(16,60,28,0.4)",
          }}
        >
          {submittedReport ? (
            <>
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 26, margin: "0 0 10px", color: "#1A1A2E" }}>
                Report submitted
              </h1>
              <p style={{ fontSize: 14.5, color: "#1A1A2E88", margin: "0 0 22px" }}>
                Thanks for the report. Our team is reviewing it and will get back to you within the next 48 hours.
              </p>
              <div className="hk-neu-panel" style={{ borderRadius: 16, padding: 18, marginBottom: 22 }}>
                <div style={{ fontSize: 11, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: 14, color: "#1A1A2E", fontWeight: 600, marginBottom: submittedReport.productName ? 12 : 0 }}>
                  {submittedReport.status.toUpperCase()}
                </div>
                {submittedReport.productName && (
                  <>
                    <div style={{ fontSize: 11, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Product</div>
                    <div style={{ fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>{submittedReport.productName}</div>
                  </>
                )}
              </div>
              <div style={{ textAlign: "center" }}>
                <Link to="/" style={{ fontSize: 14, fontWeight: 700, color: "#103c1c" }}>Back to home</Link>
              </div>
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 30, letterSpacing: "-0.01em", margin: "0 0 10px", color: "#1A1A2E" }}>
                Report counterfeit medicine
              </h1>
              <p style={{ fontSize: 15, color: "#1A1A2E88", margin: "0 0 28px" }}>Tell us what you found so it can be investigated.</p>

              <StepChips current={step} />

              {step === "product" && (
                <form onSubmit={handleProductNext}>
                  {scanId ? (
                    <p style={{ fontSize: 14.5, color: "#1A1A2E", marginBottom: 26 }}>
                      Reporting on: <strong>{productName || "the scanned medicine"}</strong>
                    </p>
                  ) : (
                    <input
                      className="hk-neu-field"
                      type="text"
                      placeholder="Product name"
                      value={productName}
                      onChange={(event) => setProductName(event.target.value)}
                      style={{ ...fieldInputStyle, marginBottom: 26 }}
                    />
                  )}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      type="submit"
                      disabled={!hasProductInfo}
                      className="hk-neu-btn"
                      style={{ padding: "13px 34px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 14.5, fontWeight: 700, cursor: hasProductInfo ? "pointer" : "default", fontFamily: "'Inter', sans-serif" }}
                    >
                      Next
                    </button>
                  </div>
                </form>
              )}

              {step === "location" && (
                <form onSubmit={handleLocationNext}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 26 }}>
                    <select
                      className="hk-neu-field"
                      value={country}
                      onChange={(event) => setCountry(event.target.value)}
                      style={{ ...fieldInputStyle, appearance: "none" }}
                      required
                    >
                      <option value="" disabled>
                        Select country where this was found
                      </option>
                      {HEALTH_AUTHORITY_COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>

                    <input
                      className="hk-neu-field"
                      type="text"
                      placeholder="Where did you buy it? (pharmacy, city, ...)"
                      value={purchaseLocation}
                      onChange={(event) => setPurchaseLocation(event.target.value)}
                      style={fieldInputStyle}
                    />

                    <label className="hk-neu-upload" style={{ padding: "16px 18px", borderRadius: 16, color: "#1A1A2E88", fontSize: 14, textAlign: "center", cursor: "pointer" }}>
                      Upload a photo of the product or packaging (optional)
                      <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                    </label>
                    {photoDataUrl && (
                      <div className="hk-neu-panel" style={{ borderRadius: 16, padding: 12, textAlign: "center" }}>
                        <img src={photoDataUrl} alt="Attached evidence" style={{ maxWidth: "100%", borderRadius: 10 }} />
                        <button
                          type="button"
                          onClick={() => setPhotoDataUrl(null)}
                          style={{ marginTop: 8, border: "none", background: "none", color: "#b91c1c", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
                        >
                          Remove photo
                        </button>
                      </div>
                    )}
                    {photoError && <p style={{ color: "#b91c1c", fontSize: 12.5, margin: 0 }}>{photoError}</p>}
                  </div>

                  <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setStep("product")}
                      style={{ padding: "13px 28px", border: "1.5px solid #1A1A2E22", borderRadius: 999, background: "transparent", color: "#1A1A2E", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={!country}
                      className="hk-neu-btn"
                      style={{ padding: "13px 34px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 14.5, fontWeight: 700, cursor: country ? "pointer" : "default", fontFamily: "'Inter', sans-serif" }}
                    >
                      Next
                    </button>
                  </div>
                </form>
              )}

              {step === "description" && (
                <form onSubmit={handleSubmit}>
                  <textarea
                    className="hk-neu-field"
                    placeholder="Describe what made you suspicious (packaging, effects, price, seller, ...)"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    style={{ ...fieldInputStyle, borderRadius: 16, resize: "none", marginBottom: 26 }}
                  />
                  {submitError && <p style={{ color: "#b91c1c", fontSize: 13.5, marginBottom: 14 }}>{submitError}</p>}
                  <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
                    <button
                      type="button"
                      onClick={() => setStep("location")}
                      style={{ padding: "13px 28px", border: "1.5px solid #1A1A2E22", borderRadius: 999, background: "transparent", color: "#1A1A2E", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="hk-neu-btn"
                      style={{ padding: "13px 34px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 14.5, fontWeight: 700, cursor: isSubmitting ? "default" : "pointer", fontFamily: "'Inter', sans-serif" }}
                    >
                      {isSubmitting ? "Submitting..." : "Submit report"}
                    </button>
                  </div>
                </form>
              )}

              <div style={{ textAlign: "center", marginTop: 22 }}>
                <Link to="/" style={{ fontSize: 14.5, fontWeight: 600, color: "#3e4440", textDecoration: "underline" }}>
                  Back to home
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
