import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Cascade: rent a car from a local host in Seattle";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card shown when a link to Cascade is shared. Car pages use their own photo. */
export default async function Image() {
  const manrope = await readFile(join(process.cwd(), "assets/Manrope-ExtraBold.ttf"));
  // The logo mark (components/layout/Logo.tsx) at 76px: its 48-unit grid times 1.58.
  const bar = (x: number, y: number, w: number, color: string) => (
    <div style={{ position: "absolute", left: x * 1.58, top: y * 1.58, width: w * 1.58, height: 12.6, borderRadius: 6.3, background: color }} />
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#CFE2FF",
          color: "#111111",
          fontFamily: "Manrope",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ position: "relative", display: "flex", width: 76, height: 76, borderRadius: 20.6, background: "#111111" }}>
            {bar(8, 10, 21, "#CFE2FF")}
            {bar(14, 20, 21, "#C9EED6")}
            {bar(20, 30, 20, "#FFE7A0")}
          </div>
          <div style={{ fontSize: 52, letterSpacing: -1.5 }}>Cascade</div>
        </div>
        <div style={{ fontSize: 104, lineHeight: 1, letterSpacing: -4, maxWidth: 1000 }}>
          Borrow a car from someone nearby.
        </div>
        <div style={{ fontSize: 32, color: "#1D2A44" }}>Seattle · Full price up front · Pick up from the host</div>
      </div>
    ),
    { ...size, fonts: [{ name: "Manrope", data: manrope, weight: 800, style: "normal" }] }
  );
}
