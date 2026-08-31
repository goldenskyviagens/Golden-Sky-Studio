"use client";

import { useState } from "react";
import { Car, ChevronDown, Hotel, Ticket, CheckCircle2 } from "lucide-react";
import { NAVY } from "@/core/render-engine/theme";
import { Produto } from "../types";

const ICONE_POR_TIPO = { hospedagem: Hotel, transfer: Car, atividade: Ticket };
const LABEL_POR_TIPO = { hospedagem: "Hospedagem", transfer: "Transfer", atividade: "Atividade" };

// Linha resumida (ícone + título + subtítulo) que expande em "Ver detalhes"
// pra mostrar fotos, descrição e itens inclusos — página como um "site de
// vendas": só quem quer saber mais clica. Client component isolado (mesmo
// padrão de PrintButton.tsx) dentro do PropostaView, que continua majoritariamente
// server-safe.
export function ProdutoCard({ produto }: { produto: Produto }) {
  const [aberto, setAberto] = useState(false);
  const Icone = ICONE_POR_TIPO[produto.tipo];

  return (
    <div style={{ border: "1px solid #e5e3dc", borderRadius: 12, background: "#fff", marginBottom: 10, overflow: "hidden" }}>
      <button
        onClick={() => setAberto((a) => !a)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f0eee7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icone size={16} color={NAVY} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: 0.4 }}>{LABEL_POR_TIPO[produto.tipo]}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{produto.titulo || "Sem título"}</div>
          {produto.subtitulo && <div style={{ fontSize: 12, color: "#777", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{produto.subtitulo}</div>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: NAVY, flexShrink: 0 }}>
          Ver detalhes
          <ChevronDown size={16} style={{ transform: aberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>
      </button>

      {aberto && (
        <div style={{ padding: "0 14px 16px", borderTop: "1px solid #f0eee7" }}>
          {produto.fotos.length > 0 && (
            <div style={{ display: "flex", gap: 8, overflowX: "auto", padding: "12px 0", marginBottom: 4 }}>
              {produto.fotos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={`${produto.titulo} ${i + 1}`} style={{ height: 130, width: 170, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              ))}
            </div>
          )}
          {produto.descricao && <p style={{ fontSize: 13, color: "#555", lineHeight: 1.55, marginTop: produto.fotos.length ? 0 : 12 }}>{produto.descricao}</p>}
          {produto.itensInclusos.some(Boolean) && (
            <div style={{ marginTop: 10 }}>
              {produto.itensInclusos.filter(Boolean).map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12.5, color: "#333", marginBottom: 5 }}>
                  <CheckCircle2 size={14} color="#2f9e5b" style={{ flexShrink: 0, marginTop: 1 }} /> {item}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
