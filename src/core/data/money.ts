export function fmtMoney(v: string | number | null | undefined): string {
  if (v === "" || v === undefined || v === null || isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
