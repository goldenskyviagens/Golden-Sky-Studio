// Cálculo de parcelamento com taxas configuráveis por número de parcelas.
// Reutilizável por qualquer módulo que cobre via cartão (Passagens, Pacotes, Hotéis...).

export interface TaxaParcela {
  n: number;
  taxaPercent: number;
}

export interface ParcelaCalculada {
  n: number;
  valor: number;
  total: number;
}

export const TAXAS_PADRAO: TaxaParcela[] = [
  { n: 1, taxaPercent: 5.43 },
  { n: 2, taxaPercent: 5.43 },
  { n: 3, taxaPercent: 6.27 },
  { n: 4, taxaPercent: 7.124 },
  { n: 5, taxaPercent: 8.001 },
  { n: 6, taxaPercent: 8.883 },
  { n: 7, taxaPercent: 9.002 },
  { n: 8, taxaPercent: 9.9 },
  { n: 9, taxaPercent: 10.813 },
  { n: 10, taxaPercent: 11.742 },
  { n: 11, taxaPercent: 12.686 },
  { n: 12, taxaPercent: 13.646 },
];

export function installmentTable(pix: string | number, taxas: TaxaParcela[]): ParcelaCalculada[] {
  const p = parseFloat(String(pix));
  if (!p || isNaN(p)) return [];
  return taxas.map(({ n, taxaPercent }) => {
    const total = p * (1 + (taxaPercent || 0) / 100);
    return { n, valor: total / n, total };
  });
}
