import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import type { NearbyPharmacy } from "../types/medicine";

// Leaflet's default marker icon resolves image paths relative to the page
// URL, which breaks under Vite's bundling — this is the standard fix,
// pointing it at the bundler-resolved asset URLs instead.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function googleMapsDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

interface PharmacyMapProps {
  center: { lat: number; lng: number };
  pharmacies: NearbyPharmacy[];
  // Off by default since most usages embed the map inside an otherwise
  // scrollable page (trapping the scroll wheel there would be annoying) —
  // the standalone Pharmacy Map page, where the map IS the page, turns it on.
  scrollWheelZoom?: boolean;
  className?: string;
}

export default function PharmacyMap({ center, pharmacies, scrollWheelZoom = false, className }: PharmacyMapProps) {
  return (
    <div className={className ?? "pharmacy-map"}>
      <MapContainer center={[center.lat, center.lng]} zoom={13} scrollWheelZoom={scrollWheelZoom}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pharmacies.map((pharmacy) => (
          <Marker key={pharmacy.id} position={[pharmacy.latitude, pharmacy.longitude]}>
            <Popup>
              <strong>{pharmacy.name}</strong>
              {pharmacy.stocksMedicine && <div className="stock-badge">Confirmed in stock</div>}
              <div>{pharmacy.address}</div>
              {pharmacy.phone && <div>{pharmacy.phone}</div>}
              <div>{pharmacy.distanceKm} km away</div>
              <a href={googleMapsDirectionsUrl(pharmacy.latitude, pharmacy.longitude)} target="_blank" rel="noreferrer">
                Navigate
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
