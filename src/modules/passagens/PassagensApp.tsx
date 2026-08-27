"use client";

import React, { useMemo, useRef, useState } from "react";
import { Copy, Check, Plus, Trash2, Loader2, Image as ImageIcon, X, Download } from "lucide-react";
import {
  BAGAGEM_PRESETS,
  FlightOption,
  Segmento,
  baggageFromAirlines,
  emptyConexao,
  emptyOption,
  emptySegmento,
  emptyTrecho,
  mergeConnectingOpcoes,
} from "@/core/data/flights";
import { TAXAS_PADRAO, TaxaParcela, installmentTable } from "@/core/data/installments";
import { fmtMoney } from "@/core/data/money";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { buildCaption } from "./caption";
import { FlightCard } from "./components/FlightCard";
import { downloadFlightCard } from "./download-card";
import { NAVY, GOLD } from "@/core/render-engine/theme";

interface PendingImage {
  file: File;
  url: string;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function PassagensApp() {
  const [opcoes, setOpcoes] = useState<FlightOption[]>([emptyOption()]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");
  const captionRef = useRef<HTMLPreElement>(null);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [taxas, setTaxas] = useState<TaxaParcela[]>(TAXAS_PADRAO);
  const [showTaxas, setShowTaxas] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function updateTaxa(n: number, percent: number) {
    setTaxas((prev) => prev.map((t) => (t.n === n ? { ...t, taxaPercent: percent } : t)));
  }

  const active = opcoes.find((o) => o.id === activeId) || opcoes[0];

  async function downloadCard() {
    setDownloading(true);
    setError("");
    try {
      await downloadFlightCard(active);
    } catch (e) {
      console.error(e);
      setError("Não consegui gerar a imagem pra download.");
    } finally {
      setDownloading(false);
    }
  }

  function addImages(files: FileList | null | undefined) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    setPendingImages((prev) => [...prev, ...arr.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
  }
  function removePendingImage(i: number) {
    setPendingImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function processImages() {
    if (!pendingImages.length) return;
    setLoading(true);
    setError("");
    try {
      const images = await Promise.all(
        pendingImages.map(async ({ file }) => ({
          mediaType: file.type || "image/png",
          base64: await fileToBase64(file),
        }))
      );

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });

      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed?.error || "Erro ao processar imagens.");

      const opcoesExtraidas = (parsed.opcoes || []).map((op: { trechos?: unknown[]; precoPix?: string }) => {
        const trechosRaw = (op.trechos || []) as Array<{
          label?: string;
          data?: string;
          duracaoTotal?: string;
          segmentos?: Array<Partial<Segmento>>;
          conexoes?: Array<{ local?: string; iata?: string; duracao?: string }>;
        }>;
        const trechos = trechosRaw.map((t, idx) => ({
          id: Math.random().toString(36).slice(2, 9),
          label: t.label || (idx === 0 ? "Ida" : idx === 1 ? "Volta" : `Trecho ${idx + 1}`),
          data: t.data || "",
          duracaoTotal: t.duracaoTotal || "",
          segmentos: (t.segmentos || []).map((s) => ({
            id: Math.random().toString(36).slice(2, 9),
            cia: s.cia || "",
            numeroVoo: s.numeroVoo || "",
            origemCidade: s.origemCidade || "",
            destino: s.destino || "",
            origemAeroporto: s.origemAeroporto || "",
            destinoAeroporto: s.destinoAeroporto || "",
            saida: s.saida || "",
            chegada: s.chegada || "",
            duracaoVoo: s.duracaoVoo || "",
          })),
          conexoes: (t.conexoes || []).map((c) => ({ id: Math.random().toString(36).slice(2, 9), local: c.local || "", iata: c.iata || "", duracao: c.duracao || "" })),
        }));
        return { trechos, precoPix: op.precoPix || "" };
      });

      // Reservas/imagens diferentes que formam uma única viagem contínua (ex:
      // Recife->Guarulhos numa, Guarulhos->Monterrey noutra) às vezes saem em
      // "opções" separadas — junta as que se conectam por cidade (somando o
      // preço), mantendo separadas as que são alternativas de preço de verdade.
      const opcoesMescladas = mergeConnectingOpcoes(opcoesExtraidas);

      const novasOpcoes = opcoesMescladas.map(({ trechos, precoPix }) => {
        const base = emptyOption();
        const allCias = trechos.flatMap((t) => t.segmentos.map((s) => s.cia));
        return { ...base, trechos: trechos.length ? trechos : [emptyTrecho("Ida")], bagagemPreset: baggageFromAirlines(allCias), precoPix };
      });

      setOpcoes(novasOpcoes.length ? novasOpcoes : [emptyOption()]);
      setActiveId(novasOpcoes[0]?.id);
      setPendingImages([]);
    } catch (e) {
      console.error(e);
      setError("Não consegui ler os prints automaticamente. Ajuste os campos manualmente abaixo.");
    } finally {
      setLoading(false);
    }
  }

  function updateOpcao(id: string, patch: Partial<FlightOption>) {
    setOpcoes((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  function updateTrecho(opId: string, trechoId: string, patch: Partial<FlightOption["trechos"][number]>) {
    setOpcoes((prev) => prev.map((o) => (o.id !== opId ? o : { ...o, trechos: o.trechos.map((t) => (t.id === trechoId ? { ...t, ...patch } : t)) })));
  }
  function updateSegmento(opId: string, trechoId: string, segId: string, patch: Partial<Segmento>) {
    setOpcoes((prev) =>
      prev.map((o) =>
        o.id !== opId
          ? o
          : {
              ...o,
              trechos: o.trechos.map((t) => (t.id !== trechoId ? t : { ...t, segmentos: t.segmentos.map((s) => (s.id === segId ? { ...s, ...patch } : s)) })),
            }
      )
    );
  }
  function addSegmento(opId: string, trechoId: string) {
    setOpcoes((prev) =>
      prev.map((o) =>
        o.id !== opId
          ? o
          : {
              ...o,
              trechos: o.trechos.map((t) => (t.id !== trechoId ? t : { ...t, segmentos: [...t.segmentos, emptySegmento()], conexoes: [...t.conexoes, emptyConexao()] })),
            }
      )
    );
  }
  function removeUltimoSegmento(opId: string, trechoId: string) {
    setOpcoes((prev) =>
      prev.map((o) =>
        o.id !== opId
          ? o
          : {
              ...o,
              trechos: o.trechos.map((t) => (t.id !== trechoId || t.segmentos.length <= 1 ? t : { ...t, segmentos: t.segmentos.slice(0, -1), conexoes: t.conexoes.slice(0, -1) })),
            }
      )
    );
  }
  function updateConexao(opId: string, trechoId: string, idx: number, patch: Partial<FlightOption["trechos"][number]["conexoes"][number]>) {
    setOpcoes((prev) =>
      prev.map((o) =>
        o.id !== opId
          ? o
          : {
              ...o,
              trechos: o.trechos.map((t) => (t.id !== trechoId ? t : { ...t, conexoes: t.conexoes.map((c, i) => (i === idx ? { ...c, ...patch } : c)) })),
            }
      )
    );
  }
  function addTrecho(opId: string) {
    setOpcoes((prev) => prev.map((o) => (o.id !== opId ? o : { ...o, trechos: [...o.trechos, emptyTrecho(`Trecho ${o.trechos.length + 1}`)] })));
  }
  function removeTrecho(opId: string, trechoId: string) {
    setOpcoes((prev) => prev.map((o) => (o.id !== opId ? o : { ...o, trechos: o.trechos.filter((t) => t.id !== trechoId) })));
  }
  function removeOpcao(id: string) {
    setOpcoes((prev) => {
      const next = prev.filter((o) => o.id !== id);
      return next.length ? next : [emptyOption()];
    });
  }
  function addOpcao() {
    setOpcoes((prev) => [...prev, emptyOption()]);
  }
  function updateCondicao(opId: string, idx: number, value: string) {
    setOpcoes((prev) => prev.map((o) => (o.id !== opId ? o : { ...o, condicoes: o.condicoes.map((c, i) => (i === idx ? value : c)) })));
  }
  function addCondicao(opId: string) {
    setOpcoes((prev) => prev.map((o) => (o.id !== opId ? o : { ...o, condicoes: [...o.condicoes, ""] })));
  }
  function removeCondicao(opId: string, idx: number) {
    setOpcoes((prev) => prev.map((o) => (o.id !== opId ? o : { ...o, condicoes: o.condicoes.filter((_, i) => i !== idx) })));
  }

  const caption = useMemo(() => buildCaption(active, taxas), [active, taxas]);
  const table = useMemo(() => (active ? installmentTable(active.precoPix, taxas) : []), [active, taxas]);

  async function handleCopy() {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(caption);
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = caption;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }

    if (ok) {
      setCopied(true);
      setCopyMsg("");
      setTimeout(() => setCopied(false), 1500);
    } else {
      const el = captionRef.current;
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setCopyMsg("Não consegui copiar automático — selecionei o texto, aperte Ctrl+C (ou Cmd+C no Mac).");
    }
  }

  if (!active) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f6", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Gerador de Cotação · Golden Sky Viagens</h1>
        <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>Anexe um ou mais prints (ida, volta, multi-trecho) e ajuste os detalhes da tarifa.</p>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addImages(e.dataTransfer.files);
          }}
          onPaste={(e) => {
            const items = e.clipboardData?.files;
            if (items && items.length) addImages(items);
          }}
          tabIndex={0}
          style={{ border: `2px dashed ${GOLD}`, borderRadius: 12, padding: 20, textAlign: "center", cursor: "pointer", background: "#fff", marginBottom: 12 }}
        >
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => addImages(e.target.files)} />
          <ImageIcon size={20} color={GOLD} style={{ marginBottom: 4 }} />
          <div style={{ color: "#555", fontSize: 13 }}>Clique, arraste ou cole (Ctrl+V) — pode anexar vários prints</div>
        </div>

