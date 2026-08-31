import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emptyProposta, Proposta } from "./types";

interface PropostaRow {
  id: string;
  titulo: string;
  dados: Record<string, unknown>;
  updated_at: string;
  short_code?: string | null;
}

// Converte a Proposta em uso no formulário pro JSON persistido — id e
// shortCode não entram porque já são colunas próprias da linha, não precisa duplicar.
function propostaToDados(proposta: Proposta) {
  const dados: Partial<Proposta> = { ...proposta };
  delete dados.id;
  delete dados.shortCode;
  return dados;
}

// Reconstrói a Proposta a partir de uma linha do banco — funde com os
// defaults atuais, então um campo novo adicionado depois não quebra propostas antigas.
export function mapRowToProposta(row: PropostaRow): Proposta {
  return { ...emptyProposta(), ...(row.dados as Partial<Proposta>), id: row.id, shortCode: row.short_code || "" };
}

// Alfabeto sem caracteres ambíguos (0/O, 1/I/l) — o código vai pra dentro de
// um link, precisa ser fácil de ler/digitar se alguém copiar errado.
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function generateShortCode(length = 7): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

export async function listPropostas(): Promise<{ id: string; titulo: string; destino: string; updatedAt: string }[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("propostas").select("id, titulo, dados, updated_at").order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    titulo: row.titulo || "Proposta sem título",
    destino: (row.dados as Partial<Proposta>)?.destino || "",
    updatedAt: row.updated_at,
  }));
}

export async function getProposta(id: string): Promise<Proposta> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.from("propostas").select("id, titulo, dados, updated_at").eq("id", id).single();
  if (error) throw error;
  return mapRowToProposta(data);
}

// Usada pela página pública (Server Component) — recebe o client de fora
// porque lá precisa ser o client de servidor (cookies), não o de navegador.
export async function getPropostaPublica(supabase: SupabaseClient, id: string): Promise<Proposta | null> {
  const { data, error } = await supabase.rpc("get_proposta_publica", { proposta_id: id });
  if (error || !data || !data.length) return null;
  return mapRowToProposta(data[0]);
}

// Mesma coisa, mas pelo link curto (/p/<code>) em vez do uuid inteiro.
export async function getPropostaPublicaPorCodigo(supabase: SupabaseClient, codigo: string): Promise<Proposta | null> {
  const { data, error } = await supabase.rpc("get_proposta_publica_por_codigo", { codigo });
  if (error || !data || !data.length) return null;
  return mapRowToProposta(data[0]);
}

// Insere se a proposta ainda não tem id (nova), atualiza se já tem — devolve
// o id final (novo ou existente) pra o builder montar/atualizar o link.
// Toda proposta ganha um código curto (pro link /p/<code>) — se ela ainda
// não tem um (nova, ou antiga de antes desse campo existir), gera aqui; com
// retry porque, embora raríssimo, o código pode colidir com outro já existente.
export async function saveProposta(proposta: Proposta): Promise<{ id: string; shortCode: string }> {
  const supabase = createSupabaseBrowserClient();
  const dados = propostaToDados(proposta);
  const titulo = proposta.titulo || proposta.destino || "Proposta sem título";

  if (!proposta.id) {
    let lastError: { code?: string; message: string } | null = null;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const shortCode = generateShortCode();
      const { data, error } = await supabase.from("propostas").insert({ titulo, dados, short_code: shortCode }).select("id").single();
      if (!error) return { id: data.id, shortCode };
      if (error.code !== "23505") throw error; // só tenta de novo se foi colisão de short_code único
      lastError = error;
    }
    throw lastError;
  }

  const shortCode = proposta.shortCode || generateShortCode();
  const { error } = await supabase
    .from("propostas")
    .update({ titulo, dados, short_code: shortCode, updated_at: new Date().toISOString() })
    .eq("id", proposta.id);
  if (error) throw error;
  return { id: proposta.id, shortCode };
}

export async function deleteProposta(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("propostas").delete().eq("id", id);
  if (error) throw error;
}

// Envia uma foto (capa ou de um produto) pro bucket público e devolve a URL
// definitiva — diferente de Promoções (blob: local, só pra export em
// Canvas), aqui a foto precisa estar hospedada porque a página é servida
// pra qualquer visitante.
export async function uploadFoto(file: File): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("proposta-fotos").upload(path, file, { cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("proposta-fotos").getPublicUrl(path);
  return data.publicUrl;
}
