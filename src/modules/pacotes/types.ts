import { FlightOption } from "@/core/data/flights";
import { TAXAS_PADRAO, TaxaParcela } from "@/core/data/installments";

// Modelo de dados da Proposta Premium: ao contrário de Passagens/Promoções (que
// geram uma imagem), aqui o conteúdo vira uma página web pública persistida no
// Supabase — por isso cada campo aqui é o que efetivamente aparece pro cliente.

export interface DiaRoteiro {
  id: string;
  titulo: string;
  descricao: string;
}

// Hospedagem, transfer ou atividade/passeio — um bloco repetível preenchido
// via print+IA (ou à mão), mostrado na página pública como uma linha
// resumida com "Ver detalhes" (fotos, descrição, itens inclusos daquele
// produto específico). Voo continua fora disso, com o modelo próprio
// (FlightOption) que já lida bem com conexões etc.
export type ProdutoTipo = "hospedagem" | "transfer" | "atividade";

export interface Produto {
  id: string;
  tipo: ProdutoTipo;
  titulo: string;
  subtitulo: string;
  descricao: string;
  itensInclusos: string[];
  // Sempre URLs hospedadas (Supabase Storage) — mesma razão de fotoCapaUrl.
  fotos: string[];
}

export interface Proposta {
  id: string; // vazio até salvar pela 1ª vez — depois é o id da linha no Supabase (e o slug do link)
  titulo: string;
  destino: string;
  dataInicio: string;
  dataFim: string;
  pessoas: number;
  // Sempre uma URL hospedada (Supabase Storage), nunca um blob: local — a
  // página pública é servida pra qualquer visitante, então a foto precisa
  // estar acessível de fora do navegador de quem montou a proposta.
  fotoCapaUrl: string;
  produtos: Produto[];
  roteiro: DiaRoteiro[];
  voos: FlightOption[];
  inclusos: string[];
  naoInclusos: string[];
  precoPix: string;
  parcelaDestaque: number;
  semJurosAte: string;
  // Congeladas no momento em que a proposta é salva — a página pública fica
  // no ar por tempo indeterminado, então os valores mostrados não podem mudar
  // silenciosamente se a taxa padrão do cartão for ajustada depois no código.
  taxas: TaxaParcela[];
  validadeProposta: string;
  observacoes: string[];
  whatsapp: string;
}

function randomId() {
  return Math.random().toString(36).slice(2, 9);
}

export function emptyDiaRoteiro(): DiaRoteiro {
  return { id: randomId(), titulo: "", descricao: "" };
}

export function emptyProduto(tipo: ProdutoTipo): Produto {
  return { id: randomId(), tipo, titulo: "", subtitulo: "", descricao: "", itensInclusos: [], fotos: [] };
}

export function emptyProposta(): Proposta {
  return {
    id: "",
    titulo: "",
    destino: "",
    dataInicio: "",
    dataFim: "",
    pessoas: 2,
    fotoCapaUrl: "",
    produtos: [],
    roteiro: [emptyDiaRoteiro()],
    voos: [],
    inclusos: ["Hospedagem", "Café da manhã", "Traslados"],
    naoInclusos: ["Passeios opcionais", "Despesas pessoais"],
    precoPix: "",
    parcelaDestaque: 10,
    semJurosAte: "",
    taxas: TAXAS_PADRAO,
    validadeProposta: "",
    observacoes: ["Valores sujeitos a alteração e disponibilidade sem aviso prévio."],
    whatsapp: "",
  };
}
