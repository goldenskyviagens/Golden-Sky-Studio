import { FlightOption } from "@/core/data/flights";
import { roundRectPath } from "@/core/render-engine/canvas-primitives";
import { loadImage } from "@/core/render-engine/load-image";
import { BRAND_LOGO_SRC, GOLD, NAVY_DARK } from "@/core/render-engine/theme";
import { buildOptionLines, drawOptionOnCanvas } from "./card-layout";

// Motor de renderização em duas camadas: DOM para prévia, Canvas para
// exportação PNG em alta resolução — gera o arquivo final para download.
export async function downloadFlightCard(active: FlightOption): Promise<void> {
  const logo = await loadImage(BRAND_LOGO_SRC);

  const cardWidth = 420;
  const padding = 18;
  const bottomPadding = 22;
  const logoHeight = 54;
  const logoWidth = logoHeight * (logo.naturalWidth / logo.naturalHeight);
  const dividerY = padding + logoHeight + 6;
  const contentStartY = dividerY + 16;
  const colWidth = cardWidth - padding * 2;
  const { totalHeight } = buildOptionLines(active);
  const cardHeight = contentStartY + totalHeight + bottomPadding;
  const scale = 4;

  const canvas = document.createElement("canvas");
  canvas.width = cardWidth * scale;
  canvas.height = cardHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context indisponível.");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  roundRectPath(ctx, 0, 0, cardWidth, cardHeight, 16);
  ctx.fillStyle = NAVY_DARK;
  ctx.fill();

  ctx.lineWidth = 1;
  ctx.strokeStyle = GOLD;
  roundRectPath(ctx, 0.5, 0.5, cardWidth - 1, cardHeight - 1, 16);
  ctx.stroke();

  ctx.drawImage(logo, padding, padding, logoWidth, logoHeight);

  ctx.strokeStyle = "rgba(201,162,39,0.4)";
  ctx.beginPath();
  ctx.moveTo(padding, dividerY);
  ctx.lineTo(cardWidth - padding, dividerY);
  ctx.stroke();

  drawOptionOnCanvas(ctx, active, padding, contentStartY, colWidth);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Não consegui gerar a imagem pra download."));
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cotacao-golden-sky-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      resolve();
    }, "image/png");
  });
}
