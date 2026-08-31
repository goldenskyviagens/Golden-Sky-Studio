"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, Check, Plus, Trash2, Loader2, Image as ImageIcon, Save, ExternalLink, Smartphone, Monitor } from "lucide-react";
import { emptyOption, emptyTrecho, FlightOption, Segmento, Trecho } from "@/core/data/flights";
import { installmentTable } from "@/core/data/installments";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { fmtMoney } from "@/core/data/money";
import { GOLD, NAVY } from "@/core/render-engine/theme";
import { deleteProposta, getProposta, listPropostas, saveProposta, uploadFotoCapa } from "./queries";
import { emptyDiaRoteiro, emptyProposta, Proposta } from "./types";
import { PropostaView } from "./components/PropostaView";

type ListItemField = "inclusos" | "naoInclusos" | "observacoes";

// Extrai uma mensagem legível de um erro do Supabase (PostgrestError tem
// message/details/hint/code) ou de um Error genérico — sem isso, todo erro
// virava um aviso genérico que não dizia a causa real.
function formatErrorDetail(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [err.message, err.details, err.hint].filter(Boolean);
    if (parts.length) return `${parts.join(" — ")}${err.code ? ` (código ${err.code})` : ""}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

export default function PacotesApp() {
  const [proposta, setProposta] = useState<Proposta>(emptyProposta());
  const [lista, setLista] = useState<{ id: string; titulo: string; destino: string; updatedAt: string }[]>([]);
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingProposta, setLoadingProposta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(375);
  const [showTaxas, setShowTaxas] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshLista();
  }, []);

  async function refreshLista() {
    setLoadingLista(true);
    try {
      setLista(await listPropostas());
    } catch (e) {
      console.error(e);
      setError(`Não consegui carregar suas propostas salvas. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setLoadingLista(false);
    }
  }

  function update(patch: Partial<Proposta>) {
    setProposta((prev) => ({ ...prev, ...patch }));
  }

  async function abrirProposta(id: string) {
    setLoadingProposta(true);
    setError("");
    try {
      setProposta(await getProposta(id));
    } catch (e) {
      console.error(e);
      setError(`Não consegui abrir essa proposta. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setLoadingProposta(false);
    }
  }

  async function excluirProposta(id: string) {
    if (!confirm("Apagar esta proposta? Essa ação não pode ser desfeita e o link deixa de funcionar.")) return;
    try {
      await deleteProposta(id);
      if (proposta.id === id) setProposta(emptyProposta());
      setLista((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      setError(`Não consegui apagar essa proposta. Detalhe: ${formatErrorDetail(e)}`);
    }
  }

  async function handleSalvar() {
    setSaving(true);
    setError("");
    try {
      const id = await saveProposta(proposta);
      update({ id });
      await refreshLista();
    } catch (e) {
      console.error(e);
      setError(`Não consegui salvar a proposta. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleFotoChange(file: File | undefined) {
    if (!file) return;
    setUploadingFoto(true);
    setError("");
    try {
      update({ fotoCapaUrl: await uploadFotoCapa(file) });
    } catch (e) {
      console.error(e);
      setError(`Não consegui enviar a foto. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setUploadingFoto(false);
    }
  }

  const shareUrl = proposta.id && typeof window !== "undefined" ? `${window.location.origin}/proposta/${proposta.id}` : "";

  async function handleCopyLink() {
    if (!shareUrl) return;
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok && linkRef.current) {
      linkRef.current.select();
      ok = document.execCommand("copy");
    }
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  // --- Roteiro dia a dia ---
  function updateDia(id: string, patch: Partial<Proposta["roteiro"][number]>) {
    setProposta((prev) => ({ ...prev, roteiro: prev.roteiro.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  }
  function addDia() {
    setProposta((prev) => ({ ...prev, roteiro: [...prev.roteiro, emptyDiaRoteiro()] }));
  }
  function removeDia(id: string) {
    setProposta((prev) => ({ ...prev, roteiro: prev.roteiro.length > 1 ? prev.roteiro.filter((d) => d.id !== id) : prev.roteiro }));
  }

  // --- Listas simples (inclusos / não inclusos / observações) ---
  function updateListItem(field: ListItemField, idx: number, value: string) {
    setProposta((prev) => ({ ...prev, [field]: prev[field].map((v, i) => (i === idx ? value : v)) }));
  }
  function addListItem(field: ListItemField) {
    setProposta((prev) => ({ ...prev, [field]: [...prev[field], ""] }));
  }
  function removeListItem(field: ListItemField, idx: number) {
    setProposta((prev) => ({ ...prev, [field]: prev[field].filter((_, i) => i !== idx) }));
  }

  // --- Voos (reaproveita FlightOption/Trecho/Segmento — 1 segmento por trecho, sem conexão) ---
  const opcaoVoo: FlightOption | undefined = proposta.voos[0];
  function addVooTrecho() {
    setProposta((prev) => {
      const base = prev.voos[0] || { ...emptyOption(), trechos: [] };
      const label = base.trechos.length === 0 ? "Ida" : base.trechos.length === 1 ? "Volta" : `Trecho ${base.trechos.length + 1}`;
      return { ...prev, voos: [{ ...base, trechos: [...base.trechos, emptyTrecho(label)] }] };
    });
  }
  function removeVooTrecho(trechoId: string) {
    setProposta((prev) => {
      if (!prev.voos[0]) return prev;
      const trechos = prev.voos[0].trechos.filter((t) => t.id !== trechoId);
      return { ...prev, voos: trechos.length ? [{ ...prev.voos[0], trechos }] : [] };
    });
  }
  function updateVooTrecho(trechoId: string, patch: Partial<Trecho>) {
    setProposta((prev) => {
      if (!prev.voos[0]) return prev;
      return { ...prev, voos: [{ ...prev.voos[0], trechos: prev.voos[0].trechos.map((t) => (t.id === trechoId ? { ...t, ...patch } : t)) }] };
    });
  }
  function updateVooSegmento(trechoId: string, patch: Partial<Segmento>) {
    setProposta((prev) => {
      if (!prev.voos[0]) return prev;
      return {
        ...prev,
        voos: [{ ...prev.voos[0], trechos: prev.voos[0].trechos.map((t) => (t.id === trechoId ? { ...t, segmentos: [{ ...t.segmentos[0], ...patch }] } : t)) }],
      };
    });
  }

  // --- Taxas de parcelamento (congeladas na proposta salva) ---
  function updateTaxa(n: number, percent: number) {
    setProposta((prev) => ({ ...prev, taxas: prev.taxas.map((t) => (t.n === n ? { ...t, taxaPercent: percent } : t)) }));
  }

  const table = installmentTable(proposta.precoPix, proposta.taxas);

  return (
    <div style={{ minHeight: "100vh", background: "#f4f4f6", fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Proposta Premium · Golden Sky Viagens</h1>
        <p style={{ color: "#555", fontSize: 13, marginBottom: 20 }}>Monte a página web da viagem e compartilhe o link com o cliente.</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          {loadingLista ? (
            <Loader2 className="animate-spin-slow" size={16} color={NAVY} />
          ) : (
            lista.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 999, border: `1px solid ${proposta.id === p.id ? NAVY : "#ccc"}`, background: proposta.id === p.id ? NAVY : "#fff", padding: "2px 4px 2px 14px" }}>
                <button onClick={() => abrirProposta(p.id)} style={{ background: "none", border: "none", color: proposta.id === p.id ? "#fff" : "#333", fontSize: 12, cursor: "pointer", padding: "4px 0" }}>
                  {p.titulo}
                  {p.destino && p.titulo !== p.destino ? ` · ${p.destino}` : ""}
                </button>
                <button onClick={() => excluirProposta(p.id)} style={{ background: "none", border: "none", color: proposta.id === p.id ? "rgba(255,255,255,0.7)" : "#b3441a", cursor: "pointer", padding: 6 }}>
                  <Trash2 size={11} />
                </button>
              </div>
            ))
          )}
          <button onClick={() => setProposta(emptyProposta())} style={{ padding: "6px 14px", borderRadius: 999, border: `1px dashed ${NAVY}`, background: "#fff", color: NAVY, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
            <Plus size={12} /> Nova proposta
          </button>
        </div>

        {error && <div style={{ background: "#fff3f0", color: "#b3441a", padding: 10, borderRadius: 8, fontSize: 13, marginBottom: 16 }}>{error}</div>}
        {loadingProposta && <div style={{ marginBottom: 16, fontSize: 13, color: "#555", display: "flex", alignItems: "center", gap: 6 }}><Loader2 className="animate-spin-slow" size={14} /> Carregando proposta…</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 20, alignItems: "start" }}>
          <div>
            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={fieldLabel}>Título interno (só pra você identificar)</label>
                  <input value={proposta.titulo} onChange={(e) => update({ titulo: e.target.value })} placeholder="Ex: Família Silva - Cancún" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Destino (aparece grande na página)</label>
                  <input value={proposta.destino} onChange={(e) => update({ destino: e.target.value })} placeholder="Ex: Cancún, México" style={inputStyle} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.6fr", gap: 10 }}>
                <div>
                  <label style={fieldLabel}>Data início</label>
                  <input value={proposta.dataInicio} onChange={(e) => update({ dataInicio: e.target.value })} placeholder="DD/MM/AAAA" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Data fim</label>
                  <input value={proposta.dataFim} onChange={(e) => update({ dataFim: e.target.value })} placeholder="DD/MM/AAAA" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Pessoas</label>
                  <input type="number" min={1} value={proposta.pessoas} onChange={(e) => update({ pessoas: parseInt(e.target.value) || 1 })} style={inputStyle} />
                </div>
              </div>

              <label style={{ ...fieldLabel, marginTop: 10 }}>Foto de capa</label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFotoChange(e.dataTransfer.files?.[0]);
                }}
                style={{ border: `2px dashed ${GOLD}`, borderRadius: 10, padding: 14, textAlign: "center", cursor: "pointer", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}
              >
                <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFotoChange(e.target.files?.[0])} />
                {uploadingFoto ? (
                  <Loader2 className="animate-spin-slow" size={16} color={NAVY} />
                ) : proposta.fotoCapaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={proposta.fotoCapaUrl} alt="Capa" style={{ height: 60, borderRadius: 6, objectFit: "cover" }} />
                ) : (
                  <ImageIcon size={18} color={GOLD} />
                )}
                <span style={{ color: "#555", fontSize: 12.5 }}>{uploadingFoto ? "Enviando foto…" : proposta.fotoCapaUrl ? "Clique pra trocar a foto" : "Clique ou arraste a foto de capa"}</span>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <label style={fieldLabel}>Hospedagem</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input value={proposta.hotel} onChange={(e) => update({ hotel: e.target.value })} placeholder="Nome do hotel" style={inputStyle} />
                <input value={proposta.categoriaHotel} onChange={(e) => update({ categoriaHotel: e.target.value })} placeholder="Categoria (ex: 4 estrelas)" style={inputStyle} />
                <input value={proposta.regime} onChange={(e) => update({ regime: e.target.value })} placeholder="Regime (ex: Café da manhã incluso)" style={inputStyle} />
                <input value={proposta.tipoQuarto} onChange={(e) => update({ tipoQuarto: e.target.value })} placeholder="Tipo de quarto/acomodação" style={inputStyle} />
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <label style={fieldLabel}>Roteiro dia a dia</label>
              {proposta.roteiro.map((dia, idx) => (
                <div key={dia.id} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 11, color: "#888", fontWeight: 700, width: 20, paddingTop: 8 }}>{idx + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <input value={dia.titulo} onChange={(e) => updateDia(dia.id, { titulo: e.target.value })} placeholder="Título do dia (ex: Chegada e city tour)" style={{ ...inputStyle, marginBottom: 4 }} />
                    <textarea value={dia.descricao} onChange={(e) => updateDia(dia.id, { descricao: e.target.value })} placeholder="Descrição do dia" style={{ ...inputStyle, minHeight: 44 }} />
                  </div>
                  {proposta.roteiro.length > 1 && (
                    <button onClick={() => removeDia(dia.id)} style={{ border: "none", background: "none", color: "#b3441a", cursor: "pointer", marginTop: 8 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={addDia} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                + adicionar dia
              </button>
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <label style={fieldLabel}>Detalhes de voo (opcional)</label>
              {!opcaoVoo || opcaoVoo.trechos.length === 0 ? (
                <button onClick={addVooTrecho} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  + adicionar detalhes de voo
                </button>
              ) : (
                <>
                  {opcaoVoo.trechos.map((t) => {
                    const s = t.segmentos[0];
                    return (
                      <div key={t.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid #eee" }}>
                        <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                          <input value={t.label} onChange={(e) => updateVooTrecho(t.id, { label: e.target.value })} style={{ ...inputStyle, fontWeight: 700, maxWidth: 100 }} />
                          <input placeholder="Data DD/MM/AAAA" value={t.data} onChange={(e) => updateVooTrecho(t.id, { data: e.target.value })} style={inputStyle} />
                          <button onClick={() => removeVooTrecho(t.id)} style={{ border: "none", background: "none", color: "#b3441a", cursor: "pointer" }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "0.7fr 0.7fr 1fr 1fr 0.6fr 0.6fr", gap: 5 }}>
                          <input placeholder="Cia" value={s.cia} onChange={(e) => updateVooSegmento(t.id, { cia: e.target.value })} style={inputStyle} />
                          <input placeholder="Nº voo" value={s.numeroVoo} onChange={(e) => updateVooSegmento(t.id, { numeroVoo: e.target.value })} style={inputStyle} />
                          <input placeholder="Cidade origem" value={s.origemCidade} onChange={(e) => updateVooSegmento(t.id, { origemCidade: e.target.value })} style={inputStyle} />
                          <input placeholder="Cidade destino" value={s.destino} onChange={(e) => updateVooSegmento(t.id, { destino: e.target.value })} style={inputStyle} />
                          <input placeholder="Saída" value={s.saida} onChange={(e) => updateVooSegmento(t.id, { saida: e.target.value })} style={inputStyle} />
                          <input placeholder="Chegada" value={s.chegada} onChange={(e) => updateVooSegmento(t.id, { chegada: e.target.value })} style={inputStyle} />
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={addVooTrecho} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    + adicionar trecho (ida/volta)
                  </button>
                </>
              )}
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={fieldLabel}>Incluso</label>
                  {proposta.inclusos.map((v, i) => (
                    <ListRow key={i} value={v} onChange={(val) => updateListItem("inclusos", i, val)} onRemove={() => removeListItem("inclusos", i)} />
                  ))}
                  <button onClick={() => addListItem("inclusos")} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    + adicionar
                  </button>
                </div>
                <div>
                  <label style={fieldLabel}>Não incluso</label>
                  {proposta.naoInclusos.map((v, i) => (
                    <ListRow key={i} value={v} onChange={(val) => updateListItem("naoInclusos", i, val)} onRemove={() => removeListItem("naoInclusos", i)} />
                  ))}
                  <button onClick={() => addListItem("naoInclusos")} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                    + adicionar
                  </button>
                </div>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={fieldLabel}>Preço no Pix (R$)</label>
                  <CurrencyInput value={proposta.precoPix} onChange={(v) => update({ precoPix: v })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Parcela em destaque</label>
                  <select value={proposta.parcelaDestaque} onChange={(e) => update({ parcelaDestaque: parseInt(e.target.value) })} style={inputStyle}>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}x
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={fieldLabel}>Sem juros até</label>
                  <select value={proposta.semJurosAte} onChange={(e) => update({ semJurosAte: e.target.value })} style={inputStyle}>
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
                {showTaxas ? "Ocultar" : "Configurar"} taxas do cartão desta proposta
              </button>

              {showTaxas && (
                <div style={{ marginBottom: 10, background: "#faf9f5", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#777", marginBottom: 6 }}>
                    % de acréscimo sobre o Pix por número de parcelas. Fica congelado nesta proposta a partir do próximo salvamento.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                    {proposta.taxas.map((t) => (
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
                <div style={{ borderTop: "1px solid #eee", paddingTop: 10 }}>
                  <div style={fieldLabel}>Tabela de parcelamento (referência interna)</div>
                  {table.slice(0, 4).map((r) => (
                    <div key={r.n} style={{ display: "grid", gridTemplateColumns: "40px 1fr 1fr", gap: 4, fontSize: 12, padding: "3px 0" }}>
                      <span style={{ fontWeight: 700 }}>{r.n}x</span>
                      <span>R$ {fmtMoney(r.valor)}</span>
                      <span>R$ {fmtMoney(r.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div>
                  <label style={fieldLabel}>Proposta válida até</label>
                  <input value={proposta.validadeProposta} onChange={(e) => update({ validadeProposta: e.target.value })} placeholder="DD/MM/AAAA" style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>WhatsApp de contato (opcional)</label>
                  <input value={proposta.whatsapp} onChange={(e) => update({ whatsapp: e.target.value })} placeholder="Ex: 5583999999999" style={inputStyle} />
                </div>
              </div>
              <label style={fieldLabel}>Observações finais</label>
              {proposta.observacoes.map((v, i) => (
                <ListRow key={i} value={v} onChange={(val) => updateListItem("observacoes", i, val)} onRemove={() => removeListItem("observacoes", i)} />
              ))}
              <button onClick={() => addListItem("observacoes")} style={{ fontSize: 12, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                + adicionar
              </button>
            </div>
          </div>

          <div style={{ position: "sticky", top: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPreviewWidth(375)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${previewWidth === 375 ? NAVY : "#ccc"}`, background: previewWidth === 375 ? NAVY : "#fff", color: previewWidth === 375 ? "#fff" : "#666", cursor: "pointer" }}>
                  <Smartphone size={14} />
                </button>
                <button onClick={() => setPreviewWidth(760)} style={{ padding: 6, borderRadius: 6, border: `1px solid ${previewWidth === 760 ? NAVY : "#ccc"}`, background: previewWidth === 760 ? NAVY : "#fff", color: previewWidth === 760 ? "#fff" : "#666", cursor: "pointer" }}>
                  <Monitor size={14} />
                </button>
              </div>
              <button onClick={handleSalvar} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, background: NAVY, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
                {saving ? <Loader2 className="animate-spin-slow" size={14} /> : <Save size={14} />} Salvar proposta
              </button>
            </div>

            {proposta.id && (
              <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <input ref={linkRef} readOnly value={shareUrl} style={{ ...inputStyle, flex: 1, fontSize: 11.5, color: "#555" }} onFocus={(e) => e.target.select()} />
                <button onClick={handleCopyLink} style={{ display: "flex", alignItems: "center", gap: 4, background: GOLD, border: "none", color: "#fff", padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar link"}
                </button>
                <a href={shareUrl} target="_blank" rel="noreferrer" style={{ color: NAVY, display: "flex", alignItems: "center" }}>
                  <ExternalLink size={16} />
                </a>
              </div>
            )}

            <div style={{ border: "1px solid #ddd", borderRadius: 10, overflow: "hidden", maxHeight: "80vh", overflowY: "auto", background: "#fff" }}>
              <div style={{ width: previewWidth, maxWidth: "100%", margin: "0 auto", transition: "width 0.2s" }}>
                <PropostaView proposta={proposta} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListRow({ value, onChange, onRemove }: { value: string; onChange: (v: string) => void; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
      <button onClick={onRemove} style={{ border: "none", background: "none", color: "#b3441a", cursor: "pointer" }}>
        <Trash2 size={13} />
      </button>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { fontSize: 11, color: "#666", fontWeight: 600, display: "block", marginBottom: 3 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 7, borderRadius: 6, border: "1px solid #ccc", fontSize: 12, boxSizing: "border-box" };
