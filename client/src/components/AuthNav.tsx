import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getUnreadReportCount } from "../api/reports";

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
  const [unreadCount, setUnreadCount] = useState(0);

  // Refetches on every navigation (not just mount) so the badge clears once
  // an admin visits /admin/reports (which marks reports as viewed server-side)
  // and then navigates elsewhere.
  useEffect(() => {
    if (user?.role !== "admin") {
      setUnreadCount(0);
      return;
    }

    let cancelled = false;
    getUnreadReportCount()
      .then((count) => {
        if (!cancelled) setUnreadCount(count);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user?.role, location.pathname]);

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
        {user?.role === "admin" && (
          <Link
            to="/admin/reports"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13.5,
              fontWeight: 600,
              color: location.pathname === "/admin/reports" ? "#103c1c" : "#1A1A2E",
            }}
          >
            Admin Reports
            {unreadCount > 0 && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: "#c23a3a",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        )}
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
