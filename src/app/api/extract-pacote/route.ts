import { NextRequest, NextResponse } from "next/server";
import { extractPacoteFromImage } from "@/core/ai-assistant/extract-pacote";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const image = body?.image;
    if (!image?.base64) {
      return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
    }

    const parsed = await extractPacoteFromImage(image);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar imagem.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
