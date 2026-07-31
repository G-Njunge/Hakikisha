import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { changePassword } from "../api/auth";
import { getMyScans } from "../api/scans";
import { getMyReports } from "../api/reports";
import type { ScanHistoryItem, ScanResultCode } from "../types/scan";
import type { ReportStatus, ReportSummary } from "../types/report";
import AuthNav from "../components/AuthNav";

type Tab = "scans" | "reports" | "settings";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "scans", label: "Scan history" },
  { key: "reports", label: "My reports" },
  { key: "settings", label: "Account settings" },
];

function scanResultBadge(result: ScanResultCode): { bg: string; color: string } {
  switch (result) {
    case "authentic":
      return { bg: "#5fbf7d", color: "#2f8f52" };
    case "expired":
      return { bg: "#b8862f", color: "#b8862f" };
    case "counterfeit":
      return { bg: "#ff6b6b", color: "#d94f4f" };
    default:
      return { bg: "#3e4440", color: "#3e4440" };
  }
}

function reportStatusLabel(status: ReportStatus): string {
  switch (status) {
    case "pending":
      return "PENDING";
    case "investigating":
      return "UNDER REVIEW";
    case "resolved":
      return "RESOLVED";
    case "dismissed":
      return "DISMISSED";
  }
}

function reportStatusColor(status: ReportStatus): string {
  return status === "resolved" ? "#2f8f52" : "#b8862f";
}

const tabButtonStyle = (active: boolean): CSSProperties => ({
  padding: "11px 24px",
  border: `1.5px solid ${active ? "#103c1c" : "#1A1A2E22"}`,
  borderRadius: 999,
  background: active ? "#103c1c" : "transparent",
  color: active ? "#FDFBF7" : "#1A1A2E88",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "'Inter', sans-serif",
});

const settingsInputStyle: CSSProperties = {
  padding: "14px 18px",
  borderRadius: 999,
  fontSize: 14.5,
  fontFamily: "'Inter', sans-serif",
  color: "#1A1A2E",
  border: "none",
  width: "100%",
  boxSizing: "border-box",
  marginBottom: 12,
};

