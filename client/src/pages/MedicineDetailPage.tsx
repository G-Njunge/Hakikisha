import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMedicineById } from "../api/medicines";
import type { Medicine } from "../types/medicine";

type FetchState =
  | { status: "loading"; forId: string }
  | { status: "success"; forId: string; medicine: Medicine }
  | { status: "error"; forId: string; message: string };

function getBadgeClass(status: Medicine["approvalStatus"]): string {
  switch (status) {
    case "approved":
      return "status-badge approved";
    case "pending":
      return "status-badge pending";
    case "rejected":
      return "status-badge rejected";
    case "expired":
      return "status-badge expired";
    default:
      return "status-badge";
  }
}

function formatApprovalStatus(status: Medicine["approvalStatus"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function MedicineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<FetchState>({ status: "loading", forId: "" });

  useEffect(() => {
    if (!id) {
      return;
    }

    let cancelled = false;

    getMedicineById(id)
      .then((medicine) => {
        if (!cancelled) setState({ status: "success", forId: id, medicine });
      })
      .catch((err) => {
        if (cancelled) return;
        const responseStatus = (err as { response?: { status?: number } }).response?.status;
        setState({
          status: "error",
          forId: id,
          message: responseStatus === 404 ? "Medicine not found" : "Failed to load medicine",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const effective: FetchState = state.forId === id ? state : { status: "loading", forId: id ?? "" };

  if (effective.status === "loading") {
    return (
      <main className="page-shell">
        <section className="page-card">
          <p className="page-status">Loading medicine details...</p>
        </section>
      </main>
    );
  }

  if (effective.status === "error") {
    return (
      <main className="page-shell">
        <section className="page-card">
          <p className="page-status error">{effective.message}</p>
          <p className="page-link-row">
            <Link to="/">Back to home</Link>
          </p>
        </section>
      </main>
    );
  }

  const medicine = effective.medicine;
  const detailItems = [
    { label: "Generic name", value: medicine.genericName ?? "Not listed" },
    { label: "Manufacturer", value: medicine.manufacturer },
    { label: "Dosage form", value: medicine.dosageForm ?? "Not listed" },
    { label: "Strength", value: medicine.strength ?? "Not listed" },
    { label: "Barcode", value: medicine.barcode },
    { label: "Regulatory body", value: medicine.regulatoryBody },
    { label: "Approval number", value: medicine.approvalNumber },
    { label: "Added on", value: new Date(medicine.createdAt).toLocaleDateString() },
  ];

  return (
    <main className="page-shell">
      <section className="page-card">
        <div className="detail-header">
          <div>
            <h1 className="page-title">{medicine.name}</h1>
            <p className="page-subtitle">Full medicine information</p>
          </div>
          <span className={getBadgeClass(medicine.approvalStatus)}>
            {formatApprovalStatus(medicine.approvalStatus)}
          </span>
        </div>

        <div className="detail-grid">
          {detailItems.map((item) => (
            <div key={item.label} className="detail-item">
              <span className="detail-label">{item.label}</span>
              <span className="detail-value">{item.value}</span>
            </div>
          ))}
        </div>

        <p className="page-link-row">
          <Link to="/search">Back to search</Link> ·{" "}
          <Link to="/report" state={{ productName: medicine.name }}>
            Report this as counterfeit
          </Link>
        </p>
      </section>
    </main>
  );
}
