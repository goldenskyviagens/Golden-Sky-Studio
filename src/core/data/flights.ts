// Modelo de dados hierárquico de voos: opções → trechos (ida/volta/multi-destino) →
// segmentos (voos diretos) → conexões (escalas). Reaproveitado pelo módulo de
// Passagens e, futuramente, pelo bloco "Detalhes de voos" da Proposta Premium.

export interface Segmento {
  id: string;
  cia: string;
  numeroVoo: string;
  origemCidade: string;
  destino: string;
  origemAeroporto: string;
  destinoAeroporto: string;
  saida: string;
  chegada: string;
  duracaoVoo: string;
}

export interface Conexao {
  id: string;
  local: string;
  iata: string;
  duracao: string;
}

export interface Trecho {
  id: string;
  label: string;
  data: string;
  duracaoTotal: string;
  segmentos: Segmento[];
  conexoes: Conexao[];
}

export interface FlightOption {
  id: string;
  rotulo: string;
  trechos: Trecho[];
  passageiros: number;
  bebes: number;
  bagagemPreset: string;
  bagagemCustom: string;
  condicoes: string[];
  precoPix: string;
  parcelaDestaque: number;
  semJurosAte: string;
}

export const BAGAGEM_PRESETS = [
  { id: "item", label: "Item pessoal 10kg", linhas: ["Item pessoal 10kg"] },
  { id: "mala12", label: "Item pessoal 10kg + Mala 12kg", linhas: ["Item pessoal 10kg", "Mala de 12kg"] },
  { id: "mala10", label: "Item pessoal 10kg + Mala 10kg", linhas: ["Item pessoal 10kg", "Mala de 10kg"] },
  { id: "mala23", label: "Item pessoal 10kg + Mala despachada de 23kg", linhas: ["Item pessoal 10kg", "Mala despachada de 23kg"] },
  { id: "mala23x2", label: "Item pessoal 10kg + (2x) Mala despachada de 23kg", linhas: ["Item pessoal 10kg", "2x Mala despachada de 23kg"] },
  { id: "mala23x3", label: "Item pessoal 10kg + (3x) Mala despachada de 23kg", linhas: ["Item pessoal 10kg", "3x Mala despachada de 23kg"] },
  { id: "custom", label: "Personalizado...", linhas: [] as string[] },
];

function randomId() {
  return Math.random().toString(36).slice(2, 9);
}

export function baggageFromAirlines(cias: (string | undefined)[]) {
  const set = new Set((cias || []).map((a) => (a || "").toUpperCase()));
  if ([...set].some((a) => a.includes("AZUL"))) return "mala10";
  if ([...set].some((a) => a.includes("GOL") || a.includes("LATAM"))) return "mala12";
  return "item";
}

export function emptySegmento(): Segmento {
  return { id: randomId(), cia: "", numeroVoo: "", origemCidade: "", destino: "", origemAeroporto: "", destinoAeroporto: "", saida: "", chegada: "", duracaoVoo: "" };
}

export function emptyConexao(): Conexao {
  return { id: randomId(), local: "", iata: "", duracao: "" };
}

export function emptyTrecho(label: string): Trecho {
  return { id: randomId(), label, data: "", duracaoTotal: "", segmentos: [emptySegmento()], conexoes: [] };
}

export function emptyOption(): FlightOption {
  return {
    id: randomId(),
    rotulo: "",
    trechos: [emptyTrecho("Ida")],
    passageiros: 1,
    bebes: 0,
    bagagemPreset: "mala12",
    bagagemCustom: "",
    condicoes: [
      "Tarifa não reembolsável",
      "Remarcação mediante taxa + diferença tarifária",
      "Marcação de assento com custo adicional",
    ],
    precoPix: "",
    parcelaDestaque: 10,
    semJurosAte: "",
  };
}

export function bagagemLinhas(op: FlightOption): string[] {
  if (op.bagagemPreset === "custom") return op.bagagemCustom.split("\n").map((s) => s.trim()).filter(Boolean);
  const preset = BAGAGEM_PRESETS.find((b) => b.id === op.bagagemPreset);
  return preset ? preset.linhas : [];
}

// Endpoints/rota label usando nomes de cidade, tratando corretamente ida-e-volta vs multi-destino.
export function routeLabel(trechos: Trecho[]): string {
  if (!trechos.length || !trechos[0].segmentos.length) return "Origem ➜ Destino";
  const first = trechos[0];
  const last = trechos[trechos.length - 1];
  const firstOrigin = first.segmentos[0]?.origemCidade || "Origem";
  const firstDest = first.segmentos[first.segmentos.length - 1]?.destino || "Destino";
  const lastDest = last.segmentos[last.segmentos.length - 1]?.destino || "";
  if (trechos.length <= 1 || lastDest === firstOrigin) {
    return `${firstOrigin} ➜ ${firstDest}`;
  }
  const points = [firstOrigin, ...trechos.map((t) => t.segmentos[t.segmentos.length - 1]?.destino || "")];
  return points.join(" ➜ ");
}

export function isRoundTrip(trechos: Trecho[]): boolean {
  if (trechos.length < 2) return false;
  const first = trechos[0];
  const last = trechos[trechos.length - 1];
  const firstOrigin = first.segmentos[0]?.origemCidade || "";
  const lastDest = last.segmentos[last.segmentos.length - 1]?.destino || "";
  return Boolean(firstOrigin) && lastDest === firstOrigin;
}
