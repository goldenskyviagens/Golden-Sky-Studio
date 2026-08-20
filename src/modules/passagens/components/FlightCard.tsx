import { FlightOption } from "@/core/data/flights";
import { GOLD, NAVY_DARK } from "@/core/render-engine/theme";
import { TrechoBlock } from "./TrechoBlock";

export function FlightCard({ opcoes }: { opcoes: FlightOption[] }) {
  if (!opcoes.length) return null;
  const side = opcoes.length > 1;
  return (
    <div
      style={{
        background: NAVY_DARK,
        borderRadius: 16,
        padding: 18,
        color: "#fff",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        border: `1px solid ${GOLD}`,
        maxWidth: 420,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 18, borderBottom: `1px solid rgba(201,162,39,0.4)`, paddingBottom: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/branding/logo-golden-sky.png" alt="Golden Sky Viagens" style={{ height: 54, width: "auto" }} />
      </div>
      <div style={{ display: side ? "grid" : "block", gridTemplateColumns: side ? `repeat(${Math.min(opcoes.length, 2)}, 1fr)` : undefined, gap: 16 }}>
        {opcoes.map((op, i) => (
          <div key={op.id} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, border: `1px solid rgba(201,162,39,0.25)` }}>
            {opcoes.length > 1 && <div style={{ fontSize: 11, fontWeight: 700, color: GOLD, marginBottom: 8 }}>OPÇÃO {i + 1}</div>}
            {op.trechos.map((t, ti) => (
              <div key={t.id}>
                <TrechoBlock trecho={t} />
                {ti < op.trechos.length - 1 && <div style={{ borderTop: "1px solid rgba(201,162,39,0.5)", margin: "18px 0" }} />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
