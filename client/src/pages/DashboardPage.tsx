import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getMyScans } from "../api/scans";
import { getAllReports, getMyReports, updateReportStatus } from "../api/reports";
import { getAdminStats } from "../api/admin";
import type { ScanHistoryItem, ScanResultCode } from "../types/scan";
import type { ReportAction, ReportAdminRow, ReportStatus, ReportSummary } from "../types/report";
import type { AdminStats } from "../types/admin";
import AuthNav from "../components/AuthNav";

type Tab = "overview" | "manageReports" | "scans" | "reports" | "settings";

const CONSUMER_TABS: Array<{ key: Tab; label: string }> = [
  { key: "scans", label: "Scan history" },
  { key: "reports", label: "My reports" },
  { key: "settings", label: "Account settings" },
];

// Admins get the same personal tabs plus two more, all under this one
// /dashboard link — deliberately not a separate "Admin Reports" nav tab, so
// there's a single entry point regardless of role.
const ADMIN_TABS: Array<{ key: Tab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "manageReports", label: "Manage reports" },
  ...CONSUMER_TABS,
];

const STATUS_FILTERS: Array<{ value: ReportStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "investigating", label: "Under Review" },
  { value: "escalated", label: "Escalated" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

// Only offers actions that make sense from the report's *current* status —
// e.g. a resolved/dismissed report is terminal and gets none; an already-
// escalated report can only be closed out (approve/dismiss), not re-reviewed.
function availableActions(status: ReportStatus): Array<{ action: ReportAction; label: string }> {
  switch (status) {
    case "pending":
      return [
        { action: "review", label: "Mark Under Review" },
        { action: "escalate", label: "Escalate" },
        { action: "approve", label: "Approve" },
        { action: "dismiss", label: "Dismiss (false call)" },
      ];
    case "investigating":
      return [
        { action: "escalate", label: "Escalate" },
        { action: "approve", label: "Approve" },
        { action: "dismiss", label: "Dismiss (false call)" },
      ];
    case "escalated":
      return [
        { action: "approve", label: "Approve" },
        { action: "dismiss", label: "Dismiss (false call)" },
      ];
    case "resolved":
    case "dismissed":
      return [];
  }
}

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
    case "escalated":
      return "ESCALATED";
    case "resolved":
      return "RESOLVED";
    case "dismissed":
      return "DISMISSED";
  }
}

function reportStatusColor(status: ReportStatus): string {
  if (status === "resolved") return "#2f8f52";
  if (status === "escalated") return "#c23a3a";
  return "#b8862f";
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

const selectStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 999,
  border: "1.5px solid #1A1A2E22",
  fontSize: 13.5,
  fontFamily: "'Inter', sans-serif",
  color: "#1A1A2E",
  background: "#FDFBF7",
};

