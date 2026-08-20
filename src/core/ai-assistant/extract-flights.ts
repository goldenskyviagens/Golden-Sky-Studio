// Extração de dados de voo a partir de prints de tela (Skyscanner, Google
// Flights, consolidadores etc.) via IA. Roda no servidor — a chave da API
// da Anthropic nunca é exposta ao navegador (ver src/app/api/extract/route.ts).
// Prompt/schema preservados do gerador-cotacao.jsx original; generalizável
// para outros tipos de produto no futuro (spec seção 6.1).

export interface ImageBlockInput {
  mediaType: string;
  base64: string;
}

const EXTRACTION_PROMPT_TEMPLATE = (count: number) => `Você está lendo ${count} print(s) de tela de cotações de voos (Skyscanner, Google Flights, Iddas, consolidador, etc). As imagens podem ser a mesma cotação em partes, ida e volta separadas, ou trechos de uma viagem multi-destino. Extraia em JSON PURO, sem texto antes/depois, sem markdown, neste formato exato:

{
  "opcoes": [
    {
      "trechos": [
        {
          "label": "Ida" ou "Volta" ou "Trecho 2" etc,
          "data": "DD/MM/AAAA",
          "duracaoTotal": "duração total do trecho, ex: 7h10",
          "segmentos": [
            { "cia": "GOL"/"LATAM"/"AZUL", "numeroVoo": "ex: G31687", "origemCidade": "nome da cidade de origem, NUNCA sigla IATA", "destino": "nome da cidade de destino, NUNCA sigla IATA", "origemAeroporto": "ex: JPA · Aeroporto Presidente Castro Pinto (IATA + nome do aeroporto, se visível na imagem)", "destinoAeroporto": "ex: GRU · Aeroporto Internacional de Guarulhos", "saida": "HH:MM", "chegada": "HH:MM", "duracaoVoo": "ex: 3h30" }
          ],
          "conexoes": [
            { "local": "cidade da conexão", "iata": "sigla IATA do aeroporto de conexão, ex: GRU", "duracao": "ex: 1h50" }
          ]
        }
      ],
      "precoPix": "valor numérico sem R$, ex: 2072.34"
    }
  ]
}

IMPORTANTE:
- "origemCidade" e "destino" devem ser SEMPRE o nome da cidade (ex: "João Pessoa", "São Paulo", "Foz do Iguaçu"), NUNCA a sigla do aeroporto (não use JPA, GRU, IGU etc).
- Cada trecho tem 1 "segmento" se for voo direto, ou 2+ segmentos se tiver conexão — nesse caso o número de "conexoes" é sempre (número de segmentos - 1), na ordem entre cada par de segmentos consecutivos, com o tempo de espera no aeroporto de conexão.
- Sempre inclua o número do voo de cada segmento quando visível na imagem.
- Para o campo "iata" de cada conexão, identifique o aeroporto exato onde a escala acontece (ex: São Paulo tem GRU e CGH, Rio de Janeiro tem GIG e SDU) — use o código IATA visível na imagem para não deixar ambíguo qual aeroporto da cidade é.
- Preste atenção especial quando a conexão envolve troca de aeroporto (o "destinoAeroporto" de um segmento é diferente do "origemAeroporto" do segmento seguinte, mesmo sendo a mesma cidade — ex: chega em CGH e o próximo voo sai de GRU). Extraia os códigos IATA de cada segmento exatamente como aparecem na imagem, sem igualar os dois só porque é a mesma cidade — essa informação é crítica pro cliente.
- Se houver mais de uma opção comparável (preços diferentes pra mesma rota), crie uma entrada em "opcoes" para cada uma.
- Datas sempre com ano (assuma o ano indicado na imagem ou o ano corrente mais próximo).
- Se não tiver certeza de um campo, deixe vazio. Responda SOMENTE com o JSON.`;

export async function extractFlightsFromImages(images: ImageBlockInput[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  }

  const imageBlocks = images.map((img) => ({
    type: "image" as const,
    source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: [...imageBlocks, { type: "text", text: EXTRACTION_PROMPT_TEMPLATE(images.length) }] }],
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
