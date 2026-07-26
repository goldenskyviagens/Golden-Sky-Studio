// Primitivas de desenho em Canvas reutilizáveis pelo Render Engine (qualquer
// módulo que exporte cards/materiais como PNG/PDF): retângulo arredondado,
// ícones vetoriais e truncamento de texto com reticências.

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

const PLANE_PATH_D = "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";
let _planePath2D: Path2D | null = null;
function getPlanePath(): Path2D | null {
  if (!_planePath2D && typeof Path2D !== "undefined") _planePath2D = new Path2D(PLANE_PATH_D);
  return _planePath2D;
}

export function drawPlaneIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, rotationDeg = 0) {
  const path = getPlanePath();
  if (!path) return;
  ctx.save();
  ctx.translate(cx, cy);
  if (rotationDeg) ctx.rotate((rotationDeg * Math.PI) / 180);
  const s = size / 24;
  ctx.scale(s, s);
  ctx.translate(-12, -12);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke(path);
  ctx.restore();
}

export function drawClockIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const r = size / 2;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - r * 0.55);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + r * 0.4, cy + r * 0.15);
  ctx.stroke();
  ctx.restore();
}
