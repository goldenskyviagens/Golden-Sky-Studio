"use client";

import React, { useEffect, useRef, useState } from "react";
import { Copy, Check, Plus, Trash2, Loader2, Image as ImageIcon, Save, ExternalLink, Smartphone, Monitor, Car, Hotel, Ticket, Plane, ShieldCheck } from "lucide-react";
import { emptyOption, emptyTrecho, ExtractedOpcao, FlightOption, mergeConnectingOpcoes, Segmento, Trecho } from "@/core/data/flights";
import { dateBRtoISO } from "@/core/data/dates";
import { installmentTable } from "@/core/data/installments";
import { CurrencyInput } from "@/components/ui/CurrencyInput";
import { fmtMoney } from "@/core/data/money";
import { GOLD, NAVY } from "@/core/render-engine/theme";
import { deleteProposta, getProposta, listPropostas, saveProposta, uploadFoto } from "./queries";
import { emptyDiaRoteiro, emptyProduto, emptyProposta, Produto, ProdutoTipo, Proposta } from "./types";
import { PropostaView } from "./components/PropostaView";

type ListItemField = "inclusos" | "naoInclusos" | "observacoes";

const ICONE_PRODUTO: Record<ProdutoTipo, typeof Hotel> = { hospedagem: Hotel, transfer: Car, atividade: Ticket, seguro: ShieldCheck };
const LABEL_PRODUTO: Record<ProdutoTipo, string> = { hospedagem: "Hospedagem", transfer: "Transfer", atividade: "Atividade", seguro: "Seguro Viagem" };
const TIPOS_PRODUTO: ProdutoTipo[] = ["hospedagem", "transfer", "atividade", "seguro"];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type TrechoRaw = {
  label?: string;
  data?: string;
  duracaoTotal?: string;
  segmentos?: Array<Partial<Segmento>>;
  conexoes?: Array<{ local?: string; iata?: string; duracao?: string }>;
};

