import { FlightOption, bagagemLinhas, isRoundTrip, routeLabel } from "@/core/data/flights";
import { TaxaParcela, installmentTable } from "@/core/data/installments";
import { fmtMoney } from "@/core/data/money";

// Geração de legenda formatada para WhatsApp (bagagem, condições de tarifa,
// tabela de parcelamento configurável). Lógica preservada 1:1 do gerador original.
export function buildCaption(op: FlightOption | undefined, taxas: TaxaParcela[]): string {
  if (!op) return "";
  const multiDestino = op.trechos.length > 1 && !isRoundTrip(op.trechos);

  let txt = "";
  if (op.trechos.length === 1) {
    const rota = op.rotulo || routeLabel(op.trechos);
    txt += `✈ *${rota}*\n`;
    txt += `📅 *Data:* ${op.trechos[0].data || "—"}\n`;
  } else if (multiDestino) {
    op.trechos.forEach((t) => {
      const segs = t.segmentos.filter((s) => s.origemCidade || s.destino);
      const origem = segs[0]?.origemCidade || "—";
      const destino = segs[segs.length - 1]?.destino || "—";
      txt += `✈️ *${origem} ➜ ${destino}*\n`;
      txt += `📅 *Ida:* ${t.data || "—"}\n\n`;
    });
  } else {
    const rota = op.rotulo || routeLabel(op.trechos);
    txt += `✈ *${rota}*\n`;
    txt += `📅 *${op.trechos[0].label || "Ida"}:* ${op.trechos[0].data || "—"}\n`;
    txt += `📅 *${op.trechos[1].label || "Volta"}:* ${op.trechos[1].data || "—"}\n`;
  }
  txt += `👥 ${op.passageiros} Passageiro${op.passageiros > 1 ? "s" : ""}${op.bebes > 0 ? ` (${op.bebes} bebê${op.bebes > 1 ? "s" : ""})` : ""}\n\n`;

  txt += `🎒 *O que está incluso:*\n`;
  bagagemLinhas(op).forEach((l) => (txt += `✔ ${l}\n`));
  txt += `✔ Taxas aeroportuárias inclusas\n`;
  txt += `✔ Suporte antes e durante a viagem\n\n`;

  txt += `📋 *Condições da tarifa:*\n`;
  op.condicoes.forEach((c) => (txt += `- ${c}\n`));
  txt += `\n`;

  const table = installmentTable(op.precoPix, taxas);
  const destaqueRow = table.find((r) => r.n === Number(op.parcelaDestaque));

  txt += `💰 *INVESTIMENTO PARA GARANTIR AGORA:*\n`;
  txt += `💰 R$ ${fmtMoney(op.precoPix)} NO PIX\n`;
  if (op.semJurosAte) {
    // Mostra o valor total, não dividido por parcela: no parcelamento sem
    // juros da companhia a 1ª parcela costuma vir mais alta (taxas embutidas),
    // então dividir igualmente pelo número de parcelas seria incorreto.
    const n = Number(op.semJurosAte);
    txt += `✅ R$ ${fmtMoney(op.precoPix)} EM ATÉ ${n}X SEM JUROS\n`;
  }
  if (destaqueRow) txt += `💳 R$ ${fmtMoney(destaqueRow.valor)} EM ${op.parcelaDestaque}X NO CARTÃO (TOTAL: R$ ${fmtMoney(destaqueRow.total)})\n`;
  txt += `- *Caso queira pagar numa quantidade menor de parcelas, conseguimos diminuir o valor parcelado.*\n\n`;
  txt += `⚠️ *Valor sujeito a alteração sem aviso prévio e disponibilidade.*`;

  return txt;
}
