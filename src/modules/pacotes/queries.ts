import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emptyProposta, Proposta } from "./types";

interface PropostaRow {
  id: string;
  titulo: string;
  dados: Record<string, unknown>;
  updated_at: string;
}

// Converte a Proposta em uso no formulário pro JSON persistido — o id não
// entra porque já é a chave da linha, não precisa duplicar.
function propostaToDados(proposta: Proposta) {
  const dados: Partial<Proposta> = { ...proposta };
  delete dados.id;
  return dados;
}

// Reconstrói a Proposta a partir de uma linha do banco — funde com os
// defaults atuais, então um campo novo adicionado depois não quebra propostas antigas.
export function mapRowToProposta(row: PropostaRow): Proposta {
  return { ...emptyProposta(), ...(row.dados as Partial<Proposta>), id: row.id };
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

// Insere se a proposta ainda não tem id (nova), atualiza se já tem — devolve
// o id final (novo ou existente) pra o builder montar/atualizar o link.
export async function saveProposta(proposta: Proposta): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const dados = propostaToDados(proposta);
  const titulo = proposta.titulo || proposta.destino || "Proposta sem título";

  if (!proposta.id) {
    const { data, error } = await supabase.from("propostas").insert({ titulo, dados }).select("id").single();
    if (error) throw error;
    return data.id;
  }

  const { error } = await supabase
    .from("propostas")
    .update({ titulo, dados, updated_at: new Date().toISOString() })
    .eq("id", proposta.id);
  if (error) throw error;
  return proposta.id;
}

export async function deleteProposta(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.from("propostas").delete().eq("id", id);
  if (error) throw error;
}

// Envia a foto de capa pro bucket público e devolve a URL definitiva —
// diferente de Promoções (blob: local, só pra export em Canvas), aqui a foto
// precisa estar hospedada porque a página é servida pra qualquer visitante.
export async function uploadFotoCapa(file: File): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("proposta-fotos").upload(path, file, { cacheControl: "3600" });
  if (error) throw error;
  const { data } = supabase.storage.from("proposta-fotos").getPublicUrl(path);
  return data.publicUrl;
}
