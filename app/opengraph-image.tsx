import { ImageResponse } from "next/og";

// The preview a shared link shows. Pages without an image of their own inherit
// it; since the home page became the seller landing, it carries that pitch.
export const alt = "Plaza Volcanes: vende lo tuyo y quédate con todo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#32174d";
const ACCENT = "#b8ff6a";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: BRAND,
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "72px 80px",
          position: "relative",
          width: "100%",
        }}
      >
        <div style={{ alignItems: "center", display: "flex", fontSize: 30, fontWeight: 700, gap: 16, letterSpacing: 4 }}>
          <div style={{ background: ACCENT, borderRadius: 999, height: 18, width: 18 }} />
          PLAZA VOLCANES
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 88, fontWeight: 700, lineHeight: 1.02, marginTop: 48 }}>
          <span>Vende lo tuyo.</span>
          <div style={{ alignItems: "center", display: "flex", gap: 24 }}>
            <span style={{ color: ACCENT }}>Quédate con</span>
            <span
              style={{
                background: ACCENT,
                borderRadius: 26,
                boxShadow: "0 8px 0 #1f0d31",
                color: BRAND,
                display: "flex",
                padding: "0 22px 10px",
                transform: "rotate(-2.5deg)",
              }}
            >
              todo.
            </span>
          </div>
        </div>

        <div style={{ color: "rgba(255,255,255,0.78)", display: "flex", fontSize: 32, marginTop: 34 }}>
          0% comisión para las primeras 100 tiendas.
        </div>

        {/* The brand's volcano line, the same paths as VolcanoMark. */}
        <svg
          fill="none"
          height="170"
          style={{ bottom: 20, left: 440, position: "absolute" }}
          viewBox="0 0 640 170"
          width="640"
        >
          <path
            d="M8 152c76-2 107-16 148-46 34-25 56-35 83-14 17 14 27 10 44-9l57-65 70 78c16 18 29 17 47 3 24-19 42-14 73 12 32 27 60 38 102 40"
            stroke={ACCENT}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.55"
            strokeWidth="13"
          />
          <path d="m303 61 37-43 38 43-20-8-18 14-17-13-20 7Z" fill={ACCENT} fillOpacity="0.55" />
        </svg>

        <div style={{ bottom: 64, color: "rgba(255,255,255,0.7)", display: "flex", fontSize: 26, left: 80, position: "absolute" }}>
          plazavolcanes.com
        </div>
      </div>
    ),
    size,
  );
}
