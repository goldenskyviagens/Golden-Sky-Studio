// Extração da cotação COMPLETA de um pacote a partir de um único print de
// fornecedor (ex: hoteldo, consolidador — tela com voo + hospedagem +
// transfer + atividade juntos). Diferente de extract-produto.ts (que lê UM
// produto por vez), aqui a IA separa sozinha tudo que reconhecer na mesma
// imagem. Roda no servidor, mesma lógica de chave protegida das outras.

export interface ImageBlockInput {
  mediaType: string;
  base64: string;
}

const EXTRACTION_PROMPT = `Você está lendo um print de uma cotação de viagem COMPLETA de um fornecedor/operadora (ex: hoteldo, consolidador). A imagem pode conter várias seções diferentes: voo (ida e volta), hospedagem, transfer/traslado e atividade/passeio — cada uma normalmente aparece como uma linha ou bloco distinto na tela, às vezes com um botão "Ver detalhe" do lado.

Extraia em JSON PURO, sem texto antes/depois, sem markdown, neste formato exato:

{
  "destino": "cidade/região principal do destino (deduza do hotel, do voo ou da atividade — nome da cidade, nunca sigla IATA)",
  "dataInicio": "data de início da viagem, formato DD/MM/AAAA (data de ida do voo, ou check-in do hotel)",
  "dataFim": "data de fim da viagem, formato DD/MM/AAAA (data de volta do voo, ou check-out do hotel)",
  "voos": {
    "trechos": [
      {
        "label": "Ida" ou "Volta" ou "Trecho 2" etc,
        "data": "DD/MM/AAAA",
        "duracaoTotal": "duração total do trecho, ex: 7h10",
        "segmentos": [
          { "cia": "GOL"/"LATAM"/"AZUL"/etc, "numeroVoo": "ex: G31687", "origemCidade": "nome da cidade de origem, NUNCA sigla IATA", "destino": "nome da cidade de destino, NUNCA sigla IATA", "origemAeroporto": "ex: JPA · Aeroporto Presidente Castro Pinto (IATA + nome, se visível)", "destinoAeroporto": "ex: GRU · Aeroporto Internacional de Guarulhos", "saida": "HH:MM", "chegada": "HH:MM", "duracaoVoo": "ex: 3h30" }
        ],
        "conexoes": [
          { "local": "cidade da conexão", "iata": "sigla IATA do aeroporto de conexão", "duracao": "ex: 1h50" }
        ]
      }
    ]
  },
  "produtos": [
    {
      "tipo": "hospedagem" ou "transfer" ou "atividade" ou "seguro",
      "titulo": "nome do produto (ex: nome do hotel, tipo de transfer, nome do passeio, plano do seguro)",
      "subtitulo": "endereço+categoria (hospedagem) / tipo de veículo (transfer) / data-horário (atividade) / cobertura principal (seguro)",
      "descricao": "1-2 frases com detalhes adicionais visíveis no print — não invente nada",
      "itensInclusos": ["item 1", "item 2"]
    }
  ]
}

IMPORTANTE:
- Se a imagem NÃO mostrar informação de voo, devolva "voos": { "trechos": [] } — não invente.
- Cada seção de hospedagem/transfer/atividade/seguro visível na imagem vira uma entrada em "produtos" — pode ter 0, 1 ou mais de cada tipo. Se não houver nenhuma, devolva "produtos": [].
- Se não conseguir deduzir "destino", "dataInicio" ou "dataFim" com confiança, deixe vazio — não invente.
- "origemCidade" e "destino" (dentro de voos) devem ser SEMPRE nome da cidade, nunca sigla IATA.
- Cada trecho de voo tem 1 segmento se for direto, ou 2+ se tiver conexão — nesse caso "conexoes" tem sempre (nº de segmentos - 1).
- NÃO extraia preço, valor nem forma de pagamento de nenhuma seção — isso é sempre preenchido manualmente depois pelo agente, ignore completamente mesmo que apareça no print.
- Se não tiver certeza de um campo, deixe vazio ("" ou lista vazia). Responda SOMENTE com o JSON.`;

export async function extractPacoteFromImage(image: ImageBlockInput) {
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
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: [{ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.base64 } }, { type: "text", text: EXTRACTION_PROMPT }],
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
