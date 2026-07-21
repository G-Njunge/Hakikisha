import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { changePassword } from "../api/auth";
import { getMyScans } from "../api/scans";
import { getMyReports } from "../api/reports";
import type { ScanHistoryItem, ScanResultCode } from "../types/scan";
import type { ReportStatus, ReportSummary } from "../types/report";

type Tab = "scans" | "reports" | "settings";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "scans", label: "Scan History" },
  { key: "reports", label: "Report History" },
  { key: "settings", label: "Account Settings" },
];

function scanResultBadgeClass(result: ScanResultCode): string {
  switch (result) {
    case "authentic":
      return "status-badge approved";
    case "expired":
      return "status-badge expired";
    case "counterfeit":
      return "status-badge rejected";
    default:
      return "status-badge pending";
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

function reportStatusBadgeClass(status: ReportStatus): string {
  switch (status) {
    case "resolved":
      return "status-badge approved";
    case "dismissed":
      return "status-badge rejected";
    default:
      return "status-badge pending";
  }
}

export default function DashboardPage() {
  const { user, logout, updateDisplayName } = useAuth();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (user) setDisplayName(user.fullName);
  }, [user]);

  async function handleLogout() {
    await logout();
    navigate("/login");
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
    <main className="page-shell">
      <section className="page-card">
        <h1 className="page-title">My dashboard</h1>
        <p className="page-subtitle">
          {user.fullName} ({user.email})
        </p>

        <ol className="step-indicator">
          {TABS.map((t) => (
            <li
              key={t.key}
              className={t.key === tab ? "step active" : "step"}
              onClick={() => setTab(t.key)}
              style={{ cursor: "pointer" }}
            >
              {t.label}
            </li>
          ))}
        </ol>

        {tab === "scans" && (
          <div>
            {scansError && <p className="page-status error">{scansError}</p>}
            {!scansError && !scans && <p className="page-status">Loading scan history...</p>}
            {scans && scans.length === 0 && <p className="page-status">You haven't scanned anything yet.</p>}
            {scans && scans.length > 0 && (
              <ul className="result-list">
                {scans.map((scan) => (
                  <li key={scan.id} className="pharmacy-card">
                    <div className="result-top">
                      <span className="result-name">{scan.medicineName ?? scan.barcode ?? "Unknown"}</span>
                      <span className={scanResultBadgeClass(scan.result)}>{scan.result}</span>
                    </div>
                    <div className="result-meta">Barcode: {scan.barcode ?? "Unknown"}</div>
                    <div className="result-meta">{new Date(scan.scannedAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "reports" && (
          <div>
            {reportsError && <p className="page-status error">{reportsError}</p>}
            {!reportsError && !reports && <p className="page-status">Loading report history...</p>}
            {reports && reports.length === 0 && <p className="page-status">You haven't submitted any reports.</p>}
            {reports && reports.length > 0 && (
              <ul className="result-list">
                {reports.map((report) => (
                  <li key={report.id} className="pharmacy-card">
                    <div className="result-top">
                      <span className="result-name">{report.productName ?? "Unknown product"}</span>
                      <span className={reportStatusBadgeClass(report.status)}>
                        {reportStatusLabel(report.status)}
                      </span>
                    </div>
                    <div className="result-meta">{report.description}</div>
                    {report.purchaseLocation && <div className="result-meta">Bought at: {report.purchaseLocation}</div>}
                    <div className="result-meta">{new Date(report.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "settings" && (
          <div>
            <div className="barcode-result" style={{ marginBottom: 16 }}>
              <h2>Display name</h2>
              <form onSubmit={handleNameSubmit}>
                <input
                  className="barcode-input"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
                <p className="page-link-row">
                  <button type="submit" disabled={nameStatus.type === "saving"}>
                    {nameStatus.type === "saving" ? "Saving..." : "Save"}
                  </button>
                </p>
                {nameStatus.type === "success" && <p className="page-status">{nameStatus.message}</p>}
                {nameStatus.type === "error" && <p className="page-status error">{nameStatus.message}</p>}
              </form>
            </div>

            <div className="barcode-result">
              <h2>Change password</h2>
              <form onSubmit={handlePasswordSubmit}>
                <input
                  className="barcode-input"
                  type="password"
                  placeholder="Current password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <br />
                <input
                  className="barcode-input"
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  style={{ marginBottom: 10 }}
                />
                <br />
                <input
                  className="barcode-input"
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
                <p className="page-link-row">
                  <button type="submit" disabled={passwordStatus.type === "saving"}>
                    {passwordStatus.type === "saving" ? "Changing..." : "Change password"}
                  </button>
                </p>
                {passwordStatus.type === "success" && <p className="page-status">{passwordStatus.message}</p>}
                {passwordStatus.type === "error" && <p className="page-status error">{passwordStatus.message}</p>}
              </form>
            </div>

            <p className="page-link-row">
              <button type="button" onClick={handleLogout}>
                Logout
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
