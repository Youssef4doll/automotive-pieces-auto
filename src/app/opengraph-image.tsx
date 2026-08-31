import { ImageResponse } from "next/og";

export const alt = "Automotive Pièces Auto — pièces détachées vérifiées en Tunisie";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card that appears when the site is shared on WhatsApp, Facebook or
 * Messenger — which, in this market, is most of how a shop link travels.
 *
 * Generated rather than a static file so it stays in step with the brand and
 * needs no design round-trip. Drawn with plain layout and system-weight text:
 * loading a webfont here would add a network fetch to every share preview for
 * a difference nobody sees at thumbnail size.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f2352",
          padding: 72,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: "#fbc000",
              color: "#0f2352",
              fontSize: 34,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 12,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 2 }}>AUTOMOTIVE</div>
          <div style={{ fontSize: 20, color: "#fbc000", letterSpacing: 6 }}>PIÈCES AUTO</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 900 }}>
            La bonne pièce, vérifiée pour votre voiture.
          </div>
          <div style={{ fontSize: 30, color: "#c7d2e8", maxWidth: 860 }}>
            Livraison 24h Grand Tunis · 48–72h régions · Paiement à la livraison
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Compatibilité vérifiée", "Garantie 12 mois", "Retour 14 jours"].map((chip) => (
            <div
              key={chip}
              style={{
                fontSize: 22,
                padding: "10px 20px",
                borderRadius: 999,
                border: "2px solid rgba(255,255,255,0.25)",
                color: "#e8eefb",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
