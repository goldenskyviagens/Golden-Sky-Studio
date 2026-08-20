import { AirportChangeInfo, FlightOption, trechoAirportChanges } from "@/core/data/flights";
import { drawAlertIcon, drawClockIcon, drawPlaneIcon, roundRectPath, truncateText } from "@/core/render-engine/canvas-primitives";
import { GOLD, NAVY_DARK } from "@/core/render-engine/theme";

const WARNING = "#b3441a";

interface OptionBlock {
  pillY: number;
  labelText: string;
  rowY: number;
  saida: string;
  origem: string;
  origemAeroporto: string;
  chegada: string;
  destino: string;
  destinoAeroporto: string;
  duracaoTotal: string;
  paradas: string[];
  hasAirportChange: boolean;
  airportChanges: (AirportChangeInfo | null)[];
  segStartY: number;
  segEndY: number;
  segs: FlightOption["trechos"][number]["segmentos"];
  conexoes: FlightOption["trechos"][number]["conexoes"];
}

interface OptionLines {
  blocks: OptionBlock[];
  dividerYs: number[];
  totalHeight: number;
}

// Layout puro (dados -> posições), independente de canvas/DOM. Usado tanto
// para medir a altura do card quanto para desenhá-lo no export PNG.
export function buildOptionLines(op: FlightOption): OptionLines {
  const blocks: OptionBlock[] = [];
  const dividerYs: number[] = [];
  let y = 0;
  op.trechos.forEach((t, ti) => {
    const segs = t.segmentos.filter((s) => s.origemCidade || s.destino);
    if (!segs.length) return;
    const first = segs[0];
    const last = segs[segs.length - 1];
    const paradas = t.conexoes.map((c) => (c.local ? `${c.local}${c.iata ? " (" + c.iata + ")" : ""}` : "")).filter(Boolean);
    const airportChanges = trechoAirportChanges(t);
    const hasAirportChange = airportChanges.some(Boolean);
    if (hasAirportChange) y += 12; // espaço extra pro aviso "MUDANÇA DE AEROPORTO" acima da linha

    const pillY = y;
    y += 30;
    const rowY = y;
    y += 50;
    const segStartY = y;
    segs.forEach((_s, idx) => {
      y += 20;
      if (idx < segs.length - 1) y += 22;
    });
    const segEndY = y;
    y += 12;

    blocks.push({
      pillY,
      labelText: `${(t.label || "").toUpperCase()}${t.data ? " | " + t.data : ""}`,
      rowY,
      saida: first.saida || "",
      origem: first.origemCidade || "",
      origemAeroporto: first.origemAeroporto || "",
      chegada: last.chegada || "",
      destino: last.destino || "",
      destinoAeroporto: last.destinoAeroporto || "",
      duracaoTotal: t.duracaoTotal || "",
      paradas,
      hasAirportChange,
      airportChanges,
      segStartY,
      segEndY,
      segs,
      conexoes: t.conexoes,
    });

    if (ti < op.trechos.length - 1) {
      dividerYs.push(y + 8);
      y += 20;
    }
  });
  return { blocks, dividerYs, totalHeight: y };
}

