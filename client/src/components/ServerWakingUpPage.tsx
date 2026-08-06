// Ported from the uploaded design export ("Hakikisha Buffer.dc.html") as a
// native component rather than keeping its proprietary <x-dc>/support.js
// templating runtime — same visual output (pulsing logo, expanding rings,
// animated dots), no unaudited third-party runtime script in the bundle.
// Reuses the same bg-waves/logo assets already shipped for LandingPage.tsx.
export default function ServerWakingUpPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        overflowX: "hidden",
        background: "#E4E7ED url('/assets/bg-waves.png') center top / cover fixed no-repeat",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: 32,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 40 }}>
        <div
          className="hk-wake-ring"
          style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", border: "2px solid #103c1c" }}
        />
        <div
          className="hk-wake-ring"
          style={{ position: "absolute", width: 140, height: 140, borderRadius: "50%", border: "2px solid #103c1c", animationDelay: "1.2s" }}
        />
        <img
          src="/assets/hakikisha-logo.png"
          alt="Hakikisha"
          className="hk-wake-pulse"
          style={{ height: 88, width: "auto", display: "block", position: "relative", zIndex: 1 }}
        />
      </div>

      <h1
        style={{
          fontFamily: "'Manrope', sans-serif",
          fontWeight: 900,
          fontSize: 32,
          lineHeight: 1.2,
          letterSpacing: "-0.01em",
          margin: "0 0 14px",
          color: "#103c1c",
        }}
      >
        Waking up the servers
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: "#3e4440", maxWidth: 440, margin: "0 0 6px" }}>
        Hakikisha is warming up. This can take <strong>30–60 seconds</strong> on first load.
      </p>
      <p style={{ fontSize: 17, lineHeight: 1.6, color: "#3e4440", maxWidth: 440, margin: "0 0 30px" }}>
        Hang tight, we're almost ready.
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        <span className="hk-wake-dot" style={{ width: 9, height: 9, borderRadius: "50%", background: "#103c1c" }} />
        <span className="hk-wake-dot" style={{ width: 9, height: 9, borderRadius: "50%", background: "#103c1c", animationDelay: "0.2s" }} />
        <span className="hk-wake-dot" style={{ width: 9, height: 9, borderRadius: "50%", background: "#103c1c", animationDelay: "0.4s" }} />
      </div>
    </div>
  );
}
