import { NextRequest, NextResponse } from "next/server";
import { extractFlightsFromImages } from "@/core/ai-assistant/extract-flights";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const images = body?.images;
    if (!Array.isArray(images) || !images.length) {
      return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
    }

    const parsed = await extractFlightsFromImages(images);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Erro desconhecido ao processar imagens.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