export function drawOptionOnCanvas(ctx: CanvasRenderingContext2D, op: FlightOption, x: number, yTop: number, width: number) {
  const { blocks, dividerYs } = buildOptionLines(op);
  blocks.forEach((b) => {
    ctx.font = "700 10.5px 'Segoe UI', sans-serif";
    const textW = ctx.measureText(b.labelText).width;
    const pillPadX = 12;
    const iconSize = 12;
    const pillH = 22;
    const pillY = yTop + b.pillY;
    roundRectPath(ctx, x, pillY, iconSize + 8 + textW + pillPadX * 2 - 12, pillH, pillH / 2);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1;
    ctx.stroke();
    drawPlaneIcon(ctx, x + pillPadX, pillY + pillH / 2, iconSize, GOLD, -40);
    ctx.fillStyle = GOLD;
    ctx.textAlign = "left";
    ctx.fillText(b.labelText, x + pillPadX + iconSize / 2 + 8, pillY + pillH / 2 + 4);

    ctx.font = "700 17px 'Segoe UI', sans-serif";
    const leftTimeW = ctx.measureText(b.saida).width;
    const rightTimeW = ctx.measureText(b.chegada).width;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.fillText(b.saida, x, yTop + b.rowY + 15);
    ctx.textAlign = "right";
    ctx.fillText(b.chegada, x + width, yTop + b.rowY + 15);
    ctx.textAlign = "left";

    const halfWidth = width / 2 - 10;
    const origemIata = (b.origemAeroporto || "").split(" · ")[0].trim();
    const destinoIata = (b.destinoAeroporto || "").split(" · ")[0].trim();
    const origemLabel = origemIata ? `${b.origem} (${origemIata})` : b.origem;
    const destinoLabel = destinoIata ? `${b.destino} (${destinoIata})` : b.destino;

    ctx.font = "400 12px 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.textAlign = "left";
    ctx.fillText(truncateText(ctx, origemLabel, halfWidth), x, yTop + b.rowY + 40);
    ctx.textAlign = "right";
    ctx.fillText(truncateText(ctx, destinoLabel, halfWidth), x + width, yTop + b.rowY + 40);
    ctx.textAlign = "left";

    const lineY = yTop + b.rowY + 26;
    const lineStartX = x + Math.max(leftTimeW, 26) + 16;
    const lineEndX = x + width - Math.max(rightTimeW, 26) - 16 - 8;
    if (lineEndX > lineStartX) {
      ctx.save();
      ctx.strokeStyle = b.hasAirportChange ? WARNING : b.paradas.length ? GOLD : "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(lineStartX, lineY);
      ctx.lineTo(lineEndX, lineY);
      ctx.stroke();
      ctx.restore();

      const arrowColor = b.hasAirportChange ? WARNING : b.paradas.length ? GOLD : "rgba(255,255,255,0.5)";
      if (b.paradas.length) {
        ctx.fillStyle = arrowColor;
        ctx.beginPath();
        ctx.arc(lineStartX, lineY, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.save();
      ctx.fillStyle = arrowColor;
      ctx.beginPath();
      ctx.moveTo(lineEndX, lineY - 4);
      ctx.lineTo(lineEndX + 7, lineY);
      ctx.lineTo(lineEndX, lineY + 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      const midX = (lineStartX + lineEndX) / 2;
      ctx.textAlign = "center";
      let ly = lineY - 8;
      if (b.hasAirportChange) {
        ctx.font = "800 9.5px 'Segoe UI', sans-serif";
        ctx.fillStyle = WARNING;
        ctx.fillText("⚠ MUDANÇA DE AEROPORTO", midX, ly);
        ly -= 12;
      }
      if (b.paradas.length) {
        ctx.font = "400 10px 'Segoe UI', sans-serif";
        ctx.fillStyle = b.hasAirportChange ? WARNING : GOLD;
        ctx.fillText(`${b.paradas.length} parada${b.paradas.length > 1 ? "s" : ""} ${b.paradas.join(", ")}`, midX, ly);
        ly -= 12;
      } else {
        ctx.font = "400 10px 'Segoe UI', sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fillText("Voo direto", midX, ly);
        ly -= 12;
      }
      if (b.duracaoTotal) {
        ctx.font = "400 10px 'Segoe UI', sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(b.duracaoTotal, midX, ly);
      }
      ctx.textAlign = "left";
    }

    if (b.segs.length) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.25)";
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(x + 2, yTop + b.segStartY);
      ctx.lineTo(x + 2, yTop + b.segEndY);
      ctx.stroke();
      ctx.restore();

      let sy = b.segStartY;
      b.segs.forEach((s, idx) => {
        const cia = `${s.cia || ""} ${s.numeroVoo || ""}`.trim();
        const detail = `${s.saida || ""} ${s.origemCidade || ""} → ${s.chegada || ""} ${s.destino || ""}${s.duracaoVoo ? " (" + s.duracaoVoo + ")" : ""}`;
        const segX = x + 14;
        ctx.font = "700 11px 'Segoe UI', sans-serif";
        ctx.fillStyle = GOLD;
        ctx.textAlign = "left";
        ctx.fillText(cia, segX, yTop + sy + 10);
        const ciaW = cia ? ctx.measureText(cia).width + 6 : 0;
        ctx.font = "400 11px 'Segoe UI', sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        const maxDetailWidth = x + width - (segX + ciaW) - 6;
        ctx.fillText(truncateText(ctx, detail, maxDetailWidth), segX + ciaW, yTop + sy + 10);

        sy += 20;
        if (idx < b.segs.length - 1) {
          const c = b.conexoes[idx] || { duracao: "", local: "", iata: "" };
          const mudanca = b.airportChanges[idx];
          const connText = mudanca
            ? `${c.duracao ? c.duracao + " · " : ""}Mudança de aeroporto em ${mudanca.cidade}: ${mudanca.deIata} → ${mudanca.paraIata}`
            : `${c.duracao || "—"} de conexão em ${c.local || "—"}${c.iata ? " (" + c.iata + ")" : ""}`;
          ctx.font = mudanca ? "700 10px 'Segoe UI', sans-serif" : "600 10px 'Segoe UI', sans-serif";
          const iconSize = 11;
          const maxPillTextWidth = x + width - segX - (iconSize + 6) - 16 - 4;
          const connTextFit = truncateText(ctx, connText, maxPillTextWidth);
          const tw = ctx.measureText(connTextFit).width;
          const pillW = iconSize + 6 + tw + 16;
          roundRectPath(ctx, segX, yTop + sy, pillW, 18, 5);
          ctx.fillStyle = mudanca ? WARNING : "rgba(201,162,39,0.9)";
          ctx.fill();
          if (mudanca) {
            drawAlertIcon(ctx, segX + 10, yTop + sy + 9, iconSize, "#fff");
            ctx.fillStyle = "#fff";
          } else {
            drawClockIcon(ctx, segX + 10, yTop + sy + 9, iconSize, NAVY_DARK);
            ctx.fillStyle = NAVY_DARK;
          }
          ctx.fillText(connTextFit, segX + 10 + iconSize / 2 + 6, yTop + sy + 12);
          sy += 22;
        }
      });
    }
  });

  dividerYs.forEach((dy) => {
    ctx.strokeStyle = "rgba(201,162,39,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yTop + dy);
    ctx.lineTo(x + width, yTop + dy);
    ctx.stroke();
  });
}
