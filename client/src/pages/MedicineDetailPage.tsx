import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getMedicineById, getNearbyPharmacies } from "../api/medicines";
import type { Medicine, NearbyPharmacy } from "../types/medicine";
import PharmacyMap from "../components/PharmacyMap";

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

  const [pharmacies, setPharmacies] = useState<NearbyPharmacy[] | null>(null);
  const [pharmacyStatus, setPharmacyStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [pharmacyError, setPharmacyError] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

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

  function findNearbyPharmacies() {
    if (!id) return;

    if (!("geolocation" in navigator)) {
      setPharmacyStatus("error");
      setPharmacyError("Location is not available in this browser.");
      return;
    }

    setPharmacyStatus("loading");
    setPharmacyError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const results = await getNearbyPharmacies(position.coords.latitude, position.coords.longitude, id);
          setPharmacies(results);
          setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
          setPharmacyStatus("success");
        } catch (err) {
          console.error("Failed to fetch nearby pharmacies", err);
          setPharmacyStatus("error");
          setPharmacyError("Unable to fetch nearby pharmacies.");
        }
      },
      () => {
        setPharmacyStatus("error");
        setPharmacyError("Location permission was denied. Enable it to find nearby pharmacies.");
      }
    );
  }

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

        <div className="barcode-result">
          <h2>Nearby pharmacies</h2>
          {pharmacyStatus === "idle" && (
            <button type="button" onClick={findNearbyPharmacies}>
              Find pharmacies stocking this medicine
            </button>
          )}
          {pharmacyStatus === "loading" && <p className="page-status">Finding nearby pharmacies...</p>}
          {pharmacyStatus === "error" && (
            <>
              <p className="page-status error">{pharmacyError}</p>
              <button type="button" onClick={findNearbyPharmacies}>
                Try again
              </button>
            </>
          )}
          {pharmacyStatus === "success" && pharmacies && pharmacies.length === 0 && (
            <p className="page-status">No pharmacies found near you.</p>
          )}
          {pharmacyStatus === "success" && pharmacies && pharmacies.length > 0 && (
            <>
              {userCoords && <PharmacyMap center={userCoords} pharmacies={pharmacies} />}
              <ul className="result-list">
                {pharmacies.map((pharmacy) => (
                  <li key={pharmacy.id} className="pharmacy-card">
                    <div className="result-top">
                      <span className="result-name">{pharmacy.name}</span>
                      <span>{pharmacy.distanceKm} km</span>
                    </div>
                    {pharmacy.stocksMedicine && <span className="stock-badge">Confirmed in stock</span>}
                    <div className="result-meta">{pharmacy.address}</div>
                    {pharmacy.phone && <div className="result-meta">{pharmacy.phone}</div>}
                  </li>
                ))}
              </ul>
            </>
          )}
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
