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
// "All" (30km) is the default and preserves this page's original behavior —
// the API's own default (10km) is tight enough that several real Kigali
// pharmacies (8.8-9.5km from the centre point) silently drop out whenever the
// detected position isn't bit-for-bit identical to KIGALI_CENTER, which real
// geolocation coordinates essentially never are. 1/5/10km are offered as
// narrower options for users who want to filter down.
const RADIUS_OPTIONS = [
  { value: 1, label: "1 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 30, label: "All (30 km)" },
] as const;
const DEFAULT_RADIUS_KM = 30;

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
  // Kigali-only) until the user explicitly shares their location (or skips)
  // via the consent prompt below — no longer requested silently on mount.
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>(KIGALI_CENTER);
  const [pharmacies, setPharmacies] = useState<NearbyPharmacy[] | null>(null);
  // "idle" — no medicine searched yet, nothing pharmacy-related renders.
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(DEFAULT_RADIUS_KM);
  // Reveals closed/hours-unknown pharmacies alongside the open ones — off by
  // default so the list only shows pharmacies you could actually walk into
  // right now. Reset whenever the searched medicine changes.
  const [showClosedToo, setShowClosedToo] = useState(false);

  // Our own consent prompt, shown before ever triggering the browser's
  // native geolocation permission dialog — "unresolved" until the user picks
  // Share/Not now. "locating" covers the async gap while the browser prompt
  // (and any OS-level one behind it) is up, so the UI doesn't look stuck.
  const [locationConsent, setLocationConsent] = useState<"unresolved" | "locating" | "resolved">("unresolved");
  const [locationDenied, setLocationDenied] = useState(false);

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setLocationConsent("resolved");
      return;
    }
    setLocationConsent("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationConsent("resolved");
      },
      () => {
        // Denied or unavailable — keep the Kigali fallback already in state.
        setLocationDenied(true);
        setLocationConsent("resolved");
      }
    );
  }

  function skipLocation() {
    setLocationConsent("resolved");
  }

  // Resets status/showClosedToo during render when (userCoords, medicineId,
  // radiusKm) changes, rather than via a synchronous setState at the top of
  // the fetch effect below — React's recommended pattern for adjusting state
  // in response to a prop/state change instead of an Effect.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const currentKey = `${userCoords.lat},${userCoords.lng}:${medicineId ?? ""}:${radiusKm}`;
  if (loadedKey !== currentKey) {
    setLoadedKey(currentKey);
    setShowClosedToo(false);
    if (medicineId) {
      setStatus("loading");
      setError(null);
    } else {
      setStatus("idle");
      setPharmacies(null);
    }
  }

  useEffect(() => {
    if (!medicineId) return;

    let cancelled = false;

    // Fetched without the openNow filter — the full stocked list is needed
    // client-side to compute the open vs. closed split and the "N closed"
    // count, not just whichever subset happens to be open right now.
    getNearbyPharmacies(userCoords.lat, userCoords.lng, medicineId, radiusKm)
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
  }, [userCoords, medicineId, radiusKm]);

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

  // Only pharmacies confirmed to stock the searched medicine count at all.
  const stockedPharmacies = (pharmacies ?? []).filter((p) => p.stocksMedicine === true);
  // isOpenNow === null (hours unknown) is treated like closed here — it's
  // not confirmed open, so it shouldn't be presented as if it were.
  const openPharmacies = stockedPharmacies.filter((p) => p.isOpenNow === true);
  const closedPharmacies = stockedPharmacies.filter((p) => p.isOpenNow !== true);
  const displayedPharmacies = showClosedToo ? stockedPharmacies : openPharmacies;
  const selected = displayedPharmacies.find((p) => p.id === selectedId) ?? null;

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
            ? `Showing pharmacies confirmed in stock for ${medicineName} that are open right now.`
            : "Search a medicine to see nearby pharmacies confirmed to stock it and currently open."}
        </p>

        {locationConsent !== "resolved" && (
          <div
            className="hk-card"
            style={{
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13.5, color: "#1A1A2E" }}>
              Share your location to sort pharmacies by distance from you? Otherwise we'll center on Kigali.
            </span>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={shareLocation}
                disabled={locationConsent === "locating"}
                className="hk-neu-btn"
                style={{ padding: "9px 18px", border: "none", borderRadius: 999, background: "#103c1c", color: "#FDFBF7", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                {locationConsent === "locating" ? "Locating..." : "Share location"}
              </button>
              <button
                type="button"
                onClick={skipLocation}
                disabled={locationConsent === "locating"}
                style={{ padding: "9px 18px", border: "1.5px solid #1A1A2E22", borderRadius: 999, background: "transparent", color: "#1A1A2E88", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                Not now
              </button>
            </div>
          </div>
        )}
        {locationConsent === "resolved" && locationDenied && (
          <p style={{ fontSize: 13, color: "#1A1A2E77", marginBottom: 16 }}>
            Couldn't get your location — showing results centered on Kigali instead.
          </p>
        )}

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
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#1A1A2E88" }}>
            Radius:
            <select
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value))}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #1A1A2E22", fontSize: 13.5 }}
            >
              {RADIUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {status === "success" && medicineName && (
          <div style={{ fontSize: 13, color: "#1A1A2E77", marginBottom: 20 }}>
            {showClosedToo
              ? `${stockedPharmacies.length} pharmac${stockedPharmacies.length === 1 ? "y" : "ies"} stock ${medicineName} (${openPharmacies.length} open now)`
              : `${openPharmacies.length} pharmac${openPharmacies.length === 1 ? "y" : "ies"} open now with ${medicineName} in stock`}
          </div>
        )}
      </section>

      {status === "idle" && (
        <section style={{ padding: "0 56px 70px", maxWidth: 1280, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="hk-card" style={{ borderRadius: 20, padding: 40, textAlign: "center", color: "#1A1A2E88", fontSize: 14.5 }}>
            Search a medicine above to see nearby pharmacies that stock it.
          </div>
        </section>
      )}

      {status !== "idle" && (
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
                <div style={{ fontSize: 14, color: "#1A1A2E", fontWeight: 600 }}>
                  {selected.hours ?? "Not listed"}
                  {selected.isOpenNow !== null && (
                    <span style={{ marginLeft: 8, color: selected.isOpenNow ? "#2f8f52" : "#b91c1c" }}>
                      ({selected.isOpenNow ? "Open now" : "Closed now"})
                    </span>
                  )}
                </div>
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
            {status === "success" && stockedPharmacies.length === 0 && (
              <div className="hk-card" style={{ borderRadius: 20, padding: 34, textAlign: "center", color: "#1A1A2E88", fontSize: 14 }}>
                No pharmacies currently list {medicineName} in stock.
              </div>
            )}
            {status === "success" && stockedPharmacies.length > 0 && !showClosedToo && closedPharmacies.length > 0 && (
              <div className="hk-card" style={{ borderRadius: 16, padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#1A1A2E88" }}>
                  {closedPharmacies.length} more pharmac{closedPharmacies.length === 1 ? "y has" : "ies have"} {medicineName} but {closedPharmacies.length === 1 ? "is" : "are"} currently closed.
                </span>
                <button
                  type="button"
                  onClick={() => setShowClosedToo(true)}
                  style={{ padding: "7px 16px", border: "1.5px solid #103c1c33", borderRadius: 999, background: "transparent", color: "#103c1c", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}
                >
                  Show them anyway
                </button>
              </div>
            )}
            {status === "success" && showClosedToo && closedPharmacies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClosedToo(false)}
                style={{ alignSelf: "flex-start", padding: 0, border: "none", background: "none", color: "#103c1c", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
              >
                Hide closed pharmacies
              </button>
            )}
            {status === "success" && openPharmacies.length === 0 && closedPharmacies.length > 0 && !showClosedToo && (
              <div className="hk-card" style={{ borderRadius: 20, padding: 34, textAlign: "center", color: "#1A1A2E88", fontSize: 14 }}>
                None of the pharmacies that stock {medicineName} are open right now.
              </div>
            )}
            {status === "success" &&
              displayedPharmacies.map((pharmacy) => (
                <div key={pharmacy.id} className="hk-card" style={{ borderRadius: 20, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15.5, color: "#1A1A2E" }}>{pharmacy.name}</div>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#5fbf7d", flexShrink: 0 }} />
                  </div>
                  <div style={{ fontSize: 13, color: "#1A1A2E77" }}>{pharmacy.address}</div>
                  <div style={{ fontSize: 12, color: "#103c1c", fontWeight: 600 }}>
                    {medicineName ? `Confirmed in stock: ${medicineName}` : `${pharmacy.distanceKm} km away`}
                  </div>
                  {pharmacy.isOpenNow !== null && (
                    <div style={{ fontSize: 12, fontWeight: 600, color: pharmacy.isOpenNow ? "#2f8f52" : "#b91c1c" }}>
                      {pharmacy.isOpenNow ? "Open now" : "Closed now"}
                    </div>
                  )}
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
          {status === "success" && (
            <PharmacyMap
              center={selected ? { lat: selected.latitude, lng: selected.longitude } : userCoords}
              pharmacies={displayedPharmacies}
              scrollWheelZoom
              className="hk-pharmacy-map-large"
            />
          )}
        </div>
      </section>
      )}

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
