import { Plane, Clock } from "lucide-react";
import { Trecho } from "@/core/data/flights";
import { GOLD } from "../theme";

export function TrechoBlock({ trecho }: { trecho: Trecho }) {
  const segs = trecho.segmentos.filter((s) => s.origemCidade || s.destino);
  if (!segs.length) return null;
  const first = segs[0];
  const last = segs[segs.length - 1];
  const paradas = trecho.conexoes.map((c) => (c.local ? `${c.local}${c.iata ? " (" + c.iata + ")" : ""}` : "")).filter(Boolean);
  const origemIata = (first.origemAeroporto || "").split(" · ")[0].trim();
  const destinoIata = (last.destinoAeroporto || "").split(" · ")[0].trim();
  return (
    <div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${GOLD}`, borderRadius: 999, padding: "5px 14px", marginBottom: 18 }}>
        <Plane size={12} color={GOLD} style={{ transform: "rotate(-40deg)" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, letterSpacing: 0.5 }}>
          {trecho.label?.toUpperCase()}
          {trecho.data && ` | ${trecho.data}`}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{first.saida}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
            {first.origemCidade}
            {origemIata && ` (${origemIata})`}
          </div>
        </div>
        <div style={{ flex: "1 1 60px", minWidth: 50, position: "relative", height: 0, borderTop: `1px dashed ${paradas.length ? GOLD : "rgba(255,255,255,0.35)"}`, marginTop: 14 }}>
          <div style={{ position: "absolute", top: -30, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }}>
            {trecho.duracaoTotal && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{trecho.duracaoTotal}</div>}
            {paradas.length > 0 ? (
              <div style={{ fontSize: 10, color: GOLD }}>
                {paradas.length} parada{paradas.length > 1 ? "s" : ""} {paradas.join(", ")}
              </div>
            ) : (
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>Voo direto</div>
            )}
          </div>
          {paradas.length > 0 && <div style={{ position: "absolute", top: -3, left: 0, width: 6, height: 6, borderRadius: "50%", background: GOLD }} />}
          <div
            style={{
              position: "absolute",
              top: -4,
              right: -1,
              width: 0,
              height: 0,
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
              borderLeft: `7px solid ${paradas.length ? GOLD : "rgba(255,255,255,0.5)"}`,
            }}
          />
        </div>
        <div style={{ minWidth: 0, textAlign: "right" }}>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{last.chegada}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>
            {last.destino}
            {destinoIata && ` (${destinoIata})`}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18, paddingLeft: 4, borderLeft: "1px dashed rgba(255,255,255,0.25)" }}>
        {segs.map((s, idx) => (
          <div key={s.id}>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.85)", padding: "4px 0 4px 12px" }}>
              <span style={{ color: GOLD, fontWeight: 600 }}>
                {s.cia} {s.numeroVoo}
              </span>
              {"  "}
              {s.saida} {s.origemCidade} → {s.chegada} {s.destino}
              {s.duracaoVoo && <span style={{ color: "rgba(255,255,255,0.5)" }}> ({s.duracaoVoo})</span>}
            </div>
            {idx < segs.length - 1 && trecho.conexoes[idx] && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, margin: "4px 0 4px 12px", fontSize: 10.5, color: "#031a5b", background: "rgba(201,162,39,0.9)", padding: "3px 10px", borderRadius: 5 }}>
                <Clock size={11} color="#031a5b" />
                {trecho.conexoes[idx].duracao || "—"} de conexão em {trecho.conexoes[idx].local || "—"}
                {trecho.conexoes[idx].iata && ` (${trecho.conexoes[idx].iata})`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
