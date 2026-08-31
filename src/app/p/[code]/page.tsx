import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPropostaPublicaPorCodigo } from "@/modules/pacotes/queries";
import { PropostaView } from "@/modules/pacotes/components/PropostaView";

// Versão curta de /proposta/[id] — mesmo conteúdo, só que localizado pelo
// código curto (/p/<code>) em vez do uuid inteiro, pra ficar mais
// apresentável quando colado no WhatsApp. Rota pública (ver PUBLIC_PATHS em
// src/proxy.ts); a busca usa a RPC get_proposta_publica_por_codigo (ver
// supabase/migrations/0003_short_code.sql), que só devolve a proposta quando
// o código exato bate — não existe policy pública de "listar tudo".

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const proposta = await getPropostaPublicaPorCodigo(supabase, code);
  if (!proposta) return {};

  const titulo = proposta.destino ? `Proposta de viagem — ${proposta.destino}` : "Proposta de viagem";
  const descricao = "Confira os detalhes da sua proposta de viagem com a Golden Sky Viagens.";

  return {
    title: titulo,
    description: descricao,
    openGraph: {
      title: titulo,
      description: descricao,
      type: "website",
      images: proposta.fotoCapaUrl ? [{ url: proposta.fotoCapaUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descricao,
      images: proposta.fotoCapaUrl ? [proposta.fotoCapaUrl] : undefined,
    },
  };
}

export default async function PropostaPublicaPorCodigoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createSupabaseServerClient();
  const proposta = await getPropostaPublicaPorCodigo(supabase, code);

  if (!proposta) notFound();

  return <PropostaView proposta={proposta} />;
}