const statCardStyle: CSSProperties = {
  borderRadius: 20,
  padding: "20px 22px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

function StatCard({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className="hk-neu-panel" style={statCardStyle}>
      <div style={{ fontSize: 12, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 28, color: "#1A1A2E" }}>{value}</div>
      {detail && <div style={{ fontSize: 12.5, color: "#1A1A2E77" }}>{detail}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { user, updateDisplayName } = useAuth();
  const isAdmin = user?.role === "admin";
  const [tab, setTab] = useState<Tab>(() => (user?.role === "admin" ? "overview" : "scans"));

  const [scans, setScans] = useState<ScanHistoryItem[] | null>(null);
  const [scansError, setScansError] = useState<string | null>(null);

  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState(user?.fullName ?? "");
  const [nameStatus, setNameStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; message?: string }>({
    type: "idle",
  });

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [adminReports, setAdminReports] = useState<ReportAdminRow[]>([]);
  const [adminPage, setAdminPage] = useState(1);
  const [adminTotalPages, setAdminTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "all">("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [adminReportsLoading, setAdminReportsLoading] = useState(false);
  const [adminReportsError, setAdminReportsError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<Record<string, ReportAction | "">>({});
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});

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
    if (!isAdmin) return;

    getAdminStats()
      .then(setStats)
      .catch((err) => {
        console.error("Failed to load admin stats", err);
        setStatsError("Unable to load dashboard stats.");
      });
  }, [isAdmin]);

  // Resets the loading state during render when the query key changes,
  // rather than via a synchronous setState at the top of the effect below —
  // React's recommended pattern for adjusting state in response to a
  // prop/state change instead of an Effect.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = `${isAdmin}:${tab}:${adminPage}:${statusFilter}:${sort}`;
  if (loadedKey !== currentKey) {
    setLoadedKey(currentKey);
    if (isAdmin && tab === "manageReports") {
      setAdminReportsLoading(true);
      setAdminReportsError(null);
    }
  }

  useEffect(() => {
    if (!isAdmin || tab !== "manageReports") return;

    let cancelled = false;

    getAllReports({ page: adminPage, status: statusFilter === "all" ? undefined : statusFilter, sort })
      .then((result) => {
        if (cancelled) return;
        setAdminReports(result.reports);
        setAdminTotalPages(result.pagination.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load reports", err);
        setAdminReportsError("Unable to load reports.");
      })
      .finally(() => {
        if (!cancelled) setAdminReportsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, tab, adminPage, statusFilter, sort]);

  function handleFilterChange(next: ReportStatus | "all") {
    setStatusFilter(next);
    setAdminPage(1);
  }

  function handleSortChange(next: "newest" | "oldest") {
    setSort(next);
    setAdminPage(1);
  }

  async function runAdminUpdate(id: string, update: { action?: ReportAction; notes?: string }) {
    setActioningId(id);
    setActionError(null);

    try {
      const updated = await updateReportStatus(id, update);
      setAdminReports((prev) => prev.map((r) => (r.id === id ? updated : r)));
      setSelectedAction((prev) => ({ ...prev, [id]: "" }));
    } catch (err) {
      console.error("Failed to update report", err);
      setActionError("Unable to update this report. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

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

  // ProtectedRoute already redirects to /login before this renders when
  // logged out; this is just a type-narrowing guard for the render below.
  if (!user) {
    return null;
  }

  const tabs = isAdmin ? ADMIN_TABS : CONSUMER_TABS;
  const maxScanCount = Math.max(1, ...(stats?.scansLast7Days.map((d) => d.count) ?? [1]));

  return (
    <div className="hk-page" style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#FDFBF7", position: "relative" }}>
      <img
        src="/assets/home-bg-linen.png"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />
      <AuthNav />

      <section style={{ padding: "var(--hk-pad-y) var(--hk-pad-x) 20px", maxWidth: 1160, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: "-0.01em", margin: "0 0 8px", color: "#1A1A2E" }}>
          {isAdmin ? "Admin dashboard" : "My dashboard"}
        </h1>
        <p style={{ fontSize: 14.5, color: "#1A1A2E88", margin: 0 }}>
          {isAdmin
            ? "Platform activity, the report queue, and your own account, all in one place."
            : "Every pack you've scanned and every report you've filed, in one place."}
        </p>
      </section>

      <section style={{ padding: "20px var(--hk-pad-x) 0", maxWidth: 1160, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button key={t.key} type="button" className="hk-tab" onClick={() => setTab(t.key)} style={tabButtonStyle(t.key === tab)}>
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section style={{ padding: "24px var(--hk-pad-x) 90px", maxWidth: 1160, margin: "0 auto", position: "relative", zIndex: 1 }}>
        {tab === "overview" && isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {statsError && <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{statsError}</p>}
            {!statsError && !stats && <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>Loading stats...</p>}

            {stats && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                  <StatCard
                    label="Users"
                    value={stats.totalUsers}
                    detail={`${stats.usersByRole.admin} admin · ${stats.usersByRole.manufacturer} manufacturer · ${stats.usersByRole.pharmacist} pharmacist · ${stats.usersByRole.consumer} consumer`}
                  />
                  <StatCard label="Medicines in registry" value={stats.totalMedicines} />
                  <StatCard label="Pharmacies" value={stats.totalPharmacies} />
                  <StatCard
                    label="Scans"
                    value={stats.totalScans}
                    detail={`${stats.scansByResult.authentic} authentic · ${stats.scansByResult.expired} expired · ${stats.scansByResult.unknown} unknown`}
                  />
                  <StatCard
                    label="Reports"
                    value={stats.totalReports}
                    detail={`${stats.reportsByStatus.pending} pending · ${stats.reportsByStatus.investigating} under review · ${stats.reportsByStatus.escalated} escalated`}
                  />
                </div>

                <div className="hk-neu-panel" style={{ borderRadius: 20, padding: "22px 24px" }}>
                  <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 16px", color: "#1A1A2E" }}>
                    Scans, last 7 days
                  </h2>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: "clamp(6px, 2vw, 16px)", height: 110 }}>
                    {stats.scansLast7Days.map((day) => (
                      <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <div
                          title={`${day.count} scans`}
                          style={{
                            width: "100%",
                            maxWidth: 32,
                            height: Math.max(4, (day.count / maxScanCount) * 76),
                            borderRadius: 6,
                            background: "#103c1c",
                          }}
                        />
                        <div style={{ fontSize: 11, color: "#1A1A2E66" }}>
                          {new Date(day.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short" })}
                        </div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#1A1A2E" }}>{day.count}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                  <div className="hk-neu-panel" style={{ borderRadius: 20, padding: "22px 24px" }}>
                    <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 14px", color: "#1A1A2E" }}>
                      Most scanned medicines
                    </h2>
                    {stats.topScannedMedicines.length === 0 ? (
                      <p style={{ fontSize: 13.5, color: "#1A1A2E77" }}>No scans recorded yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {stats.topScannedMedicines.map((m) => (
                          <div key={m.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                            <span style={{ color: "#1A1A2E" }}>{m.name}</span>
                            <span style={{ fontWeight: 700, color: "#103c1c" }}>{m.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="hk-neu-panel" style={{ borderRadius: 20, padding: "22px 24px" }}>
                    <h2 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 16, margin: "0 0 14px", color: "#1A1A2E" }}>
                      Recent reports
                    </h2>
                    {stats.recentReports.length === 0 ? (
                      <p style={{ fontSize: 13.5, color: "#1A1A2E77" }}>No reports filed yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {stats.recentReports.map((r) => (
                          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5, flexWrap: "wrap" }}>
                            <span style={{ color: "#1A1A2E" }}>{r.productName ?? r.medicineName ?? "Unknown product"}</span>
                            <span style={{ fontWeight: 700, color: reportStatusColor(r.status), fontSize: 12 }}>{reportStatusLabel(r.status)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      className="hk-neu-btn"
                      onClick={() => setTab("manageReports")}
                      style={{ marginTop: 16, padding: "10px 20px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                    >
                      Go to report queue
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === "manageReports" && isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#1A1A2E88" }}>
                Status
                <select value={statusFilter} onChange={(event) => handleFilterChange(event.target.value as ReportStatus | "all")} style={selectStyle}>
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#1A1A2E88" }}>
                Sort
                <select value={sort} onChange={(event) => handleSortChange(event.target.value as "newest" | "oldest")} style={selectStyle}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
            </div>

            {adminReportsError && <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{adminReportsError}</p>}
            {actionError && <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{actionError}</p>}
            {adminReportsLoading && <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>Loading reports...</p>}

            {!adminReportsLoading && adminReports.length === 0 && (
              <div className="hk-card" style={{ borderRadius: 20, padding: 40, textAlign: "center", color: "#1A1A2E88", fontSize: 14.5 }}>
                No reports match this filter.
              </div>
            )}

            {!adminReportsLoading &&
              adminReports.length > 0 &&
              adminReports.map((report) => {
                const actions = availableActions(report.status);
                const isBusy = actioningId === report.id;
                const currentSelection = selectedAction[report.id] ?? "";
                const currentNotes = notesDraft[report.id] ?? report.adminNotes ?? "";

                return (
                  <div key={report.id} className="hk-card" style={{ borderRadius: 20, padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#1A1A2E" }}>
                          {report.productName ?? report.medicineName ?? "Unknown product"}
                        </div>
                        <div style={{ fontSize: 12.5, color: "#1A1A2E77", marginTop: 2 }}>
                          Reported by {report.reporter?.fullName ?? report.reporter?.email ?? "Unknown"} · {new Date(report.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.03em", color: reportStatusColor(report.status), whiteSpace: "nowrap" }}>
                        {reportStatusLabel(report.status)}
                      </span>
                    </div>

                    <div style={{ fontSize: 13.5, color: "#1A1A2E" }}>{report.description}</div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "#1A1A2E77" }}>
                      <span>Country: {report.country ?? "Not listed"}</span>
                      <span>Location: {report.purchaseLocation ?? "Not listed"}</span>
                      {report.photoUrl && (
                        <a href={report.photoUrl} target="_blank" rel="noreferrer" style={{ color: "#103c1c", fontWeight: 600 }}>
                          View photo
                        </a>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      {actions.length > 0 ? (
                        <>
                          <select
                            value={currentSelection}
                            disabled={isBusy}
                            onChange={(event) => setSelectedAction((prev) => ({ ...prev, [report.id]: event.target.value as ReportAction | "" }))}
                            style={selectStyle}
                          >
                            <option value="">Choose action...</option>
                            {actions.map((option) => (
                              <option key={option.action} value={option.action}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={isBusy || !currentSelection}
                            onClick={() => runAdminUpdate(report.id, { action: currentSelection as ReportAction })}
                            className="hk-neu-btn"
                            style={{ padding: "10px 20px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                          >
                            Go
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: 12.5, color: "#1A1A2E66" }}>No action needed</span>
                      )}
                    </div>

                    <div>
                      <textarea
                        className="hk-neu-field"
                        value={currentNotes}
                        disabled={isBusy}
                        rows={2}
                        placeholder="Internal notes..."
                        style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: 14, border: "none", fontSize: 13, fontFamily: "'Inter', sans-serif", color: "#1A1A2E", resize: "vertical" }}
                        onChange={(event) => setNotesDraft((prev) => ({ ...prev, [report.id]: event.target.value }))}
                      />
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => runAdminUpdate(report.id, { notes: currentNotes })}
                        style={{ marginTop: 8, padding: "8px 16px", border: "1.5px solid #1A1A2E22", borderRadius: 999, background: "transparent", fontSize: 12.5, fontWeight: 600, color: "#1A1A2E", cursor: "pointer" }}
                      >
                        Save notes
                      </button>
                    </div>
                  </div>
                );
              })}

            <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={adminPage <= 1}
                onClick={() => setAdminPage((p) => p - 1)}
                style={{ padding: "8px 16px", borderRadius: 999, border: "1.5px solid #1A1A2E22", background: "transparent", cursor: "pointer" }}
              >
                Previous
              </button>
              <span style={{ fontSize: 13.5, color: "#1A1A2E77" }}>
                Page {adminPage} of {adminTotalPages}
              </span>
              <button
                type="button"
                disabled={adminPage >= adminTotalPages}
                onClick={() => setAdminPage((p) => p + 1)}
                style={{ padding: "8px 16px", borderRadius: 999, border: "1.5px solid #1A1A2E22", background: "transparent", cursor: "pointer" }}
              >
                Next
              </button>
            </div>
          </div>
        )}

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
                  <div key={scan.id} className="hk-card" style={{ borderRadius: 20, padding: "22px 26px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
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
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#1A1A2E" }}>
                        {scan.medicineName ?? scan.barcode ?? "Unknown"}
                      </div>
                      <div style={{ fontSize: 13, color: "#1A1A2E77", marginTop: 2 }}>Barcode: {scan.barcode ?? "Unknown"}</div>
                      <div style={{ display: "flex", gap: 14, marginTop: 2, flexWrap: "wrap" }}>
                        {scan.medicineId && (
                          <Link to={`/medicines/${scan.medicineId}`} style={{ fontSize: 12.5, fontWeight: 600, color: "#103c1c" }}>
                            View medicine details
                          </Link>
                        )}
                        <Link
                          to="/report"
                          state={{ scanId: scan.id, productName: scan.medicineName ?? undefined }}
                          style={{ fontSize: 12.5, fontWeight: 600, color: "#c23a3a" }}
                        >
                          Report this
                        </Link>
                      </div>
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
                <div key={report.id} className="hk-card" style={{ borderRadius: 20, padding: "22px 26px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
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
                  <div style={{ flex: 1, minWidth: 180 }}>
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
          </div>
        )}
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
