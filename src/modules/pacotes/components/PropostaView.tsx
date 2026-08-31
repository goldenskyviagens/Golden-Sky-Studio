import { CalendarDays, Users, MapPin, CheckCircle2, XCircle, MessageCircle } from "lucide-react";
import { dateISOtoBR } from "@/core/data/dates";
import { installmentTable } from "@/core/data/installments";
import { fmtMoney } from "@/core/data/money";
import { BRAND_LOGO_SRC, GOLD, NAVY, NAVY_DARK } from "@/core/render-engine/theme";
import { Proposta } from "../types";
import { ProdutoCard } from "./ProdutoCard";
import { VooCard } from "./VooCard";

// Ordem fixa de apresentação na página pública (voo sempre primeiro, depois
// hospedagem, transfer, passeio, seguro) — independente da ordem em que o
// agente adicionou cada produto no builder.
const ORDEM_TIPO: Record<string, number> = { hospedagem: 0, transfer: 1, atividade: 2, seguro: 3 };

function whatsappHref(numero: string, destino: string) {
  const digits = numero.replace(/\D/g, "");
  const texto = encodeURIComponent(`Olá! Tenho interesse na proposta de viagem para ${destino || "o destino combinado"}.`);
  return `https://wa.me/${digits}?text=${texto}`;
}