export default function DashboardPage() {
  const { user, updateDisplayName } = useAuth();
  const [tab, setTab] = useState<Tab>("scans");

  const [scans, setScans] = useState<ScanHistoryItem[] | null>(null);
  const [scansError, setScansError] = useState<string | null>(null);

  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user?.fullName ?? "");
  const [nameStatus, setNameStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  useEffect(() => {
    if (!user) return;

    getMyScans()
      .then(setScans)
      .catch((err) => {
        console.error("Failed to load scan history", err);
        setScansError("Unable to load scan history.");
      });

    getMyReports()
      .then(setReports)
      .catch((err) => {
        console.error("Failed to load report history", err);
        setReportsError("Unable to load report history.");
      });
  }, [user]);

  // Adjusts displayName in response to `user` changing (e.g. once the
  // authenticated user loads after mount) during render rather than via an
  // effect + synchronous setState, per React's recommended pattern for
  // syncing state to a prop change.
  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (user) setDisplayName(user.fullName);
  }

  async function handleNameSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim()) {
      setNameStatus({ type: "error", message: "Display name can't be empty." });
      return;
    }

    setNameStatus({ type: "saving" });
    try {
      await updateDisplayName(displayName.trim());
      setNameStatus({ type: "success", message: "Display name updated." });
    } catch (err) {
      console.error("Failed to update display name", err);
      setNameStatus({ type: "error", message: "Unable to update display name. Please try again." });
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword.length < 8) {
      setPasswordStatus({ type: "error", message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", message: "New passwords don't match." });
      return;
    }

    setPasswordStatus({ type: "saving" });
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus({ type: "success", message: "Password changed." });
    } catch (err) {
      console.error("Failed to change password", err);
      if (isAxiosError(err) && err.response?.status === 401) {
        setPasswordStatus({ type: "error", message: "Current password is incorrect." });
      } else if (isAxiosError(err) && err.response) {
        setPasswordStatus({
          type: "error",
          message: (err.response.data as { error?: string })?.error ?? "Unable to change password.",
        });
      } else {
        setPasswordStatus({ type: "error", message: "Unable to change password. Please try again." });
      }
    }
  }

  // ProtectedRoute already redirects to /login before this renders when
  // logged out; this is just a type-narrowing guard for the render below.
  if (!user) {
    return null;
  }

  return (
    <div className="hk-page" style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#FDFBF7", position: "relative" }}>
      <img
        src="/assets/home-bg-linen.png"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />
      <AuthNav />

      <section style={{ padding: "56px 56px 20px", maxWidth: 1160, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.01em", margin: "0 0 8px", color: "#1A1A2E" }}>
          My dashboard
        </h1>
        <p style={{ fontSize: 14.5, color: "#1A1A2E88", margin: 0 }}>
          Every pack you've scanned and every report you've filed, in one place.
        </p>
      </section>

      <section style={{ padding: "20px 56px 0", maxWidth: 1160, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {TABS.map((t) => (
            <button key={t.key} type="button" className="hk-tab" onClick={() => setTab(t.key)} style={tabButtonStyle(t.key === tab)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: "24px 56px 90px", maxWidth: 1160, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {tab === "scans" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {scansError && <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{scansError}</p>}
            {!scansError && !scans && <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>Loading scan history...</p>}
            {scans && scans.length === 0 && (
              <div className="hk-card" style={{ borderRadius: 20, padding: 40, textAlign: "center", color: "#1A1A2E88", fontSize: 14.5 }}>
                No scans yet. Verify a pack from the home page to see it here.
              </div>
            )}
            {scans &&
              scans.length > 0 &&
              scans.map((scan) => {
                const badge = scanResultBadge(scan.result);
                return (
                  <div key={scan.id} className="hk-card" style={{ borderRadius: 20, padding: "22px 26px", display: "flex", alignItems: "center", gap: 20 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: "50%",
                        background: badge.bg,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 19, color: "#FDFBF7", fontWeight: 800 }}>{scan.result === "authentic" ? "✓" : "!"}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#1A1A2E" }}>
                        {scan.medicineName ?? scan.barcode ?? "Unknown"}
                      </div>
                      <div style={{ fontSize: 13, color: "#1A1A2E77", marginTop: 2 }}>Barcode: {scan.barcode ?? "Unknown"}</div>
                      {scan.medicineId && (
                        <Link to={`/medicines/${scan.medicineId}`} style={{ fontSize: 12.5, fontWeight: 600, color: "#103c1c" }}>
                          View medicine details
                        </Link>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", color: badge.color, textTransform: "uppercase" }}>
                        {scan.result}
                      </div>
                      <div style={{ fontSize: 12, color: "#1A1A2E66", marginTop: 2 }}>{new Date(scan.scannedAt).toLocaleString()}</div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {tab === "reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {reportsError && <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{reportsError}</p>}
            {!reportsError && !reports && <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>Loading report history...</p>}
            {reports && reports.length === 0 && (
              <div className="hk-card" style={{ borderRadius: 20, padding: 40, textAlign: "center", color: "#1A1A2E88", fontSize: 14.5 }}>
                You haven't filed any reports yet.
              </div>
            )}
            {reports &&
              reports.length > 0 &&
              reports.map((report) => (
                <div key={report.id} className="hk-card" style={{ borderRadius: 20, padding: "22px 26px", display: "flex", alignItems: "center", gap: 20 }}>
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      background: "#3e4440",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 18, color: "#FDFBF7" }}>⚑</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#1A1A2E" }}>
                      {report.productName ?? "Unknown product"}
                    </div>
                    <div style={{ fontSize: 13, color: "#1A1A2E77", marginTop: 2 }}>{report.description}</div>
                    {report.purchaseLocation && (
                      <div style={{ fontSize: 12.5, color: "#1A1A2E77" }}>Bought at: {report.purchaseLocation}</div>
                    )}
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.03em", color: reportStatusColor(report.status) }}>
                      {reportStatusLabel(report.status)}
                    </div>
                    <div style={{ fontSize: 12, color: "#1A1A2E66", marginTop: 2 }}>{new Date(report.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
          </div>
        )}

        {tab === "settings" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 440 }}>
            <div className="hk-neu-panel" style={{ borderRadius: 24, padding: 28 }}>
              <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 17, margin: "0 0 16px", color: "#1A1A2E" }}>
                Display name
              </h2>
              <form onSubmit={handleNameSubmit}>
                <input
                  className="hk-neu-field"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  style={settingsInputStyle}
                />
                <button type="submit" disabled={nameStatus.type === "saving"} className="hk-neu-btn" style={{ padding: "12px 24px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                  {nameStatus.type === "saving" ? "Saving..." : "Save"}
                </button>
                {nameStatus.type === "success" && <p style={{ fontSize: 13, color: "#2f8f52", marginTop: 10 }}>{nameStatus.message}</p>}
                {nameStatus.type === "error" && <p style={{ fontSize: 13, color: "#b91c1c", marginTop: 10 }}>{nameStatus.message}</p>}
              </form>
            </div>

            <div className="hk-neu-panel" style={{ borderRadius: 24, padding: 28 }}>
              <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 17, margin: "0 0 16px", color: "#1A1A2E" }}>
                Change password
              </h2>
              <form onSubmit={handlePasswordSubmit}>
                <input
                  className="hk-neu-field"
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  style={settingsInputStyle}
                />
                <input
                  className="hk-neu-field"
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  style={settingsInputStyle}
                />
                <input
                  className="hk-neu-field"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  style={settingsInputStyle}
                />
                <button type="submit" disabled={passwordStatus.type === "saving"} className="hk-neu-btn" style={{ padding: "12px 24px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                  {passwordStatus.type === "saving" ? "Changing..." : "Change password"}
                </button>
                {passwordStatus.type === "success" && <p style={{ fontSize: 13, color: "#2f8f52", marginTop: 10 }}>{passwordStatus.message}</p>}
                {passwordStatus.type === "error" && <p style={{ fontSize: 13, color: "#b91c1c", marginTop: 10 }}>{passwordStatus.message}</p>}
              </form>
            </div>
          </div>
        )}
      </section>

      <footer style={{ padding: "22px 64px", background: "#103c1c", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
