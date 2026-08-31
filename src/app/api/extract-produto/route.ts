import { NextRequest, NextResponse } from "next/server";
import { extractProdutoFromImage } from "@/core/ai-assistant/extract-produto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const image = body?.image;
    const tipo = body?.tipo;
    if (!image?.base64) {
      return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
    }

    const parsed = await extractProdutoFromImage(image, tipo);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar imagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