// Componente puramente apresentacional — sem chamada a banco — pra poder ser
// usado tanto no preview ao vivo do builder (client) quanto na página pública
// (Server Component em src/app/proposta/[id]/page.tsx).
export function PropostaView({ proposta }: { proposta: Proposta }) {
  const table = installmentTable(proposta.precoPix, proposta.taxas);
  const destaqueRow = table.find((r) => r.n === Number(proposta.parcelaDestaque));
  const dataInicioBR = dateISOtoBR(proposta.dataInicio);
  const dataFimBR = dateISOtoBR(proposta.dataFim);
  const periodo = dataInicioBR && dataFimBR ? `${dataInicioBR} a ${dataFimBR}` : dataInicioBR || dataFimBR || "";
  const temWhatsapp = Boolean(proposta.whatsapp.trim());
  const produtosOrdenados = [...proposta.produtos].sort((a, b) => (ORDEM_TIPO[a.tipo] ?? 99) - (ORDEM_TIPO[b.tipo] ?? 99));

  return (
    <div className="gs-proposta" style={{ background: "#f7f6f2", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#222", paddingBottom: temWhatsapp ? 84 : 32 }}>
      <div className="gs-hero" style={{ position: "relative", height: "min(52vh, 460px)", minHeight: 300, background: NAVY_DARK, overflow: "hidden" }}>
        {proposta.fotoCapaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proposta.fotoCapaUrl} alt={proposta.destino || "Destino"} className="gs-hero-photo" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        )}
        <div
          className="gs-hero-gradient"
          style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(3,26,91,0.55) 0%, rgba(3,26,91,0.35) 40%, rgba(3,26,91,0.92) 100%)" }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BRAND_LOGO_SRC} alt="Golden Sky Viagens" className="gs-hero-gradient" style={{ position: "absolute", top: 20, left: 20, height: 40, width: "auto" }} />
        <div className="gs-hero-text" style={{ position: "absolute", left: 0, right: 0, bottom: 28, padding: "0 24px" }}>
          <div style={{ display: "inline-block", background: GOLD, color: NAVY_DARK, fontWeight: 800, fontSize: 12, letterSpacing: 0.5, padding: "4px 12px", borderRadius: 999, marginBottom: 12 }}>
            PROPOSTA DE VIAGEM
          </div>
          <h1 className="gs-hero-title" style={{ color: "#fff", fontSize: "clamp(28px, 6vw, 46px)", fontWeight: 800, margin: 0, lineHeight: 1.05, textShadow: "0 2px 10px rgba(0,0,0,0.4)" }}>
            {proposta.destino || "Seu destino"}
          </h1>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: -26, position: "relative", zIndex: 1 }}>
          {periodo && <InfoChip icon={<CalendarDays size={15} color={GOLD} />} label={periodo} />}
          <InfoChip icon={<Users size={15} color={GOLD} />} label={`${proposta.pessoas} pessoa${proposta.pessoas > 1 ? "s" : ""}`} />
        </div>

        {(produtosOrdenados.length > 0 || proposta.voos.length > 0) && (
          <Section title="Serviços do pacote">
            {proposta.voos.length > 0 && <VooCard opcoes={proposta.voos} />}
            {produtosOrdenados.map((p) => (
              <ProdutoCard key={p.id} produto={p} />
            ))}
          </Section>
        )}

        {proposta.roteiro.some((d) => d.titulo || d.descricao) && (
          <Section title="Roteiro">
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {proposta.roteiro
                .filter((d) => d.titulo || d.descricao)
                .map((dia, idx) => (
                  <div key={dia.id} style={{ display: "flex", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{ width: 30, height: 30, borderRadius: "50%", background: NAVY, color: GOLD, fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      {idx < proposta.roteiro.length - 1 && <div style={{ flex: 1, width: 1, background: "#ddd", minHeight: 24 }} />}
                    </div>
                    <div style={{ paddingBottom: 20 }}>
                      {dia.titulo && <div style={{ fontWeight: 700, fontSize: 14.5, color: NAVY, marginBottom: 3 }}>{dia.titulo}</div>}
                      {dia.descricao && <div style={{ fontSize: 13.5, color: "#555", lineHeight: 1.5 }}>{dia.descricao}</div>}
                    </div>
                  </div>
                ))}
            </div>
          </Section>
        )}

        {(proposta.inclusos.some(Boolean) || proposta.naoInclusos.some(Boolean)) && (
          <Section title="O que está incluso">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                {proposta.inclusos.filter(Boolean).map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13.5, marginBottom: 6, color: "#333" }}>
                    <CheckCircle2 size={15} color="#2f9e5b" style={{ flexShrink: 0, marginTop: 1 }} /> {l}
                  </div>
                ))}
              </div>
              <div>
                {proposta.naoInclusos.filter(Boolean).map((l, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 13.5, marginBottom: 6, color: "#888" }}>
                    <XCircle size={15} color="#c0523a" style={{ flexShrink: 0, marginTop: 1 }} /> {l}
                  </div>
                ))}
              </div>
            </div>
          </Section>
        )}

        {proposta.precoPix && (
          <Section title="Investimento">
            <div style={{ background: NAVY_DARK, borderRadius: 14, border: `1px solid ${GOLD}`, padding: 20, color: "#fff", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)" }}>A partir de</div>
              <div style={{ fontSize: 34, fontWeight: 800, color: GOLD, margin: "2px 0" }}>R$ {fmtMoney(proposta.precoPix)}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>no Pix</div>
              {proposta.semJurosAte && (
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700 }}>
                  Em até {Number(proposta.semJurosAte)}x <span style={{ color: GOLD }}>sem juros</span>
                </div>
              )}
              {!proposta.semJurosAte && destaqueRow && (
                <div style={{ marginTop: 12, fontSize: 14, fontWeight: 700 }}>
                  {proposta.parcelaDestaque}x de <span style={{ color: GOLD }}>R$ {fmtMoney(destaqueRow.valor)}</span> no cartão
                </div>
              )}
            </div>
          </Section>
        )}

        {(proposta.validadeProposta || proposta.observacoes.some(Boolean)) && (
          <div style={{ marginTop: 16, fontSize: 11.5, color: "#888", lineHeight: 1.6 }}>
            {proposta.validadeProposta && <div>Proposta válida até {dateISOtoBR(proposta.validadeProposta)}.</div>}
            {proposta.observacoes.filter(Boolean).map((o, i) => (
              <div key={i}>{o}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 28, paddingTop: 20, borderTop: "1px solid #e5e3dc", color: "#999", fontSize: 11.5 }}>
          <MapPin size={13} /> Golden Sky Viagens
        </div>
      </div>

      {temWhatsapp && (
        <a
          href={whatsappHref(proposta.whatsapp, proposta.destino)}
          target="_blank"
          rel="noreferrer"
          className="gs-cta-sticky"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10,
            background: GOLD,
            color: NAVY_DARK,
            fontWeight: 800,
            fontSize: 14.5,
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            textDecoration: "none",
            boxShadow: "0 -4px 16px rgba(0,0,0,0.15)",
          }}
        >
          <MessageCircle size={18} /> Falar no WhatsApp
        </a>
      )}

      <style>{`
        @media print {
          .gs-cta-sticky { display: none !important; }
          .gs-hero { position: static !important; height: auto !important; min-height: 0 !important; padding-bottom: 16px !important; }
          .gs-hero-gradient { display: none !important; }
          .gs-hero-photo { position: static !important; display: block !important; width: 100% !important; height: 220px !important; border-radius: 8px; }
          .gs-hero-text { position: static !important; padding: 12px 0 0 !important; }
          .gs-hero-title { color: #031a5b !important; text-shadow: none !important; }
          .gs-proposta { background: #fff !important; }
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: 12, fontWeight: 800, color: NAVY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>{title}</h2>
      {children}
    </div>
  );
}

function InfoChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e5e3dc", borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, color: "#333", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
      {icon} {label}
    </div>
  );
}
