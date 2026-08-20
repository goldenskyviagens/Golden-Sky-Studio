import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPropostaPublica } from "@/modules/pacotes/queries";
import { PropostaView } from "@/modules/pacotes/components/PropostaView";

// Rota pública (ver PUBLIC_PATHS em src/proxy.ts) — qualquer pessoa com o link
// acessa, sem login. A busca usa a função RPC get_proposta_publica (ver
// supabase/migrations/0001_propostas.sql), que só devolve a proposta quando o
// id exato é informado — não existe policy pública de "listar tudo".
export default async function PropostaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const proposta = await getPropostaPublica(supabase, id);

  if (!proposta) notFound();

  return <PropostaView proposta={proposta} />;
}
