import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

type Stage = "confirm" | "done";

export default function LogoutPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("confirm");

  async function handleConfirm() {
    await logout();
    setStage("done");
  }

  return (
    <div
      className="hk-page"
      style={{
        minHeight: "100vh",
        width: "100%",
        overflowX: "hidden",
        background: "#FDFBF7",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <img
        src="/assets/home-bg-linen.png"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />

      {stage === "confirm" && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 420,
            background: "#E4E7ED",
            borderRadius: 32,
            padding: "48px 40px",
            boxShadow: "0 30px 60px -24px rgba(16,60,28,0.4)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <img src="/assets/hakikisha-logo.png" alt="Hakikisha" style={{ height: 56, width: "auto" }} />
          <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: "#1A1A2E" }}>
            Log out of Hakikisha?
          </h1>
          <p style={{ fontSize: 14.5, color: "#1A1A2E88", margin: 0, lineHeight: 1.6 }}>
            You'll need to sign back in to scan, report, or view your dashboard.
          </p>
          <div style={{ display: "flex", gap: 12, width: "100%", marginTop: 6 }}>
            <button
              type="button"
              onClick={() => navigate(-1)}
              style={{
                flex: 1,
                padding: 15,
                border: "1.5px solid #1A1A2E22",
                borderRadius: 999,
                background: "transparent",
                color: "#1A1A2E",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="hk-neu-btn"
              style={{
                flex: 1,
                padding: 15,
                border: "none",
                borderRadius: 999,
                background: "#103c1c",
                color: "#FDFBF7",
                fontSize: 14.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              Log out
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 420,
            background: "#E4E7ED",
            borderRadius: 32,
            padding: "48px 40px",
            boxShadow: "0 30px 60px -24px rgba(16,60,28,0.4)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
          }}
        >
          <img src="/assets/hakikisha-logo.png" alt="Hakikisha" style={{ height: 56, width: "auto" }} />
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#103c1c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 24, color: "#FDFBF7" }}>✓</span>
          </div>
          <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 22, margin: 0, color: "#1A1A2E" }}>
            Thank you for using Hakikisha
          </h1>
          <p style={{ fontSize: 14.5, color: "#1A1A2E88", margin: 0, lineHeight: 1.6 }}>You have successfully logged out.</p>
          <Link
            to="/login"
            className="hk-neu-btn"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 15,
              borderRadius: 999,
              background: "#103c1c",
              color: "#FDFBF7",
              fontSize: 15,
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            Log back in
          </Link>
          <Link to="/" style={{ fontSize: 13.5, fontWeight: 600, color: "#3e4440", textDecoration: "underline" }}>
            Back to homepage
          </Link>
        </div>
      )}
    </div>
  );
}
