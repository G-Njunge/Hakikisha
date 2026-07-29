import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

// Ported from the design export (Hakikisha landing page design.zip) as a
// native component rather than keeping its proprietary <x-dc>/support.js
// templating runtime — same visual output, no unaudited third-party runtime
// script in the bundle. Colours are the export's actual resolved defaults
// (confirmed against its .thumbnail preview, since the CSS var() fallbacks
// baked into the original inline styles turned out to be stale placeholders
// that were never what actually rendered).
const COLOR = {
  bg: "#FDFBF7",
  text: "#1A1A2E",
  accent: "#E07A2F",
  secondary: "#0F3057",
  dark: "#0F3057",
};

function floatStyle(rotate: string, duration: string, delay = "0s"): CSSProperties {
  return {
    animation: `hk-float ${duration} ease-in-out infinite ${delay}`,
    ["--r" as string]: rotate,
  } as CSSProperties;
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", width: "100%", overflowX: "hidden", background: COLOR.bg }}>
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 56px",
          background: "rgba(253,251,247,0.9)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid rgba(26,26,46,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'Manrope', sans-serif",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.01em",
            color: COLOR.text,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: COLOR.accent, display: "inline-block" }} />
          hakikisha
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <a href="#how-it-works" style={{ fontSize: 15, fontWeight: 500, color: COLOR.text }}>
            How it works
          </a>
          <a href="#trust" style={{ fontSize: 15, fontWeight: 500, color: COLOR.text }}>
            Why it matters
          </a>
          <a href="#" style={{ fontSize: 15, fontWeight: 500, color: COLOR.text }}>
            About
          </a>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Link
            to="/login"
            style={{
              padding: "10px 22px",
              borderRadius: 999,
              border: `1.5px solid ${COLOR.text}`,
              fontSize: 14,
              fontWeight: 600,
              color: COLOR.text,
            }}
          >
            Log In
          </Link>
          <Link
            to="/register"
            style={{
              padding: "10px 24px",
              borderRadius: 999,
              background: COLOR.accent,
              fontSize: 14,
              fontWeight: 600,
              color: COLOR.bg,
            }}
          >
            Sign Up
          </Link>
        </div>
      </nav>

      <section
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          alignItems: "center",
          gap: 40,
          padding: "88px 56px 100px",
          maxWidth: 1360,
          margin: "0 auto",
          overflow: "visible",
        }}
      >
        <div style={{ position: "relative", zIndex: 2 }}>
          <h1
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: 64,
              lineHeight: 1.03,
              letterSpacing: "-0.02em",
              margin: "0 0 24px",
              color: COLOR.text,
            }}
          >
            Verify before
            <br />
            you trust.
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#1A1A2E99", maxWidth: 460, margin: "0 0 36px" }}>
            Hakikisha turns your phone into a shield against fake medicine. Scan any pack in
            seconds and know instantly if it's genuine — before it ever reaches your body.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 44 }}>
            <Link
              to="/register"
              style={{
                padding: "16px 32px",
                borderRadius: 999,
                background: COLOR.accent,
                color: COLOR.bg,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Create free account
            </Link>
            <a
              href="#how-it-works"
              style={{
                padding: "16px 28px",
                borderRadius: 999,
                border: "1.5px solid #1A1A2E33",
                color: COLOR.text,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              See how it works
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 26, color: COLOR.text }}>
                2.4M+
              </div>
              <div style={{ fontSize: 13, color: "#1A1A2E88" }}>packs verified</div>
            </div>
            <div style={{ width: 1, height: 32, background: "#1A1A2E22" }} />
            <div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 26, color: COLOR.text }}>
                &lt; 3 sec
              </div>
              <div style={{ fontSize: 13, color: "#1A1A2E88" }}>to verify a pack</div>
            </div>
            <div style={{ width: 1, height: 32, background: "#1A1A2E22" }} />
            <div>
              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 26, color: COLOR.text }}>
                100%
              </div>
              <div style={{ fontSize: 13, color: "#1A1A2E88" }}>free for patients</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 14, width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexDirection: "column", flex: "none" }}>
            <div
              style={{
                position: "relative",
                width: 76,
                height: 104,
                borderRadius: 10,
                background: `repeating-linear-gradient(135deg, ${COLOR.secondary}, ${COLOR.secondary} 6px, #0F305799 6px, #0F305799 12px)`,
                border: "1px solid #E07A2F55",
                boxShadow: "0 14px 24px -12px rgba(26,26,46,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: "#1A1A2Ecc",
                textAlign: "center",
                padding: 6,
                ...floatStyle("-6deg", "6s"),
              }}
            >
              blister
              <br />
              pack
            </div>
            <div
              style={{
                position: "relative",
                width: 92,
                height: 64,
                borderRadius: 9,
                background: `repeating-linear-gradient(45deg, ${COLOR.dark}, ${COLOR.dark} 6px, #0F305799 6px, #0F305799 12px)`,
                border: "1px solid #0F305755",
                boxShadow: "0 12px 20px -10px rgba(26,26,46,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "ui-monospace, monospace",
                fontSize: 8.5,
                color: "#FDFBF7ee",
                textAlign: "center",
                padding: 6,
                ...floatStyle("5deg", "7s", "0.6s"),
              }}
            >
              medicine
              <br />
              box
            </div>
          </div>

          <div
            style={{
              position: "relative",
              zIndex: 3,
              width: 250,
              height: 510,
              flex: "none",
              borderRadius: 40,
              background: COLOR.dark,
              padding: 12,
              boxShadow: "0 40px 70px -24px rgba(26,26,46,0.5)",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 32,
                background: COLOR.bg,
                overflow: "hidden",
                position: "relative",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 90,
                  height: 22,
                  borderRadius: 12,
                  background: COLOR.dark,
                  zIndex: 5,
                }}
              />
              <div style={{ padding: "56px 20px 14px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 14, color: COLOR.text }}>
                  Scanning package…
                </div>
              </div>
              <div
                style={{
                  flex: 1,
                  margin: "6px 18px 22px",
                  borderRadius: 20,
                  background: "#0F305722",
                  border: `1.5px dashed ${COLOR.secondary}`,
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "70%",
                    height: "60%",
                    borderRadius: 10,
                    background: `repeating-linear-gradient(135deg, ${COLOR.secondary}, ${COLOR.secondary} 8px, #0F3057aa 8px, #0F3057aa 16px)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 10,
                    color: "#1A1A2Eaa",
                    textAlign: "center",
                    padding: 8,
                  }}
                >
                  medicine
                  <br />
                  pack photo
                </div>
                <div
                  style={{
                    position: "absolute",
                    left: "8%",
                    width: "84%",
                    height: 3,
                    background: `linear-gradient(90deg, transparent, ${COLOR.accent}, transparent)`,
                    boxShadow: "0 0 12px 2px #E07A2Faa",
                    animation: "hk-scan 4.5s ease-in-out infinite",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#FDFBF7cc",
                    opacity: 0,
                    animation: "hk-checkpop 4.5s ease-in-out infinite",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: COLOR.accent,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 12,
                          borderLeft: `4px solid ${COLOR.bg}`,
                          borderBottom: `4px solid ${COLOR.bg}`,
                          transform: "rotate(-45deg) translate(2px,-2px)",
                        }}
                      />
                    </div>
                    <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 15, color: COLOR.text }}>
                      Genuine
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ padding: "0 20px 20px", display: "flex", justifyContent: "center" }}>
                <div style={{ width: 120, height: 5, borderRadius: 3, background: COLOR.dark }} />
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: "none" }}>
            <div
              style={{
                position: "relative",
                width: 70,
                height: 70,
                borderRadius: "50%",
                background: `repeating-linear-gradient(90deg, ${COLOR.accent}, ${COLOR.accent} 5px, #E07A2F99 5px, #E07A2F99 10px)`,
                boxShadow: "0 12px 20px -10px rgba(26,26,46,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: "#FDFBF7ee",
                textAlign: "center",
                padding: 6,
                ...floatStyle("0deg", "5.5s", "1.1s"),
              }}
            >
              tablet
              <br />
              bottle
            </div>
            <div
              style={{
                position: "relative",
                width: 88,
                height: 56,
                borderRadius: 8,
                background: `repeating-linear-gradient(135deg, ${COLOR.text}, ${COLOR.text} 6px, #1A1A2E99 6px, #1A1A2E99 12px)`,
                boxShadow: "0 12px 20px -10px rgba(26,26,46,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "ui-monospace, monospace",
                fontSize: 8,
                color: "#FDFBF7ee",
                textAlign: "center",
                padding: 6,
                ...floatStyle("-3deg", "6.5s", "0.3s"),
              }}
            >
              strip
              <br />
              label
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" style={{ padding: "100px 56px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: COLOR.accent,
              marginBottom: 12,
            }}
          >
            How it works
          </div>
          <h2
            style={{
              fontFamily: "'Manrope', sans-serif",
              fontWeight: 800,
              fontSize: 42,
              letterSpacing: "-0.01em",
              color: COLOR.text,
              margin: "0 0 16px",
            }}
          >
            Three steps to certainty
          </h2>
          <p style={{ fontSize: 17, color: "#1A1A2E99", maxWidth: 520, margin: "0 auto" }}>
            No account setup, no waiting on a lab. Just open the app, point your camera, and get
            an answer.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 64, alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            {[
              { n: 1, title: "Scan the pack", body: "Point your camera at the medicine box or blister strip's security code." },
              { n: 2, title: "We check the registry", body: "Hakikisha cross-references the code against manufacturer and regulator records." },
              { n: 3, title: "Get an instant answer", body: "A clear Genuine or Not Verified result, with what to do next." },
            ].map((step) => (
              <div
                key={step.n}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  padding: 22,
                  borderRadius: 16,
                  background: "#ffffff80",
                  border: "1px solid #1A1A2E12",
                }}
              >
                <div
                  style={{
                    flex: "none",
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#0F305755",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Manrope', sans-serif",
                    fontWeight: 800,
                    fontSize: 17,
                    color: COLOR.text,
                  }}
                >
                  {step.n}
                </div>
                <div>
                  <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 18, color: COLOR.text, marginBottom: 6 }}>
                    {step.title}
                  </div>
                  <div style={{ fontSize: 15, lineHeight: 1.55, color: "#1A1A2E99" }}>{step.body}</div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              position: "relative",
              height: 420,
              borderRadius: 28,
              background: COLOR.dark,
              overflow: "hidden",
              boxShadow: "0 30px 60px -20px rgba(26,26,46,0.4)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                animation: "hk-cycle1 8s linear infinite",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
                <div
                  style={{
                    width: 140,
                    height: 180,
                    borderRadius: 14,
                    background: `repeating-linear-gradient(135deg, ${COLOR.secondary}, ${COLOR.secondary} 8px, #0F3057cc 8px, #0F3057cc 16px)`,
                    position: "relative",
                    boxShadow: "0 20px 40px -14px rgba(0,0,0,0.5)",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      width: "100%",
                      height: 3,
                      background: `linear-gradient(90deg, transparent, ${COLOR.bg}, transparent)`,
                      boxShadow: "0 0 14px 3px #FDFBF7cc",
                      animation: "hk-scan 2.4s ease-in-out infinite",
                    }}
                  />
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15, color: COLOR.bg }}>
                  Scanning security code…
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                animation: "hk-cycle2 8s linear infinite",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    border: "5px solid #E07A2F55",
                    borderTopColor: COLOR.secondary,
                    animation: "hk-pulsering 1.4s linear infinite",
                  }}
                />
                <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 700, fontSize: 15, color: COLOR.bg }}>
                  Checking registry…
                </div>
              </div>
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                animation: "hk-cycle3 8s linear infinite",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
                <div
                  style={{
                    width: 96,
                    height: 96,
                    borderRadius: "50%",
                    background: COLOR.secondary,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 20,
                      borderLeft: `5px solid ${COLOR.text}`,
                      borderBottom: `5px solid ${COLOR.text}`,
                      transform: "rotate(-45deg) translate(3px,-3px)",
                    }}
                  />
                </div>
                <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 20, color: COLOR.bg }}>
                  Verified genuine
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="trust" style={{ padding: "0 56px 120px", maxWidth: 1280, margin: "0 auto" }}>
        <div
          style={{
            borderRadius: 28,
            background: COLOR.dark,
            padding: "64px 60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 48,
          }}
        >
          <div style={{ maxWidth: 520 }}>
            <h3
              style={{
                fontFamily: "'Manrope', sans-serif",
                fontWeight: 800,
                fontSize: 34,
                color: COLOR.bg,
                margin: "0 0 14px",
                letterSpacing: "-0.01em",
              }}
            >
              Your health deserves certainty.
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#FDFBF7cc", margin: 0 }}>
              Join millions of patients making sure what they take is what it claims to be. Free,
              fast, and always in your corner.
            </p>
          </div>
          <Link
            to="/register"
            style={{
              flex: "none",
              padding: "18px 38px",
              borderRadius: 999,
              background: COLOR.bg,
              color: COLOR.text,
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            Get Hakikisha free
          </Link>
        </div>
      </section>

      <footer
        style={{
          padding: "40px 56px",
          borderTop: "1px solid #1A1A2E15",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          maxWidth: 1360,
          margin: "0 auto",
        }}
      >
        <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 16, color: COLOR.text }}>
          hakikisha
        </div>
        <div style={{ fontSize: 13, color: "#1A1A2E77" }}>© 2026 Hakikisha. Verify before you trust.</div>
      </footer>
    </div>
  );
}
