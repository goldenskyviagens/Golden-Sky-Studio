// Extração de dados de um "produto" do pacote (hospedagem, transfer ou
// atividade/passeio) a partir de um print de cotação de fornecedor (ex:
// hoteldo, operadoras em geral) — roda no servidor, mesma lógica de chave
// protegida usada em extract-flights.ts/extract-promo.ts. Ignora preço e
// forma de pagamento de propósito: isso muda a cada negociação e fica
// sempre manual, preenchido pelo agente.

export interface ImageBlockInput {
  mediaType: string;
  base64: string;
}

const DICAS_POR_TIPO: Record<string, string> = {
  hospedagem: `Isto é um print de HOSPEDAGEM (hotel/pousada). "titulo" = nome do hotel. "subtitulo" = endereço/bairro e categoria (ex: "Rua Barão de Itapoan, 60, Salvador — 3 estrelas") ou período de noites (ex: "5 noites"). "itensInclusos" = regime de café da manhã, wifi, cancelamento grátis etc, um item por linha.`,
  transfer: `Isto é um print de TRANSFER/TRASLADO. "titulo" = tipo de serviço (ex: "Transfer Privado"). "subtitulo" = tipo de veículo e capacidade (ex: "Mini van — até 5 pessoas"). "itensInclusos" = cancelamento grátis, ida e volta, motorista bilíngue etc.`,
  atividade: `Isto é um print de ATIVIDADE/PASSEIO. "titulo" = nome do passeio (ex: "City Tour Salvador"). "subtitulo" = data/horário e duração (ex: "Dom. 18/out, 06:30h"). "itensInclusos" = guia, idiomas, transfer incluso, ingressos etc.`,
};

const EXTRACTION_PROMPT = (tipo: string) => `Você está lendo um print de uma cotação de viagem (de um fornecedor/operadora, ex: hoteldo, consolidador, etc). ${DICAS_POR_TIPO[tipo] || ""}

Extraia em JSON PURO, sem texto antes/depois, sem markdown, neste formato exato:

{
  "titulo": "...",
  "subtitulo": "...",
  "descricao": "1-2 frases com detalhes adicionais relevantes visíveis no print (ex: nome do quarto, política de cancelamento, o que o passeio inclui) — não invente nada que não esteja no print",
  "itensInclusos": ["item 1", "item 2"]
}

IMPORTANTE:
- NÃO extraia preço, valor, forma de pagamento nem parcelamento — isso é sempre preenchido manualmente depois, ignore completamente mesmo que apareça no print.
- Se não tiver certeza de um campo, deixe vazio ("" ou lista vazia). Responda SOMENTE com o JSON.`;

export async function extractProdutoFromImage(image: ImageBlockInput, tipo: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } }, { type: "text", text: EXTRACTION_PROMPT(tipo) }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textBlock = (data.content || []).find((b: { type: string }) => b.type === "text");
  if (!textBlock) throw new Error("sem resposta de texto");
  const clean = textBlock.text
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(clean);
}
