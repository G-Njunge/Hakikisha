import { Link } from "react-router-dom";

// Ported from the design export ("Hakikisha landing page design (1).zip") as a
// native component rather than keeping its proprietary <x-dc>/support.js
// templating runtime — same visual output, no unaudited third-party runtime
// script in the bundle. This replaces the previous (orange/navy) landing
// design entirely; the new export uses a green/cream neumorphic palette.
const COLOR = {
  bg: "#E4E7ED",
  cream: "#FDFBF7",
  ink: "#1A1A2E",
  green: "#103c1c",
  slate: "#3e4440",
  mint: "#5fbf7d",
};

export default function LandingPage() {
  return (
    <div
      className="hk-page"
      style={{
        minHeight: "100vh",
        width: "100%",
        overflowX: "hidden",
        background: `${COLOR.bg} url('/assets/bg-waves.png') center top / cover fixed no-repeat`,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          padding: "18px var(--hk-pad-x)",
          background: "#E4E7EDcc",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #103c1c1a",
        }}
      >
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src="/assets/hakikisha-logo.png" alt="Hakikisha" style={{ height: 52, width: "auto", display: "block" }} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link
            to="/login"
            className="hk-btn"
            style={{ padding: "9px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700, color: COLOR.green }}
          >
            Login
          </Link>
          <Link
            to="/register"
            className="hk-btn"
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              background: COLOR.green,
              fontSize: 13,
              fontWeight: 700,
              color: COLOR.bg,
            }}
          >
            Register
          </Link>
        </div>
      </nav>

      <section
        style={{
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
          padding: "48px clamp(20px, 4vw, 40px) 110px",
        }}
      >
        <div style={{ position: "relative", zIndex: 1, maxWidth: 980, margin: "0 auto" }}>
          <h1
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 900,
              fontSize: "clamp(49px, 7.8vw, 88px)",
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
              margin: "0 0 26px",
              color: COLOR.green,
            }}
          >
            Know your medicine. Before you take it.
          </h1>
          <p style={{ fontSize: 22, lineHeight: 1.65, color: COLOR.slate, maxWidth: 820, margin: "0 auto 16px" }}>
            Hakikisha verifies packs against the official registry in seconds, flags counterfeit and
            substandard batches, and helps you find pharmacies you can trust.
          </p>
          <p style={{ fontSize: 22, lineHeight: 1.65, color: COLOR.slate, maxWidth: 820, margin: "0 auto 36px" }}>
            Scan a barcode, enter a code by hand, or search by name in seconds.
          </p>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Link
              to="/register"
              className="hk-btn"
              style={{ padding: "15px 30px", borderRadius: 8, background: COLOR.green, color: COLOR.bg, fontSize: 15, fontWeight: 700 }}
            >
              Try Hakikisha
            </Link>
          </div>
        </div>
      </section>

      <section id="why" style={{ padding: "120px var(--hk-pad-x)" }}>
        <div className="hk-grid-2col" style={{ maxWidth: 1180, margin: "0 auto", display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 64, alignItems: "center" }}>
          <div style={{ position: "relative", height: 420, borderRadius: 24, overflow: "hidden" }}>
            <img
              src="/assets/pills-face.png"
              alt="Face surrounded by loose pills and capsules"
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: COLOR.slate, marginBottom: 18 }}>
              the problem
            </div>
            <h2
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 900,
                fontSize: 38,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: COLOR.green,
                margin: "0 0 26px",
              }}
            >
              Counterfeit medicine reaches millions before anyone checks.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: COLOR.slate, margin: "0 0 16px" }}>
              <strong>1 in 10</strong> medical products in developing regions is substandard or falsified,
              often indistinguishable from the real thing by sight alone.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: COLOR.slate, margin: "0 0 16px" }}>
              Hakikisha checks a pack against the official registry in <strong>seconds</strong>, before you
              pay, before you take it.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: COLOR.slate, margin: 0 }}>
              Every scan is a step closer to better health, because with Hakikisha, your health is
              literally in your hands!
            </p>
          </div>
        </div>
      </section>

      <footer style={{ padding: "22px var(--hk-pad-x)", background: COLOR.green }}>
        <div style={{ maxWidth: 1360, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 13, color: "#ffffff66" }}>© 2026 Hakikisha</div>
          <img
            src="/assets/hakikisha-logo.png"
            alt="Hakikisha"
            style={{ height: 56, width: "auto", display: "block", filter: "brightness(0) saturate(100%) invert(1)" }}
          />
        </div>
      </footer>
    </div>
  );
}
