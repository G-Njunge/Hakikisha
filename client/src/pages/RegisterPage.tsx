import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { checkEmailAvailability } from "../api/auth";
import type { SelfRegisterRole } from "../types/auth";

const ROLES: SelfRegisterRole[] = ["consumer", "pharmacist", "manufacturer"];

type EmailCheckStatus = "idle" | "checking" | "ok" | "invalid" | "taken" | "error";

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
    <div>
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="fullName">Full name</label>
          <br />
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailCheckStatus("idle");
            }}
            onBlur={handleEmailBlur}
            required
          />
          {emailCheckStatus === "checking" && <p>Checking email...</p>}
          {emailCheckStatus === "invalid" && <p>That doesn't look like a valid email address.</p>}
          {emailCheckStatus === "taken" && <p>That email is already registered.</p>}
        </div>

        <div>
          <label htmlFor="country">Country</label>
          <br />
          <input
            id="country"
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>

        <div>
          <label htmlFor="role">Role</label>
          <br />
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as SelfRegisterRole)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <br />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Registering..." : "Register"}
        </button>
      </form>

      {error && <p>{error}</p>}

      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
