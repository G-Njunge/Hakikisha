import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getAllReports, updateReportStatus } from "../api/reports";
import type { ReportAction, ReportAdminRow } from "../types/report";

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "resolved":
      return "status-badge approved";
    case "dismissed":
      return "status-badge rejected";
    case "investigating":
      return "status-badge pending";
    default:
      return "status-badge pending";
  }
}

export default function AdminReportsPage() {
  const { user } = useAuth();

  const [reports, setReports] = useState<ReportAdminRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    getAllReports(page)
      .then((result) => {
        if (cancelled) return;
        setReports(result.reports);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to load reports", err);
        setLoadError("Unable to load reports.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, page]);

  async function handleAction(id: string, action: ReportAction) {
    setActioningId(id);
    setActionError(null);

    try {
      const updated = await updateReportStatus(id, action);
      setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status: updated.status } : r)));
    } catch (err) {
      console.error("Failed to update report", err);
      setActionError("Unable to update this report. Please try again.");
    } finally {
      setActioningId(null);
    }
  }

  // ProtectedRoute already redirects to /login before this renders when
  // logged out; this is just a type-narrowing guard for the render below.
  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <main className="page-shell">
        <section className="page-card">
          <h1 className="page-title">Reports</h1>
          <p className="page-status error">You don't have access to this page.</p>
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
        <h1 className="page-title">Counterfeit reports</h1>
        <p className="page-subtitle">Review submitted reports and mark them approved or a false call.</p>

        {isLoading && <p className="page-status">Loading reports...</p>}
        {loadError && <p className="page-status error">{loadError}</p>}
        {actionError && <p className="page-status error">{actionError}</p>}

        {!isLoading && !loadError && reports.length === 0 && (
          <p className="page-status">No reports yet.</p>
        )}

        {!isLoading && reports.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px" }}>Reported</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Product</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Reporter</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Description</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Location</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Photo</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
                  <th style={{ textAlign: "left", padding: "8px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const canAction = report.status === "pending" || report.status === "investigating";
                  return (
                    <tr key={report.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        {new Date(report.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "8px" }}>{report.productName ?? report.medicineName ?? "Unknown"}</td>
                      <td style={{ padding: "8px" }}>
                        {report.reporter?.fullName ?? report.reporter?.email ?? "Unknown"}
                      </td>
                      <td style={{ padding: "8px", maxWidth: 280 }}>{report.description}</td>
                      <td style={{ padding: "8px" }}>{report.purchaseLocation ?? "Not listed"}</td>
                      <td style={{ padding: "8px" }}>
                        {report.photoUrl ? (
                          <a href={report.photoUrl} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : (
                          "None"
                        )}
                      </td>
                      <td style={{ padding: "8px" }}>
                        <span className={getStatusBadgeClass(report.status)}>{report.status}</span>
                      </td>
                      <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
                        {canAction ? (
                          <>
                            <button
                              type="button"
                              disabled={actioningId === report.id}
                              onClick={() => handleAction(report.id, "approve")}
                            >
                              Approve
                            </button>{" "}
                            <button
                              type="button"
                              disabled={actioningId === report.id}
                              onClick={() => handleAction(report.id, "dismiss")}
                            >
                              False call
                            </button>
                          </>
                        ) : (
                          <span className="page-status">No action needed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="page-nav">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>

        <p className="page-link-row">
          <Link to="/">Back to home</Link>
        </p>
      </section>
    </main>
  );
}
