import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface LocationState {
  from?: string;
}

const fieldLabelStyle = { fontSize: 13, fontWeight: 600, color: "#1A1A2Eaa", paddingLeft: 6 };
const fieldInputStyle = {
  padding: "16px 20px",
  borderRadius: 999,
  fontSize: 15,
  fontFamily: "'Inter', sans-serif",
  color: "#1A1A2E",
  border: "none",
  width: "100%",
  boxSizing: "border-box" as const,
};

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as LocationState | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email, password }, remember);
      navigate(from, { replace: true });
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        "Login failed";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="hk-page" style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#FDFBF7", display: "flex", flexDirection: "column" }}>
      <nav
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 56px",
          borderBottom: "1px solid #1A1A2E12",
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.01em",
            color: "#1A1A2E",
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#103c1c", display: "inline-block" }} />
          HAKIKISHA
        </Link>
        <div style={{ fontSize: 14, color: "#1A1A2E99" }}>
          New here? <Link to="/register" style={{ fontWeight: 600, color: "#103c1c" }}>Create an account</Link>
        </div>
      </nav>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", background: "#E4E7ED" }}>
        <div style={{ width: "42%", position: "relative", overflow: "hidden" }}>
          <img
            src="/assets/login-abstract.png"
            alt="Abstract geometric composition"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              filter: "sepia(1) hue-rotate(70deg) saturate(2.4) brightness(0.75)",
              opacity: 0.7,
            }}
          />
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "56px 24px 48px" }}>
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
            }}
          >
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: 999,
                  background: "#E4E7ED",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#103c1c",
                  marginBottom: 18,
                  boxShadow: "5px 5px 10px #babecc, -5px -5px 10px #ffffff",
                }}
              >
                Welcome back
              </div>
            </div>
            <h1
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: 30,
                letterSpacing: "-0.01em",
                margin: "0 0 30px",
                textAlign: "center",
                color: "#1A1A2E",
              }}
            >
              Log in to Hakikisha
            </h1>

            <form style={{ display: "flex", flexDirection: "column", gap: 22 }} onSubmit={handleSubmit}>
              <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={fieldLabelStyle}>Email</span>
                <input
                  className="hk-neu-field"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={fieldInputStyle}
                  required
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingRight: 6 }}>
                  <span style={fieldLabelStyle}>Password</span>
                  <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: 12.5, fontWeight: 600, color: "#1A1A2E88" }}>
                    Forgot password?
                  </a>
                </div>
                <input
                  className="hk-neu-field"
                  type="password"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={fieldInputStyle}
                  required
                />
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: "#1A1A2E99", paddingLeft: 6 }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#103c1c" }}
                />
                Keep me logged in
              </label>

              {error && <p style={{ color: "#b91c1c", fontSize: 13.5, margin: 0 }}>{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="hk-neu-btn"
                style={{
                  marginTop: 6,
                  position: "relative",
                  padding: 17,
                  border: "none",
                  borderRadius: 999,
                  background: "#103c1c",
                  color: "#FDFBF7",
                  fontSize: 15.5,
                  fontWeight: 700,
                  cursor: isSubmitting ? "default" : "pointer",
                  fontFamily: "'Inter', sans-serif",
                  boxShadow: "8px 8px 16px #babecc, -8px -8px 16px #ffffff",
                }}
              >
                {isSubmitting ? "Logging in..." : "Log in"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 26, fontSize: 14, color: "#1A1A2E88" }}>
              Don't have an account? <Link to="/register" style={{ fontWeight: 700, color: "#103c1c" }}>Register</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
