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

// Extrai a sigla IATA de um campo "aeroporto" no formato "IATA · Nome completo".
export function extractIata(aeroporto: string): string {
  return (aeroporto || "").split(" · ")[0].trim().toUpperCase();
}

export interface AirportChangeInfo {
  cidade: string;
  deIata: string;
  paraIata: string;
}

// Detecta troca de aeroporto numa conexão: o voo pousa num aeroporto e o
// próximo decola de outro aeroporto diferente na mesma cidade (ex: CGH ➜ GRU
// em São Paulo, GIG ➜ SDU no Rio). Diferente de uma conexão comum, o
// passageiro precisa se deslocar entre aeroportos — precisa ser avisado.
export function detectAirportChange(segAnterior: Segmento, segProximo: Segmento): AirportChangeInfo | null {
  const deIata = extractIata(segAnterior.destinoAeroporto);
  const paraIata = extractIata(segProximo.origemAeroporto);
  if (!deIata || !paraIata || deIata === paraIata) return null;
  return { cidade: segAnterior.destino || segProximo.origemCidade || "", deIata, paraIata };
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

export function bagagemLinhas(op: { bagagemPreset: string; bagagemCustom: string }): string[] {
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

// Uma entrada por conexão do trecho (segmentos.length - 1), na mesma ordem —
// null quando a conexão é comum, preenchida quando há troca de aeroporto.
export function trechoAirportChanges(trecho: Trecho): (AirportChangeInfo | null)[] {
  const segs = trecho.segmentos.filter((s) => s.origemCidade || s.destino);
  return segs.slice(0, -1).map((s, idx) => detectAirportChange(s, segs[idx + 1]));
}

function cityKey(cidade: string | undefined): string {
  return (cidade || "").trim().toLowerCase();
}

// Diferença entre dois horários "HH:MM", assumindo o segundo depois do
// primeiro no mesmo dia (ou no dia seguinte, se for menor) — usada pra
// calcular a conexão "entre imagens" que nenhum print mostra escrita.
function diffHHMM(chegada: string, saida: string): string {
  const m1 = /^(\d{1,2}):(\d{2})/.exec(chegada || "");
  const m2 = /^(\d{1,2}):(\d{2})/.exec(saida || "");
  if (!m1 || !m2) return "";
  const chMin = Number(m1[1]) * 60 + Number(m1[2]);
  const saMin = Number(m2[1]) * 60 + Number(m2[2]);
  let diff = saMin - chMin;
  if (diff < 0) diff += 24 * 60;
  const h = Math.floor(diff / 60);
  const min = diff % 60;
  return `${h}h${String(min).padStart(2, "0")}`;
}

// Encadeia um grupo de trechos (mesmo rótulo, ex: vários "Ida" vindos de
// imagens/reservas diferentes) na ordem cronológica correta — por cidade de
// origem/destino, não pela ordem em que a IA os extraiu (imagens diferentes
// podem sair fora de ordem). Calcula a conexão "entre imagens" que nenhum
// print mostra escrita, a partir da diferença de horário.
function chainTrechoGroup(grupo: Trecho[]): Trecho {
  const restantes = [...grupo];
  const destinos = new Set(restantes.map((t) => cityKey(t.segmentos[t.segmentos.length - 1]?.destino)));
  const inicioIdx = restantes.findIndex((t) => !destinos.has(cityKey(t.segmentos[0]?.origemCidade)));
  const [atual] = restantes.splice(inicioIdx >= 0 ? inicioIdx : 0, 1);

  const segmentos = [...atual.segmentos];
  const conexoes = [...atual.conexoes];

  while (restantes.length) {
    const ultimoDestino = cityKey(segmentos[segmentos.length - 1]?.destino);
    let proxIdx = restantes.findIndex((t) => cityKey(t.segmentos[0]?.origemCidade) === ultimoDestino);
    if (proxIdx < 0) proxIdx = 0; // não encaixou por cidade — concatena mesmo assim, evita perder dados
    const [proximo] = restantes.splice(proxIdx, 1);

    const segAnterior = segmentos[segmentos.length - 1];
    const segProximo = proximo.segmentos[0];
    conexoes.push({
      id: randomId(),
      local: segAnterior?.destino || segProximo?.origemCidade || "",
      iata: extractIata(segAnterior?.destinoAeroporto || "") || extractIata(segProximo?.origemAeroporto || ""),
      duracao: diffHHMM(segAnterior?.chegada || "", segProximo?.saida || ""),
    });
    segmentos.push(...proximo.segmentos);
    conexoes.push(...proximo.conexoes);
  }

  return { ...atual, segmentos, conexoes };
}

// Junta trechos com o mesmo rótulo (ex: 2 "Ida" vindos de reservas/imagens
// diferentes que se encaixam numa única viagem contínua) num só trecho por
// rótulo. Feito em código (não pela IA) porque a extração é boa em ler o
// print, mas não é confiável pra reconstruir a ordem cronológica entre
// imagens nem fazer a conta do horário de conexão.
export function mergeConnectingTrechos(trechos: Trecho[]): Trecho[] {
  const grupos = new Map<string, Trecho[]>();
  const ordem: string[] = [];
  trechos.forEach((t) => {
    const key = (t.label || "").trim().toLowerCase() || t.id;
    if (!grupos.has(key)) {
      grupos.set(key, []);
      ordem.push(key);
    }
    grupos.get(key)!.push(t);
  });

  return ordem.map((key) => {
    const grupo = grupos.get(key)!;
    return grupo.length > 1 ? chainTrechoGroup(grupo) : grupo[0];
  });
}

export function isRoundTrip(trechos: Trecho[]): boolean {
  if (trechos.length < 2) return false;
  const first = trechos[0];
  const last = trechos[trechos.length - 1];
  const firstOrigin = first.segmentos[0]?.origemCidade || "";
  const lastDest = last.segmentos[last.segmentos.length - 1]?.destino || "";
  return Boolean(firstOrigin) && lastDest === firstOrigin;
}
