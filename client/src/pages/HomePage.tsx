import { useState } from "react";
import type { ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LandingPage from "./LandingPage";
import AuthNav from "../components/AuthNav";
import { decodeBarcodeFromFile } from "../utils/zxingFileDecoder";

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  const [manualCode, setManualCode] = useState("");
  const [isFileScanning, setIsFileScanning] = useState(false);
  const [fileScanError, setFileScanError] = useState<string | null>(null);

  function activateCamera() {
    navigate("/barcode?method=camera");
  }

  function verifyManualCode() {
    if (!manualCode.trim()) return;
    navigate(`/barcode?code=${encodeURIComponent(manualCode.trim())}`);
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setFileScanError(null);
    setIsFileScanning(true);

    console.log("[photo-scan] file selected", { name: file.name, type: file.type, sizeBytes: file.size });

    try {
      const decodedText = await decodeBarcodeFromFile(file);
      console.log("[photo-scan] decoded:", decodedText);
      navigate(`/barcode?code=${encodeURIComponent(decodedText)}`);
    } catch (err) {
      console.error("[photo-scan] Failed to read code from image — full error object:", err);
      setFileScanError("Couldn't find a scannable code in that photo. Try a clearer, well-lit shot.");
    } finally {
      setIsFileScanning(false);
    }
  }

  if (isLoading) {
    return <p style={{ padding: 56, fontFamily: "'Inter', sans-serif" }}>Loading...</p>;
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="hk-page" style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#FDFBF7", position: "relative" }}>
      <img
        src="/assets/home-bg-linen.png"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />

      <AuthNav showRoleCountry />

      <section style={{ padding: "var(--hk-pad-y) var(--hk-pad-x) 20px", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h1
          style={{
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: 38,
            letterSpacing: "-0.01em",
            margin: "0 0 10px",
            color: "#1A1A2E",
          }}
        >
          Welcome back, {user.fullName.split(" ")[0] || "there"}
        </h1>
      </section>

      <section style={{ padding: "28px var(--hk-pad-x) 0", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "left", marginBottom: 26 }}>
          <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 28, margin: "0 0 8px", color: "#1A1A2E" }}>
            Verify a pack
          </h2>
          <p style={{ fontSize: 14.5, color: "#1A1A2E88", margin: 0 }}>Three ways to check it. Pick whichever works for you.</p>
        </div>

        <div className="hk-grid-12" style={{ display: "grid", gap: 22 }}>
          <div
            style={{
              gridColumn: "span 7",
              background: "#103c1c",
              border: "1.5px solid #ffffff18",
              borderRadius: "44px 20px 44px 20px",
              padding: 34,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              boxShadow: "0 30px 60px -28px rgba(16,60,28,0.45)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 18, color: "#FDFBF7" }}>Scan with camera</div>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#5fbf7d", animation: "hk-pulse 1.6s ease-out infinite" }} />
            </div>
            <p style={{ fontSize: 13.5, color: "#FDFBF7aa", margin: 0, lineHeight: 1.5 }}>
              Line up the barcode to the frame. We'll check it the moment it's in focus.
            </p>
            <button
              type="button"
              onClick={activateCamera}
              style={{
                alignSelf: "flex-start",
                padding: "13px 28px",
                border: "none",
                borderRadius: 999,
                background: "#FDFBF7",
                color: "#103c1c",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Activate camera
            </button>
          </div>

          <div style={{ gridColumn: "span 5", display: "flex", flexDirection: "column", gap: 22 }}>
            <div
              className="hk-card"
              style={{
                background: "#3e4440",
                border: "1.5px solid #1A1A2E22",
                borderRadius: "16px 40px 16px 40px",
                padding: 26,
                display: "flex",
                flexDirection: "column",
                gap: 12,
                transform: "rotate(1deg)",
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#FDFBF7" }}>Enter code manually</div>
              <input
                className="hk-neu-field"
                type="text"
                inputMode="numeric"
                placeholder="Barcode number"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                style={{ padding: "13px 16px", borderRadius: 999, color: "#1A1A2E", fontSize: 14, fontFamily: "'Inter', sans-serif", border: "none" }}
              />
              <button
                type="button"
                onClick={verifyManualCode}
                style={{
                  padding: "11px 20px",
                  border: "none",
                  borderRadius: 999,
                  background: "#5fbf7d",
                  color: "#0c2f16",
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Verify
              </button>
            </div>

            <div
              className="hk-card"
              style={{
                borderRadius: "40px 16px 40px 16px",
                padding: 26,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 12,
                transform: "rotate(-1deg)",
              }}
            >
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1A1A2E" }}>Upload a photo</div>
              <label
                className="hk-neu-upload"
                style={{ padding: "11px 22px", borderRadius: 999, color: "#1A1A2E88", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}
              >
                {isFileScanning ? "Reading photo..." : "Choose photo"}
                <input type="file" accept="image/*" onChange={handleUpload} disabled={isFileScanning} hidden />
              </label>
              {fileScanError && <div style={{ fontSize: 12.5, color: "#b91c1c" }}>{fileScanError}</div>}
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "44px var(--hk-pad-x) 80px", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h3 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 20, color: "#1A1A2E", margin: "0 0 20px" }}>Quick actions</h3>
        <div className="hk-grid-3" style={{ display: "grid", gap: 20 }}>
          <Link
            to="/report"
            className="hk-card"
            style={{ display: "flex", flexDirection: "column", gap: 14, padding: 26, borderRadius: 22, color: "#1A1A2E" }}
          >
            <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16 }}>Report counterfeit</div>
            <div style={{ fontSize: 13.5, color: "#1A1A2E88", lineHeight: 1.5 }}>Flag a suspicious pack to help protect others.</div>
          </Link>

          <Link
            to="/pharmacy"
            className="hk-card"
            style={{ display: "flex", flexDirection: "column", gap: 14, padding: 26, borderRadius: 22, color: "#1A1A2E" }}
          >
            <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16 }}>Nearby pharmacy</div>
            <div style={{ fontSize: 13.5, color: "#1A1A2E88", lineHeight: 1.5 }}>Find a verified pharmacy close to you.</div>
          </Link>

          <Link
            to="/dashboard"
            className="hk-card"
            style={{ display: "flex", flexDirection: "column", gap: 14, padding: 26, borderRadius: 22, color: "#1A1A2E" }}
          >
            <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16 }}>My dashboard</div>
            <div style={{ fontSize: 13.5, color: "#1A1A2E88", lineHeight: 1.5 }}>View your scan history and saved reports.</div>
          </Link>
        </div>
      </section>

      <footer style={{ padding: "22px var(--hk-pad-x)", background: "#103c1c", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#ffffff66" }}>© 2026 Hakikisha</div>
          <img
            src="/assets/hakikisha-logo.png"
            alt="Hakikisha"
            style={{ height: 48, width: "auto", display: "block", filter: "brightness(0) saturate(100%) invert(1)" }}
          />
        </div>
      </footer>
    </div>
  );
}
