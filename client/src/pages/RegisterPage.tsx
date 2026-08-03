import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { checkEmailAvailability } from "../api/auth";
import type { SelfRegisterRole } from "../types/auth";
import { PASSWORD_REQUIREMENTS } from "../utils/passwordPolicy";

const ROLES: { value: SelfRegisterRole; label: string }[] = [
  { value: "consumer", label: "Consumer" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "manufacturer", label: "Manufacturer" },
];

// Full country names (not ISO codes) to stay consistent with how country is
// used elsewhere — health_authorities/report routing matches on full name.
const COUNTRIES = ["Nigeria", "Kenya", "South Africa", "Rwanda", "Ghana", "Uganda", "Tanzania", "Other"];

type EmailCheckStatus = "idle" | "checking" | "ok" | "invalid" | "taken" | "error";

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

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SelfRegisterRole>("consumer");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [emailCheckStatus, setEmailCheckStatus] = useState<EmailCheckStatus>("idle");

  async function handleEmailBlur() {
    if (!email.trim()) {
      setEmailCheckStatus("idle");
      return;
    }

    setEmailCheckStatus("checking");
    try {
      const result = await checkEmailAvailability(email.trim());
      if (!result.validFormat) {
        setEmailCheckStatus("invalid");
      } else if (result.available === false) {
        setEmailCheckStatus("taken");
      } else {
        setEmailCheckStatus("ok");
      }
    } catch (err) {
      console.error("Failed to check email", err);
      setEmailCheckStatus("error");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (emailCheckStatus === "invalid") {
      setError("That doesn't look like a valid email address.");
      return;
    }
    if (emailCheckStatus === "taken") {
      setError("That email is already registered.");
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ fullName, email, country, password, role });
      navigate("/login");
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        "Registration failed";
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
          Already verifying? <Link to="/login" style={{ fontWeight: 600, color: "#103c1c" }}>Log in</Link>
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
              maxWidth: 440,
              background: "#E4E7ED",
              borderRadius: 32,
              padding: "48px 40px",
              boxShadow: "0 30px 60px -24px rgba(16,60,28,0.4)",
            }}
          >
            <h1
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: 30,
                letterSpacing: "-0.01em",
                margin: "0 0 8px",
                textAlign: "center",
                color: "#1A1A2E",
              }}
            >
              Create your account
            </h1>
            <p style={{ fontSize: 14.5, color: "#1A1A2E88", textAlign: "center", margin: "0 0 32px" }}>
              Verify before you trust, start scanning in minutes.
            </p>

            <form style={{ display: "flex", flexDirection: "column", gap: 22 }} onSubmit={handleSubmit}>
              <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={fieldLabelStyle}>Full name</span>
                <input
                  className="hk-neu-field"
                  type="text"
                  placeholder="Jane Njoroge"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  style={fieldInputStyle}
                  required
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={fieldLabelStyle}>Email</span>
                <input
                  className="hk-neu-field"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailCheckStatus("idle");
                  }}
                  onBlur={handleEmailBlur}
                  style={fieldInputStyle}
                  required
                />
                {emailCheckStatus === "checking" && (
                  <span style={{ fontSize: 12.5, color: "#1A1A2E88", paddingLeft: 6 }}>Checking email...</span>
                )}
                {emailCheckStatus === "invalid" && (
                  <span style={{ fontSize: 12.5, color: "#b91c1c", paddingLeft: 6 }}>That doesn't look like a valid email address.</span>
                )}
                {emailCheckStatus === "taken" && (
                  <span style={{ fontSize: 12.5, color: "#b91c1c", paddingLeft: 6 }}>That email is already registered.</span>
                )}
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={fieldLabelStyle}>Country</span>
                <select
                  className="hk-neu-field"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  style={{ ...fieldInputStyle, appearance: "none" }}
                  required
                >
                  <option value="" disabled>
                    Select country
                  </option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={fieldLabelStyle}>Password</span>
                <input
                  className="hk-neu-field"
                  type="password"
                  placeholder="8+ characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  style={fieldInputStyle}
                  required
                />
                {password.length > 0 && (
                  <ul style={{ listStyle: "none", margin: 0, padding: "0 6px", display: "flex", flexDirection: "column", gap: 3 }}>
                    {PASSWORD_REQUIREMENTS.map((req) => {
                      const met = req.test(password);
                      return (
                        <li key={req.key} style={{ fontSize: 12.5, color: met ? "#2f8f52" : "#1A1A2E77" }}>
                          {met ? "✓" : "○"} {req.label}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                <span style={fieldLabelStyle}>Role</span>
                <select
                  className="hk-neu-field"
                  value={role}
                  onChange={(e) => setRole(e.target.value as SelfRegisterRole)}
                  style={{ ...fieldInputStyle, appearance: "none" }}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>

              {error && <p style={{ color: "#b91c1c", fontSize: 13.5, margin: 0 }}>{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="hk-neu-btn"
                style={{
                  marginTop: 10,
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
                {isSubmitting ? "Registering..." : "Register"}
              </button>
            </form>

            <div style={{ textAlign: "center", marginTop: 22, fontSize: 14, color: "#1A1A2E88" }}>
              Already have an account? <Link to="/login" style={{ fontWeight: 700, color: "#103c1c" }}>Log in</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
