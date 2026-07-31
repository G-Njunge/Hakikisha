import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { getNearbyPharmacies, searchMedicines } from "../api/medicines";
import type { NearbyPharmacy } from "../types/medicine";
import PharmacyMap from "../components/PharmacyMap";
import AuthNav from "../components/AuthNav";

// This app's pharmacy data is currently Kigali-only (see server/src/db/seed.ts).
// A denied/unavailable geolocation request falls back to Kigali's centre.
const KIGALI_CENTER = { lat: -1.9441, lng: 30.0619 };
// Always used on this page, regardless of whether geolocation actually
// succeeded — the API's own default (10km) is tight enough that several real
// Kigali pharmacies (8.8-9.5km from the centre point) silently drop out
// whenever the detected position isn't bit-for-bit identical to
// KIGALI_CENTER, which real geolocation coordinates essentially never are.
// Since all of this app's pharmacy data sits within Kigali anyway, there's no
// scenario where the tighter default is the right choice here.
const SEARCH_RADIUS_KM = 30;

function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function PharmacyMapPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [medicineId, setMedicineId] = useState<string | null>(searchParams.get("medicineId"));
  const [medicineName, setMedicineName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [queryError, setQueryError] = useState<string | null>(null);
  const [isSearchingMedicine, setIsSearchingMedicine] = useState(false);

  // Defaults to Kigali's centre (this app's pharmacy data is currently
  // Kigali-only) so the effect below never needs a synchronous "no
  // geolocation" fallback branch — it only ever refines this with a more
  // precise position if/when the browser grants it.
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>(KIGALI_CENTER);
  const [pharmacies, setPharmacies] = useState<NearbyPharmacy[] | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "success">("loading");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => {} // keep the Kigali fallback already in state
    );
  }, []);

  // Resets status to "loading" during render when (userCoords, medicineId)
  // changes, rather than via a synchronous setState at the top of the fetch
  // effect below — React's recommended pattern for adjusting state in
  // response to a prop/state change instead of an Effect.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = `${userCoords.lat},${userCoords.lng}:${medicineId ?? ""}`;
  if (loadedKey !== currentKey) {
    setLoadedKey(currentKey);
    setStatus("loading");
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;

    getNearbyPharmacies(userCoords.lat, userCoords.lng, medicineId ?? undefined, SEARCH_RADIUS_KM)
      .then((results) => {
        if (cancelled) return;
        setPharmacies(results);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch nearby pharmacies", err);
        setStatus("error");
        setError("Unable to fetch nearby pharmacies.");
      });

    return () => {
      cancelled = true;
    };
  }, [userCoords, medicineId]);

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;

    setIsSearchingMedicine(true);
    setQueryError(null);
    try {
      const result = await searchMedicines(query.trim(), 1);
      const match = result.results[0];
      if (!match) {
        setQueryError(`No medicine found matching "${query.trim()}".`);
        return;
      }
      setMedicineId(match.id);
      setMedicineName(match.name);
      setSelectedId(null);
      setSearchParams({ medicineId: match.id });
    } catch (err) {
      console.error("Medicine search failed", err);
      setQueryError("Unable to search right now. Please try again.");
    } finally {
      setIsSearchingMedicine(false);
    }
  }

  function clearMedicineFilter() {
    setMedicineId(null);
    setMedicineName(null);
    setQuery("");
    setQueryError(null);
    setSelectedId(null);
    setSearchParams({});
  }

  // When a medicine filter is active, only pharmacies confirmed to stock it
  // are shown at all (map markers and list alike) — not just sorted first —
  // per the point of searching for a specific medicine.
  const visiblePharmacies = medicineId ? (pharmacies ?? []).filter((p) => p.stocksMedicine === true) : pharmacies;
  const selected = visiblePharmacies?.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="hk-page" style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: "#FDFBF7", position: "relative" }}>
      <img
        src="/assets/home-bg-linen.png"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
      />
      <AuthNav />

      <section style={{ padding: "44px 56px 0", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
        <h1 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 32, letterSpacing: "-0.01em", margin: "0 0 8px", color: "#1A1A2E" }}>
          Find a nearby pharmacy
        </h1>
        <p style={{ fontSize: 14.5, color: "#1A1A2E88", margin: "0 0 22px" }}>
          {medicineName
            ? `Showing only pharmacies confirmed in stock for ${medicineName}.`
            : "Search a medicine to see only the pharmacies confirmed to stock it."}
        </p>
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 10, maxWidth: 520, marginBottom: 8 }}>
          <input
            className="hk-neu-field"
            type="text"
            placeholder="e.g. Panadol, Amoxil, Coartem"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: "14px 18px", borderRadius: 999, color: "#1A1A2E", fontSize: 14.5, fontFamily: "'Inter', sans-serif", border: "none" }}
          />
          <button
            type={medicineId ? "button" : "submit"}
            onClick={medicineId ? clearMedicineFilter : undefined}
            disabled={isSearchingMedicine}
            className="hk-neu-btn"
            style={{ padding: "13px 22px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
          >
            {medicineId ? "Clear" : isSearchingMedicine ? "Searching..." : "Search"}
          </button>
        </form>
        {queryError && <div style={{ fontSize: 13, color: "#b91c1c", marginBottom: 12 }}>{queryError}</div>}
        <div style={{ fontSize: 13, color: "#1A1A2E77", marginBottom: 20 }}>
          {status === "success" &&
            visiblePharmacies &&
            (medicineName
              ? `${visiblePharmacies.length} pharmac${visiblePharmacies.length === 1 ? "y" : "ies"} stock ${medicineName}`
              : `${visiblePharmacies.length} pharmac${visiblePharmacies.length === 1 ? "y" : "ies"} nearby`)}
        </div>
      </section>

      <section
        style={{
          padding: "0 56px 70px",
          maxWidth: 1280,
          margin: "0 auto",
          position: "relative",
          zIndex: 1,
          display: "grid",
          gridTemplateColumns: "0.9fr 1.3fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {selected ? (
          <div className="hk-card" style={{ borderRadius: 24, padding: 26, display: "flex", flexDirection: "column", gap: 16, maxHeight: 560, overflowY: "auto" }}>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              style={{ background: "none", border: "none", padding: 0, textAlign: "left", fontSize: 13, fontWeight: 600, color: "#103c1c", cursor: "pointer" }}
            >
              ← Back to results
            </button>
            <div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 19, color: "#1A1A2E", marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 13.5, color: "#1A1A2E77" }}>{selected.address}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Phone</div>
                <div style={{ fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>{selected.phone ?? "Not listed"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Hours</div>
                <div style={{ fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>{selected.hours ?? "Not listed"}</div>
              </div>
              {medicineName && (
                <div>
                  <div style={{ fontSize: 11, color: "#1A1A2E66", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                    Medicines in stock
                  </div>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "6px 12px",
                      borderRadius: 999,
                      fontSize: 12.5,
                      fontWeight: 600,
                      background: "#5fbf7d22",
                      color: "#2f8f52",
                    }}
                  >
                    Confirmed: {medicineName}
                  </span>
                </div>
              )}
            </div>
            <a
              href={googleMapsDirectionsUrl(selected.latitude, selected.longitude)}
              target="_blank"
              rel="noreferrer"
              style={{ textAlign: "center", padding: 14, borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 14.5, fontWeight: 700 }}
            >
              Navigate
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: 560, overflowY: "auto", paddingRight: 4 }}>
            {status === "loading" && <p style={{ fontSize: 13.5, color: "#1A1A2E88" }}>Finding nearby pharmacies...</p>}
            {status === "error" && <p style={{ color: "#b91c1c", fontSize: 13.5 }}>{error}</p>}
            {status === "success" && visiblePharmacies && visiblePharmacies.length === 0 && (
              <div className="hk-card" style={{ borderRadius: 20, padding: 34, textAlign: "center", color: "#1A1A2E88", fontSize: 14 }}>
                {medicineName ? `No pharmacies currently list ${medicineName} in stock.` : "No pharmacies found near you."}
              </div>
            )}
            {status === "success" &&
              visiblePharmacies &&
              visiblePharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="hk-card" style={{ borderRadius: 20, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#1A1A2E" }}>{pharmacy.name}</div>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#5fbf7d", flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 13, color: "#1A1A2E77" }}>{pharmacy.address}</div>
                  <div style={{ fontSize: 12, color: "#103c1c", fontWeight: 600 }}>
                    {medicineName ? `Confirmed in stock: ${medicineName}` : `${pharmacy.distanceKm} km away`}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedId(pharmacy.id)}
                    style={{ alignSelf: "flex-start", padding: "9px 18px", border: "1.5px solid #103c1c33", borderRadius: 999, background: "transparent", color: "#103c1c", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
                  >
                    View details
                  </button>
                </div>
              ))}
          </div>
        )}

        <div style={{ borderRadius: 24, overflow: "hidden", boxShadow: "0 30px 60px -28px rgba(16,60,28,0.35)", border: "1.5px solid #1A1A2E18" }}>
          {visiblePharmacies && (
            <PharmacyMap
              center={selected ? { lat: selected.latitude, lng: selected.longitude } : userCoords}
              pharmacies={visiblePharmacies}
              scrollWheelZoom
              className="hk-pharmacy-map-large"
            />
          )}
        </div>
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
