import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/report", label: "Report" },
  { to: "/pharmacy", label: "Pharmacy Map" },
];

interface AuthNavProps {
  showRoleCountry?: boolean;
}

export default function AuthNav({ showRoleCountry = false }: AuthNavProps) {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 56px",
        borderBottom: "1px solid #1A1A2E12",
        position: "relative",
        zIndex: 1,
      }}
    >
      <Link to="/" style={{ display: "flex", alignItems: "center" }}>
        <img src="/assets/hakikisha-logo.png" alt="Hakikisha" style={{ height: 48, width: "auto", display: "block" }} />
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
        {NAV_LINKS.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: location.pathname === link.to ? "#103c1c" : "#1A1A2E",
            }}
          >
            {link.label}
          </Link>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        {showRoleCountry && user && (
          <div style={{ fontSize: 14, color: "#1A1A2E99" }}>
            {[user.role, user.country].filter(Boolean).join(" · ")}
          </div>
        )}
        <Link
          to="/logout"
          style={{
            padding: "9px 20px",
            borderRadius: 999,
            border: "1.5px solid #1A1A2E22",
            fontSize: 13.5,
            fontWeight: 600,
            color: "#1A1A2E",
          }}
        >
          Log out
        </Link>
      </div>
    </nav>
  );
}