        {pendingImages.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
            {pendingImages.map((p, i) => (
              <div key={i} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="print" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid #ddd" }} />
                <button onClick={() => removePendingImage(i)} style={{ position: "absolute", top: -6, right: -6, background: "#b3441a", color: "#fff", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer" }}>
                  <X size={12} />
                </button>
              </div>
            ))}
            <button onClick={processImages} disabled={loading} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", height: 40, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {loading ? <Loader2 className="animate-spin-slow" size={16} /> : `Ler ${pendingImages.length} print(s)`}
            </button>
          </div>
        )}

        {error && <div style={{ background: "#fff3f0", color: "#b3441a", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {opcoes.map((op, i) => (
            <button
              key={op.id}
              onClick={() => setActiveId(op.id)}
              style={{ padding: "6px 14px", borderRadius: 999, border: `1px solid ${active.id === op.id ? NAVY : "#ccc"}`, background: active.id === op.id ? NAVY : "#fff", color: active.id === op.id ? "#fff" : "#333", fontSize: 12, cursor: "pointer" }}
            >
              Opção {i + 1}
            </button>
          ))}
          <button onClick={addOpcao} style={{ padding: "6px 14px", borderRadius: 999, border: `1px dashed ${NAVY}`, background: "#fff", color: NAVY, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> Nova opção
          </button>
          {opcoes.length > 1 && (
            <button onClick={() => removeOpcao(active.id)} style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #eee", background: "#fff", color: "#b3441a", fontSize: 12, cursor: "pointer" }}>
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20, alignItems: "start" }}>
          <div>
            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <label style={fieldLabel}>Rótulo da rota (opcional, senão calcula automático)</label>
              <input value={active.rotulo} onChange={(e) => updateOpcao(active.id, { rotulo: e.target.value })} placeholder="Ex: João Pessoa ➜ Curitiba" style={inputStyle} />

              {active.trechos.map((t) => (
                <div key={t.id} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #eee" }}>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <input value={t.label} onChange={(e) => updateTrecho(active.id, t.id, { label: e.target.value })} style={{ ...inputStyle, fontWeight: 700, maxWidth: 110 }} />
                    <input placeholder="Data DD/MM/AAAA" value={t.data} onChange={(e) => updateTrecho(active.id, t.id, { data: e.target.value })} style={inputStyle} />
                    <input placeholder="Duração total (ex 7h10)" value={t.duracaoTotal} onChange={(e) => updateTrecho(active.id, t.id, { duracaoTotal: e.target.value })} style={inputStyle} />
                    {active.trechos.length > 1 && (
                      <button onClick={() => removeTrecho(active.id, t.id)} style={{ border: "none", background: "none", color: "#b3441a", cursor: "pointer" }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  {t.segmentos.map((s, sIdx) => (
                    <React.Fragment key={s.id}>
                      <div style={{ display: "grid", gridTemplateColumns: "0.7fr 0.7fr 1fr 1fr 0.6fr 0.6fr", gap: 5, marginBottom: 5 }}>
                        <input placeholder="Cia" value={s.cia} onChange={(e) => updateSegmento(active.id, t.id, s.id, { cia: e.target.value })} style={inputStyle} />
                        <input placeholder="Nº voo" value={s.numeroVoo} onChange={(e) => updateSegmento(active.id, t.id, s.id, { numeroVoo: e.target.value })} style={inputStyle} />
                        <input placeholder="Cidade origem" value={s.origemCidade} onChange={(e) => updateSegmento(active.id, t.id, s.id, { origemCidade: e.target.value })} style={inputStyle} />
                        <input placeholder="Cidade destino" value={s.destino} onChange={(e) => updateSegmento(active.id, t.id, s.id, { destino: e.target.value })} style={inputStyle} />
                        <input placeholder="Saída" value={s.saida} onChange={(e) => updateSegmento(active.id, t.id, s.id, { saida: e.target.value })} style={inputStyle} />
                        <input placeholder="Chegada" value={s.chegada} onChange={(e) => updateSegmento(active.id, t.id, s.id, { chegada: e.target.value })} style={inputStyle} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 5 }}>
                        <input placeholder="Aeroporto origem (ex: JPA · Pres. Castro Pinto)" value={s.origemAeroporto} onChange={(e) => updateSegmento(active.id, t.id, s.id, { origemAeroporto: e.target.value })} style={{ ...inputStyle, fontSize: 11 }} />
                        <input placeholder="Aeroporto destino (ex: GRU · Guarulhos)" value={s.destinoAeroporto} onChange={(e) => updateSegmento(active.id, t.id, s.id, { destinoAeroporto: e.target.value })} style={{ ...inputStyle, fontSize: 11 }} />
                      </div>
                      {sIdx < t.conexoes.length && (
                        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.7fr 1fr", gap: 5, marginBottom: 5, background: "#fdf8ea", padding: 6, borderRadius: 6 }}>
                          <input placeholder="Conexão em (cidade)" value={t.conexoes[sIdx].local} onChange={(e) => updateConexao(active.id, t.id, sIdx, { local: e.target.value })} style={inputStyle} />
                          <input placeholder="IATA (ex: GRU)" value={t.conexoes[sIdx].iata} onChange={(e) => updateConexao(active.id, t.id, sIdx, { iata: e.target.value })} style={inputStyle} />
                          <input placeholder="Tempo de conexão (ex 1h50)" value={t.conexoes[sIdx].duracao} onChange={(e) => updateConexao(active.id, t.id, sIdx, { duracao: e.target.value })} style={inputStyle} />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => addSegmento(active.id, t.id)} style={{ fontSize: 11.5, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      + adicionar conexão/trecho de voo
                    </button>
                    {t.segmentos.length > 1 && (
                      <button onClick={() => removeUltimoSegmento(active.id, t.id)} style={{ fontSize: 11.5, color: "#b3441a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        remover última conexão
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={() => addTrecho(active.id)} style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${NAVY}`, color: NAVY, padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12 }}>
                <Plus size={12} /> Adicionar trecho (ida/volta/multi-destino)
              </button>
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={fieldLabel}>Passageiros</label>
                  <input type="number" min={1} value={active.passageiros} onChange={(e) => updateOpcao(active.id, { passageiros: parseInt(e.target.value) || 1 })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Bebês (colo)</label>
                  <input type="number" min={0} value={active.bebes} onChange={(e) => updateOpcao(active.id, { bebes: parseInt(e.target.value) || 0 })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Bagagem inclusa</label>
                  <select value={active.bagagemPreset} onChange={(e) => updateOpcao(active.id, { bagagemPreset: e.target.value })} style={inputStyle}>
                    {BAGAGEM_PRESETS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {active.bagagemPreset === "custom" && (
                <textarea
                  placeholder={"Uma linha por item, ex:\n1 item pessoal\nMochila\nMala 15kg"}
                  value={active.bagagemCustom}
                  onChange={(e) => updateOpcao(active.id, { bagagemCustom: e.target.value })}
                  style={{ ...inputStyle, width: "100%", minHeight: 60 }}
                />
              )}

              <label style={{ ...fieldLabel, marginTop: 10 }}>Condições da tarifa</label>
              {active.condicoes.map((c, idx) => (
                <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <input value={c} onChange={(e) => updateCondicao(active.id, idx, e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  <button onClick={() => removeCondicao(active.id, idx)} style={{ border: "none", background: "none", color: "#b3441a", cursor: "pointer" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => addCondicao(active.id)} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                + adicionar condição
              </button>
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={fieldLabel}>Preço no Pix (R$)</label>
                  <CurrencyInput value={active.precoPix} onChange={(v) => updateOpcao(active.id, { precoPix: v })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Parcela em destaque na legenda</label>
                  <select value={active.parcelaDestaque} onChange={(e) => updateOpcao(active.id, { parcelaDestaque: parseInt(e.target.value) })} style={inputStyle}>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}x
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Sem juros até (opcional, cia aérea)</label>
                  <select value={active.semJurosAte} onChange={(e) => updateOpcao(active.id, { semJurosAte: e.target.value })} style={inputStyle}>
                    <option value="">Não informar</option>
                    {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button onClick={() => setShowTaxas((s) => !s)} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8 }}>
                {showTaxas ? "Ocultar" : "Configurar"} taxas do cartão (vale pra todas as cotações)
              </button>

              {showTaxas && (
                <div style={{ marginBottom: 10, background: "#faf9f5", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>% de acréscimo total sobre o valor do Pix, por número de parcelas — ajuste conforme a taxa da sua maquininha/operadora.</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {taxas.map((t) => (
                      <div key={t.n} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5 }}>
                        <span style={{ width: 22 }}>{t.n}x</span>
                        <input type="number" step="0.001" value={t.taxaPercent} onChange={(e) => updateTaxa(t.n, parseFloat(e.target.value) || 0)} style={{ ...inputStyle, padding: 4 }} />
                        <span>%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {table.length > 0 && (
                <div style={{ marginTop: 8, borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <div style={fieldLabel}>Tabela de parcelamento (referência interna)</div>
                  <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 4, fontSize: 11, marginBottom: 4, color: "#888", fontWeight: 600 }}>
                    <span>Nº</span>
                    <span>Parcela</span>
                    <span>Total</span>
                  </div>
                  {table.map((r) => (
                    <div key={r.n} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 4, fontSize: 12, padding: "3px 0", background: r.n === Number(active.parcelaDestaque) ? "#faf6ea" : "transparent", borderRadius: 4 }}>
                      <span style={{ fontWeight: 700 }}>{r.n}x</span>
                      <span>R$ {fmtMoney(r.valor)}</span>
                      <span>R$ {fmtMoney(r.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button onClick={downloadCard} disabled={downloading} style={{ display: "flex", alignItems: "center", gap: 6, background: NAVY, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
                {downloading ? <Loader2 className="animate-spin-slow" size={14} /> : <Download size={14} />} Baixar card em alta qualidade
              </button>
            </div>
            <FlightCard opcoes={[active]} />
            <div style={{ marginTop: 16, background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: NAVY }}>Legenda pronta pro WhatsApp</strong>
                <button onClick={handleCopy} style={{ display: "flex", alignItems: "center", gap: 4, background: GOLD, border: "none", color: "#fff", padding: "6px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <pre ref={captionRef} style={{ whiteSpace: "pre-wrap", fontSize: 12.5, color: "#333", fontFamily: "inherit", margin: 0 }}>
                {caption}
              </pre>
              {copyMsg && <div style={{ fontSize: 11.5, color: "#b3441a", marginTop: 8 }}>{copyMsg}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { fontSize: 11, color: "#666", fontWeight: 600, display: "block", marginBottom: 3 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 7, borderRadius: 6, border: "1px solid #ccc", fontSize: 12, boxSizing: "border-box" };
