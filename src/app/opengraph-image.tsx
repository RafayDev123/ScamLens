import { ImageResponse } from "next/og";

export const alt = "ScamLens – Check Before You Click";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#080E18", color: "#F3F7FB" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 44, fontWeight: 700 }}>
          <div style={{ width: 64, height: 64, border: "5px solid #35D6C0", borderRadius: 18, display: "flex" }} />
          Scam<span style={{ color: "#35D6C0" }}>Lens</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>Don&apos;t Trust Every Link. Verify It.</div>
        <div style={{ marginTop: 24, fontSize: 30, color: "#99A9BB" }}>Check Before You Click. Understand Before You Trust.</div>
      </div>
    ),
    size,
  );
}
