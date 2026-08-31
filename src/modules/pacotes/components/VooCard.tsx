"use client";

import { useState } from "react";
import { ChevronDown, Plane } from "lucide-react";
import { NAVY } from "@/core/render-engine/theme";
import { FlightOption } from "@/core/data/flights";
import { FlightCard } from "@/modules/passagens/components/FlightCard";

// Resumo tipo "Recife → Monterrey" (ou "(ida e volta)" quando há mais de um
// trecho) pra linha fechada — os detalhes completos (conexões, horários)
// só aparecem ao expandir, reaproveitando o FlightCard que já existe em
// Passagens.
function resumoVoo(opcoes: FlightOption[]): string {
  const trechos = opcoes[0]?.trechos ?? [];
  if (!trechos.length) return "";
  // Sempre origem/destino do 1º trecho (a "ida") — numa viagem de ida e
  // volta o último trecho retorna à cidade de origem, então usá-lo aqui
  // resultaria em "São Paulo → São Paulo".
  const primeiro = trechos[0];
  const origem = primeiro.segmentos[0]?.origemCidade;
  const destino = primeiro.segmentos[primeiro.segmentos.length - 1]?.destino;
  if (!origem || !destino) return "";
  return trechos.length > 1 ? `${origem} → ${destino} (ida e volta)` : `${origem} → ${destino}`;
}

// Mesma linha-resumo + "Ver detalhes" do ProdutoCard, pra o voo aparecer
// igual aos outros produtos na página pública (em vez do card de cotação de
// passagens solto) — só o conteúdo expandido é diferente (FlightCard em vez
// de fotos/descrição).
export function VooCard({ opcoes }: { opcoes: FlightOption[] }) {
  const [aberto, setAberto] = useState(false);
  const subtitulo = resumoVoo(opcoes);

  return (
    <div style={{ border: "1px solid #e5e3dc", borderRadius: 12, background: "#fff", marginBottom: 10, overflow: "hidden" }}>
      <button
        onClick={() => setAberto((a) => !a)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0eee7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Plane size={16} color={NAVY} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.4 }}>Voo</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitulo || "Detalhes do voo"}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: NAVY, flexShrink: 0 }}>
          Ver detalhes
          <ChevronDown size={16} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </button>

      {aberto && (
        <div style={{ padding: "14px", borderTop: "1px solid #f0eee7", display: "flex", justifyContent: "center", overflowX: "auto" }}>
          <FlightCard opcoes={opcoes} />
        </div>
      )}
    </div>
  );
}
