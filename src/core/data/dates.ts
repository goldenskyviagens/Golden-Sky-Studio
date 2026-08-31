// Conversão entre o formato brasileiro (DD/MM/AAAA, usado em textos/legendas
// e no que a IA extrai dos prints) e o formato ISO (AAAA-MM-DD, exigido por
// <input type="date"> nativo do navegador) — reutilizável por qualquer campo
// de data que use o seletor nativo em vez de texto livre.

export function dateBRtoISO(str: string): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((str || "").trim());
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function dateISOtoBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!m) return iso || "";
  const [, y, mo, d] = m;
  return `${d}/${mo}/${y}`;
}
