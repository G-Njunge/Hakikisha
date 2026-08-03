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
  const [menuOpen, setMenuOpen] = useState(false);

  // Resets synchronously during render (React's recommended pattern for
  // adjusting state in response to a prop/state change) rather than via a
  // setState call at the top of the effect below, which the
  // react-hooks/set-state-in-effect rule flags as risking a cascading
  // extra render.
  const [prevRole, setPrevRole] = useState(user?.role);
  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (prevRole !== user?.role) {
    setPrevRole(user?.role);
    if (user?.role !== "admin") setUnreadCount(0);
  }
  if (prevPathname !== location.pathname) {
    setPrevPathname(location.pathname);
    setMenuOpen(false);
  }

  // Refetches on every navigation (not just mount) so the badge clears once
  // an admin opens the Dashboard's Reports tab (which marks reports as
  // viewed server-side) and then navigates elsewhere.
  useEffect(() => {
    if (user?.role !== "admin") return;

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

  const unreadBadge = unreadCount > 0 && (
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
  );

  function navLinkStyle(active: boolean) {
    return { display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, color: active ? "#103c1c" : "#1A1A2E" };
  }

  return (
    <nav className="hk-nav" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #1A1A2E12", position: "relative", zIndex: 20 }}>
      <Link to="/" style={{ display: "flex", alignItems: "center" }}>
        <img src="/assets/hakikisha-logo.png" alt="Hakikisha" style={{ height: 48, width: "auto", display: "block" }} />
      </Link>

      <div className="hk-nav-links">
        {NAV_LINKS.map((link) => (
          <Link key={link.to} to={link.to} style={navLinkStyle(location.pathname === link.to)}>
            {link.label}
            {link.to === "/dashboard" && unreadBadge}
          </Link>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {showRoleCountry && user && (
            <div style={{ fontSize: 14, color: "#1A1A2E99" }}>{[user.role, user.country].filter(Boolean).join(" · ")}</div>
          )}
          <Link to="/logout" style={{ padding: "9px 20px", borderRadius: 999, border: "1.5px solid #1A1A2E22", fontSize: 13.5, fontWeight: 600, color: "#1A1A2E" }}>
            Log out
          </Link>
        </div>
      </div>

      <button
        type="button"
        className="hk-nav-toggle"
        aria-label={menuOpen ? "Close menu" : "Open menu"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
        style={{ background: "none", border: "1.5px solid #1A1A2E22", borderRadius: 10, width: 40, height: 40, cursor: "pointer", position: "relative" }}
      >
        <span className={`hk-nav-toggle-bars ${menuOpen ? "open" : ""}`} />
      </button>

      {menuOpen && (
        <div className="hk-nav-mobile-panel">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} style={navLinkStyle(location.pathname === link.to)} onClick={() => setMenuOpen(false)}>
              {link.label}
              {link.to === "/dashboard" && unreadBadge}
            </Link>
          ))}
          {showRoleCountry && user && (
            <div style={{ fontSize: 14, color: "#1A1A2E99" }}>{[user.role, user.country].filter(Boolean).join(" · ")}</div>
          )}
          <Link
            to="/logout"
            onClick={() => setMenuOpen(false)}
            style={{ padding: "9px 20px", borderRadius: 999, border: "1.5px solid #1A1A2E22", fontSize: 13.5, fontWeight: 600, color: "#1A1A2E", alignSelf: "flex-start" }}
          >
            Log out
          </Link>
        </div>
      )}
    </nav>
  );
}
