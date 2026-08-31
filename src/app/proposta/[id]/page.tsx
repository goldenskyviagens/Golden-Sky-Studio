import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPropostaPublica } from "@/modules/pacotes/queries";
import { PropostaView } from "@/modules/pacotes/components/PropostaView";

// Rota pública (ver PUBLIC_PATHS em src/proxy.ts) — qualquer pessoa com o link
// acessa, sem login. A busca usa a função RPC get_proposta_publica (ver
// supabase/migrations/0001_propostas.sql), que só devolve a proposta quando o
// id exato é informado — não existe policy pública de "listar tudo".

// Título/descrição/imagem de capa da proposta viram as tags Open Graph —
// é isso que faz o link mostrar a foto de capa (e não o card genérico do
// Golden Sky Studio) quando colado no WhatsApp.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const proposta = await getPropostaPublica(supabase, id);
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

export default async function PropostaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const proposta = await getPropostaPublica(supabase, id);

  if (!proposta) notFound();

  return <PropostaView proposta={proposta} />;
}