// Converte os trechos crus vindos da extração por IA (mesmo formato de
// /api/extract) pro shape tipado — reaproveitado tanto pelo print avulso de
// voo quanto pela cotação completa (que pode trazer voo junto).
function mapRawTrechos(trechosRaw: TrechoRaw[]): Trecho[] {
  return trechosRaw.map((t, idx) => ({
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
}

// Deduz destino e datas da viagem a partir dos trechos de voo já extraídos —
// evita ter que perguntar pra IA de novo algo que já está nos dados (a
// cidade de chegada da Ida, a data da Ida/Volta).
function inferirDestinoEDatas(trechos: Trecho[]): { destino: string; dataInicioISO: string; dataFimISO: string } {
  const idaTrecho = trechos.find((t) => t.label?.toLowerCase().includes("ida")) || trechos[0];
  const voltaTrecho = trechos.find((t) => t.label?.toLowerCase().includes("volta")) || (trechos.length > 1 ? trechos[trechos.length - 1] : undefined);
  const destino = idaTrecho?.segmentos[idaTrecho.segmentos.length - 1]?.destino || "";
  return {
    destino,
    dataInicioISO: dateBRtoISO(idaTrecho?.data || ""),
    dataFimISO: dateBRtoISO(voltaTrecho?.data || ""),
  };
}

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
      const { id, shortCode } = await saveProposta(proposta);
      update({ id, shortCode });
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
      update({ fotoCapaUrl: await uploadFoto(file) });
    } catch (e) {
      console.error(e);
      setError(`Não consegui enviar a foto. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setUploadingFoto(false);
    }
  }

  // --- Produtos do pacote (hospedagem/transfer/atividade): print+IA ou manual ---
  const [lendoProdutoId, setLendoProdutoId] = useState<string | null>(null);
  const [enviandoFotoProdutoId, setEnviandoFotoProdutoId] = useState<string | null>(null);

  function addProduto(tipo: ProdutoTipo) {
    setProposta((prev) => ({ ...prev, produtos: [...prev.produtos, emptyProduto(tipo)] }));
  }
  function removeProduto(id: string) {
    setProposta((prev) => ({ ...prev, produtos: prev.produtos.filter((p) => p.id !== id) }));
  }
  function updateProduto(id: string, patch: Partial<Produto>) {
    setProposta((prev) => ({ ...prev, produtos: prev.produtos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  }
  function updateProdutoItem(produtoId: string, idx: number, value: string) {
    setProposta((prev) => ({
      ...prev,
      produtos: prev.produtos.map((p) => (p.id === produtoId ? { ...p, itensInclusos: p.itensInclusos.map((v, i) => (i === idx ? value : v)) } : p)),
    }));
  }
  function addProdutoItem(produtoId: string) {
    setProposta((prev) => ({ ...prev, produtos: prev.produtos.map((p) => (p.id === produtoId ? { ...p, itensInclusos: [...p.itensInclusos, ""] } : p)) }));
  }
  function removeProdutoItem(produtoId: string, idx: number) {
    setProposta((prev) => ({ ...prev, produtos: prev.produtos.map((p) => (p.id === produtoId ? { ...p, itensInclusos: p.itensInclusos.filter((_, i) => i !== idx) } : p)) }));
  }

  async function handleProdutoFoto(produtoId: string, files: FileList | File[] | null | undefined) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    setEnviandoFotoProdutoId(produtoId);
    setError("");
    try {
      // Uma de cada vez (não em paralelo) — evita estourar limite de upload
      // simultâneo do Supabase quando o agente seleciona várias fotos juntas.
      for (const file of arr) {
        const url = await uploadFoto(file);
        setProposta((prev) => ({ ...prev, produtos: prev.produtos.map((p) => (p.id === produtoId ? { ...p, fotos: [...p.fotos, url] } : p)) }));
      }
    } catch (e) {
      console.error(e);
      setError(`Não consegui enviar a foto. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setEnviandoFotoProdutoId(null);
    }
  }
  function removeProdutoFoto(produtoId: string, idx: number) {
    setProposta((prev) => ({ ...prev, produtos: prev.produtos.map((p) => (p.id === produtoId ? { ...p, fotos: p.fotos.filter((_, i) => i !== idx) } : p)) }));
  }

  async function handleProdutoPrint(produtoId: string, tipo: ProdutoTipo, file: File | undefined) {
    if (!file) return;
    setLendoProdutoId(produtoId);
    setError("");
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch("/api/extract-produto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: { mediaType: file.type || "image/png", base64 }, tipo }),
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed?.error || "Erro ao processar imagem.");
      updateProduto(produtoId, {
        titulo: parsed.titulo || "",
        subtitulo: parsed.subtitulo || "",
        descricao: parsed.descricao || "",
        itensInclusos: Array.isArray(parsed.itensInclusos) ? parsed.itensInclusos : [],
      });
    } catch (e) {
      console.error(e);
      setError(`Não consegui ler o print. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setLendoProdutoId(null);
    }
  }

  const shareUrl =
    proposta.id && typeof window !== "undefined"
      ? `${window.location.origin}${proposta.shortCode ? `/p/${proposta.shortCode}` : `/proposta/${proposta.id}`}`
      : "";

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

  // Print(s) do voo → IA — mesma extração/rota usada em Passagens
  // (core/data/flights.ts já resolve trechos vindos fora de ordem e opções
  // separadas que na real são a mesma viagem conectada).
  const [pendingVooImages, setPendingVooImages] = useState<{ file: File; url: string }[]>([]);
  const [loadingVoo, setLoadingVoo] = useState(false);
  const vooFileRef = useRef<HTMLInputElement>(null);

  function addVooImages(files: FileList | null | undefined) {
    const arr = Array.from(files || []);
    if (!arr.length) return;
    setPendingVooImages((prev) => [...prev, ...arr.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
  }
  function removeVooPendingImage(i: number) {
    setPendingVooImages((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function processVooImages() {
    if (!pendingVooImages.length) return;
    setLoadingVoo(true);
    setError("");
    try {
      const images = await Promise.all(
        pendingVooImages.map(async ({ file }) => ({ mediaType: file.type || "image/png", base64: await fileToBase64(file) }))
      );
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed?.error || "Erro ao processar imagens.");

      const opcoesExtraidas: ExtractedOpcao[] = (parsed.opcoes || []).map((op: { trechos?: TrechoRaw[] }) => ({
        trechos: mapRawTrechos(op.trechos || []),
        precoPix: "",
      }));

      const trechosFinal = mergeConnectingOpcoes(opcoesExtraidas)[0]?.trechos || [];
      const { destino, dataInicioISO, dataFimISO } = inferirDestinoEDatas(trechosFinal);
      setProposta((prev) => ({
        ...prev,
        voos: trechosFinal.length ? [{ ...emptyOption(), trechos: trechosFinal }] : [],
        destino: prev.destino || destino,
        dataInicio: prev.dataInicio || dataInicioISO,
        dataFim: prev.dataFim || dataFimISO,
      }));
      setPendingVooImages([]);
    } catch (e) {
      console.error(e);
      setError(`Não consegui ler os prints do voo. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setLoadingVoo(false);
    }
  }

  const [mostrarVoo, setMostrarVoo] = useState(false);
  const mostrarVooSecao = mostrarVoo || proposta.voos.length > 0;

  // Cotação completa (1 print com voo + hospedagem + transfer + atividade
  // juntos, ex: tela de fornecedor tipo hoteldo) — a IA separa tudo sozinha
  // numa chamada só, em vez de colar um print por produto.
  const [loadingPacote, setLoadingPacote] = useState(false);
  const pacoteFileRef = useRef<HTMLInputElement>(null);

  async function handlePacoteCompleto(file: File | undefined) {
    if (!file) return;
    setLoadingPacote(true);
    setError("");
    try {
      const base64 = await fileToBase64(file);
      const response = await fetch("/api/extract-pacote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: { mediaType: file.type || "image/png", base64 } }),
      });
      const parsed = await response.json();
      if (!response.ok) throw new Error(parsed?.error || "Erro ao processar imagem.");

      const trechosFinal = mergeConnectingOpcoes([{ trechos: mapRawTrechos(parsed.voos?.trechos || []), precoPix: "" }])[0]?.trechos || [];
      const novosProdutos: Produto[] = (Array.isArray(parsed.produtos) ? parsed.produtos : [])
        .filter((p: { tipo?: string }) => TIPOS_PRODUTO.includes(p?.tipo as ProdutoTipo))
        .map((p: { tipo: ProdutoTipo; titulo?: string; subtitulo?: string; descricao?: string; itensInclusos?: string[] }) => ({
          ...emptyProduto(p.tipo),
          titulo: p.titulo || "",
          subtitulo: p.subtitulo || "",
          descricao: p.descricao || "",
          itensInclusos: Array.isArray(p.itensInclusos) ? p.itensInclusos : [],
        }));

      const inferido = inferirDestinoEDatas(trechosFinal);
      setProposta((prev) => ({
        ...prev,
        voos: trechosFinal.length ? [{ ...emptyOption(), trechos: trechosFinal }] : prev.voos,
        produtos: [...prev.produtos, ...novosProdutos],
        destino: prev.destino || parsed.destino || inferido.destino,
        dataInicio: prev.dataInicio || dateBRtoISO(parsed.dataInicio || "") || inferido.dataInicioISO,
        dataFim: prev.dataFim || dateBRtoISO(parsed.dataFim || "") || inferido.dataFimISO,
      }));
      if (trechosFinal.length) setMostrarVoo(true);
    } catch (e) {
      console.error(e);
      setError(`Não consegui ler a cotação completa. Detalhe: ${formatErrorDetail(e)}`);
    } finally {
      setLoadingPacote(false);
    }
  }

  // Colar (Ctrl+V) só chega numa caixinha específica se ela estiver com foco
  // (clicada antes) — a maioria dos usuários só cola direto na página, sem
  // clicar em nada primeiro. Esse listener global pega esse caso: se nada
  // mais específico estiver focado, a imagem colada vai pro "cole tudo de
  // uma vez" (o mais útil como destino padrão).
  useEffect(() => {
    function handleGlobalPaste(e: ClipboardEvent) {
      const active = document.activeElement;
      const foiEmCampoEspecifico = active instanceof HTMLElement && active.tagName !== "BODY" && active.tagName !== "HTML";
      if (foiEmCampoEspecifico) return;
      const file = e.clipboardData?.files?.[0];
      if (file) handlePacoteCompleto(file);
    }
    document.addEventListener("paste", handleGlobalPaste);
    return () => document.removeEventListener("paste", handleGlobalPaste);
  }, []);

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
                  <input type="date" value={proposta.dataInicio} onChange={(e) => update({ dataInicio: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={fieldLabel}>Data fim</label>
                  <input type="date" value={proposta.dataFim} onChange={(e) => update({ dataFim: e.target.value })} style={inputStyle} />
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
                onPaste={(e) => handleFotoChange(e.clipboardData?.files?.[0])}
                tabIndex={0}
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
                <span style={{ color: "#555", fontSize: 12.5 }}>{uploadingFoto ? "Enviando foto…" : proposta.fotoCapaUrl ? "Clique pra trocar a foto (ou cole com Ctrl+V)" : "Clique, arraste ou cole (Ctrl+V) a foto de capa"}</span>
              </div>
            </div>

            <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12 }}>
              <label style={fieldLabel}>Produtos do pacote</label>
              <p style={{ fontSize: 11.5, color: "#888", marginTop: -4, marginBottom: 10 }}>Cole o print da cotação de cada produto e deixe a IA preencher — ou digite à mão.</p>

              <div
                onClick={() => pacoteFileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handlePacoteCompleto(e.dataTransfer.files?.[0]);
                }}
                onPaste={(e) => handlePacoteCompleto(e.clipboardData?.files?.[0])}
                tabIndex={0}
                style={{ border: `1.5px dashed ${NAVY}`, borderRadius: 8, padding: 10, textAlign: "center", cursor: "pointer", background: "#f4f6fb", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}
              >
                <input ref={pacoteFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handlePacoteCompleto(e.target.files?.[0])} />
                {loadingPacote ? <Loader2 className="animate-spin-slow" size={14} color={NAVY} /> : <ImageIcon size={14} color={NAVY} />}
                <span style={{ color: NAVY, fontSize: 11.5, fontWeight: 600 }}>
                  {loadingPacote ? "Separando os produtos…" : "Ou cole aqui a cotação completa (com tudo junto) e a IA separa sozinha"}
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                {TIPOS_PRODUTO.map((tipo) => {
                  const Icone = ICONE_PRODUTO[tipo];
                  return (
                    <button key={tipo} onClick={() => addProduto(tipo)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: NAVY, background: "#fff", border: `1px solid ${NAVY}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                      <Plus size={12} /> <Icone size={13} /> {LABEL_PRODUTO[tipo]}
                    </button>
                  );
                })}
                <button onClick={() => setMostrarVoo(true)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: NAVY, background: "#fff", border: `1px solid ${NAVY}`, borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}>
                  <Plus size={12} /> <Plane size={13} /> Voo
                </button>
              </div>

              {proposta.produtos.map((produto) => (
                <ProdutoEditor
                  key={produto.id}
                  produto={produto}
                  lendo={lendoProdutoId === produto.id}
                  enviandoFoto={enviandoFotoProdutoId === produto.id}
                  onUpdate={(patch) => updateProduto(produto.id, patch)}
                  onRemove={() => removeProduto(produto.id)}
                  onPrint={(file) => handleProdutoPrint(produto.id, produto.tipo, file)}
                  onFoto={(files) => handleProdutoFoto(produto.id, files)}
                  onRemoveFoto={(idx) => removeProdutoFoto(produto.id, idx)}
                  onUpdateItem={(idx, val) => updateProdutoItem(produto.id, idx, val)}
                  onAddItem={() => addProdutoItem(produto.id)}
                  onRemoveItem={(idx) => removeProdutoItem(produto.id, idx)}
                />
              ))}

              {mostrarVooSecao && (
                <div style={{ background: "#faf9f5", border: "1px solid #e5e0d0", borderRadius: 8, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Plane size={13} color={NAVY} />
                    <strong style={{ fontSize: 12, color: NAVY }}>Voo</strong>
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => {
                        update({ voos: [] });
                        setMostrarVoo(false);
                      }}
                      style={{ border: "none", background: "none", color: "#b3441a", cursor: "pointer" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div
                    onClick={() => vooFileRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      addVooImages(e.dataTransfer.files);
                    }}
                    onPaste={(e) => addVooImages(e.clipboardData?.files)}
                    tabIndex={0}
                    style={{ border: `1.5px dashed ${GOLD}`, borderRadius: 8, padding: 8, textAlign: "center", cursor: "pointer", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}
                  >
                    <input ref={vooFileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => addVooImages(e.target.files)} />
                    <ImageIcon size={14} color={GOLD} />
                    <span style={{ color: "#555", fontSize: 11.5 }}>Clique, arraste ou cole (Ctrl+V) — pode anexar ida e volta juntas</span>
                  </div>

                  {pendingVooImages.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
                      {pendingVooImages.map((p, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.url} alt="print" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }} />
                          <button onClick={() => removeVooPendingImage(i)} style={{ position: "absolute", top: -6, right: -6, background: "#b3441a", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer" }}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}
                      <button onClick={processVooImages} disabled={loadingVoo} style={{ background: NAVY, color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", height: 36, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        {loadingVoo ? <Loader2 className="animate-spin-slow" size={14} /> : `Ler ${pendingVooImages.length} print(s)`}
                      </button>
                    </div>
                  )}

                  {opcaoVoo && opcaoVoo.trechos.length > 0 && (
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
                      <button onClick={addVooTrecho} style={{ fontSize: 11.5, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                        + adicionar trecho (ida/volta)
                      </button>
                    </>
                  )}
                </div>
              )}
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
                  <input type="date" value={proposta.validadeProposta} onChange={(e) => update({ validadeProposta: e.target.value })} style={inputStyle} />
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

// Um bloco por produto do pacote (hospedagem/transfer/atividade): print+IA
// pra preencher rápido, campos manuais por baixo pra ajustar, e galeria de
// fotos — tudo isolado num componente próprio porque cada produto tem seu
// próprio input de arquivo e estado de carregamento.
function ProdutoEditor({
  produto,
  lendo,
  enviandoFoto,
  onUpdate,
  onRemove,
  onPrint,
  onFoto,
  onRemoveFoto,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: {
  produto: Produto;
  lendo: boolean;
  enviandoFoto: boolean;
  onUpdate: (patch: Partial<Produto>) => void;
  onRemove: () => void;
  onPrint: (file: File | undefined) => void;
  onFoto: (files: FileList | null | undefined) => void;
  onRemoveFoto: (idx: number) => void;
  onUpdateItem: (idx: number, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
}) {
  const printRef = useRef<HTMLInputElement>(null);
  const fotoRef = useRef<HTMLInputElement>(null);
  const Icone = ICONE_PRODUTO[produto.tipo];

  return (
    <div style={{ background: "#faf9f5", border: "1px solid #e5e0d0", borderRadius: 8, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icone size={13} color={NAVY} />
        <strong style={{ fontSize: 12, color: NAVY }}>{LABEL_PRODUTO[produto.tipo]}</strong>
        <div style={{ flex: 1 }} />
        <button onClick={onRemove} style={{ border: "none", background: "none", color: "#b3441a", cursor: "pointer" }}>
          <Trash2 size={13} />
        </button>
      </div>

      <div
        onClick={() => printRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onPrint(e.dataTransfer.files?.[0]);
        }}
        onPaste={(e) => onPrint(e.clipboardData?.files?.[0])}
        tabIndex={0}
        style={{ border: `1.5px dashed ${GOLD}`, borderRadius: 8, padding: 8, textAlign: "center", cursor: "pointer", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}
      >
        <input ref={printRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onPrint(e.target.files?.[0])} />
        {lendo ? <Loader2 className="animate-spin-slow" size={14} color={NAVY} /> : <ImageIcon size={14} color={GOLD} />}
        <span style={{ color: "#555", fontSize: 11.5 }}>{lendo ? "Lendo print…" : "Clique, arraste ou cole (Ctrl+V) o print da cotação"}</span>
      </div>

      <input value={produto.titulo} onChange={(e) => onUpdate({ titulo: e.target.value })} placeholder="Título (ex: Hotel Porto Salvador)" style={{ ...inputStyle, marginBottom: 5 }} />
      <input value={produto.subtitulo} onChange={(e) => onUpdate({ subtitulo: e.target.value })} placeholder="Subtítulo (endereço, veículo, data/horário...)" style={{ ...inputStyle, marginBottom: 5 }} />
      <textarea value={produto.descricao} onChange={(e) => onUpdate({ descricao: e.target.value })} placeholder="Descrição (mostrada em 'Ver detalhes')" style={{ ...inputStyle, minHeight: 44, marginBottom: 5 }} />

      <label style={{ ...fieldLabel, marginTop: 6 }}>Itens inclusos</label>
      {produto.itensInclusos.map((v, i) => (
        <ListRow key={i} value={v} onChange={(val) => onUpdateItem(i, val)} onRemove={() => onRemoveItem(i)} />
      ))}
      <button onClick={onAddItem} style={{ fontSize: 11.5, color: NAVY, background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 8 }}>
        + adicionar item
      </button>

      <label style={fieldLabel}>Fotos (pode selecionar várias de uma vez)</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {produto.fotos.map((url, i) => (
          <div key={i} style={{ position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Foto ${i + 1}`} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid #ddd" }} />
            <button onClick={() => onRemoveFoto(i)} style={{ position: "absolute", top: -6, right: -6, background: "#b3441a", color: "#fff", border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 10 }}>
              <Trash2 size={10} />
            </button>
          </div>
        ))}
        <div
          onClick={() => fotoRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFoto(e.dataTransfer.files);
          }}
          onPaste={(e) => onFoto(e.clipboardData?.files)}
          tabIndex={0}
          title="Clique, arraste ou cole (Ctrl+V) — pode selecionar várias fotos de uma vez"
          style={{ width: 56, height: 56, borderRadius: 6, border: `1.5px dashed ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "#fff" }}
        >
          <input ref={fotoRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => onFoto(e.target.files)} />
          {enviandoFoto ? <Loader2 className="animate-spin-slow" size={14} color={NAVY} /> : <Plus size={16} color={GOLD} />}
        </div>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { fontSize: 11, color: "#666", fontWeight: 600, display: "block", marginBottom: 3 };
const inputStyle: React.CSSProperties = { width: "100%", padding: 7, borderRadius: 6, border: "1px solid #ccc", fontSize: 12, boxSizing: "border-box" };
