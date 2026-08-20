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

// Desenha uma imagem preenchendo a caixa (x,y,w,h) cortando o excesso,
// equivalente a CSS object-fit: cover. Usado para fotos de destino em cards.
export function drawImageCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { naturalWidth: number; naturalHeight: number }, x: number, y: number, w: number, h: number) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > boxRatio) {
    sw = img.naturalHeight * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

// Quebra texto em várias linhas respeitando maxWidth (word-wrap), ao
// contrário de truncateText que corta com reticências numa linha só.
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

// Encontra o maior tamanho de fonte (entre min e max) que cabe o texto numa
// única linha em maxWidth — usado quando quebrar linha ou truncar deixaria
// pior (ex: uma lista curta de meses, que deve caber inteira numa linha só).
// Já deixa ctx.font configurado no tamanho escolhido ao retornar.
export function fitFontSize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, opts: { weight?: number | string; family?: string; max: number; min: number }): number {
  const { weight = 700, family = "'Segoe UI', sans-serif", max, min } = opts;
  for (let size = max; size >= min; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return size;
  }
  ctx.font = `${weight} ${min}px ${family}`;
  return min;
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

// Ícones simples de destaque (linha única), usados na fileira de
// diferenciais do card de Promoção (segurança, suporte etc).
export function drawShieldIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const w = size * 0.72;
  const h = size * 0.86;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy - h / 2 + h * 0.18);
  ctx.lineTo(cx + w / 2, cy + h * 0.05);
  ctx.quadraticCurveTo(cx + w / 2, cy + h * 0.4, cx, cy + h / 2);
  ctx.quadraticCurveTo(cx - w / 2, cy + h * 0.4, cx - w / 2, cy + h * 0.05);
  ctx.lineTo(cx - w / 2, cy - h / 2 + h * 0.18);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.22, cy);
  ctx.lineTo(cx - w * 0.03, cy + h * 0.17);
  ctx.lineTo(cx + w * 0.28, cy - h * 0.15);
  ctx.stroke();
  ctx.restore();
}

export function drawHeadsetIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const r = size * 0.4;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy - size * 0.02, r, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - r, cy - size * 0.02);
  ctx.lineTo(cx - r, cy + size * 0.14);
  ctx.moveTo(cx + r, cy - size * 0.02);
  ctx.lineTo(cx + r, cy + size * 0.14);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx - r, cy + size * 0.22, size * 0.13, 0, Math.PI * 2);
  ctx.arc(cx + r, cy + size * 0.22, size * 0.13, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCalendarIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const w = size;
  const h = size * 0.86;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.08;
  ctx.lineJoin = "round";
  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, size * 0.12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, cy - h / 2 + h * 0.32);
  ctx.lineTo(cx + w / 2, cy - h / 2 + h * 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.22, cy - h / 2 - h * 0.06);
  ctx.lineTo(cx - w * 0.22, cy - h / 2 + h * 0.16);
  ctx.moveTo(cx + w * 0.22, cy - h / 2 - h * 0.06);
  ctx.lineTo(cx + w * 0.22, cy - h / 2 + h * 0.16);
  ctx.stroke();
  ctx.restore();
}

export function drawAlertIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const h = size * 0.86;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.11;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + size / 2, cy + h / 2);
  ctx.lineTo(cx - size / 2, cy + h / 2);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.08);
  ctx.lineTo(cx, cy + h * 0.16);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.32, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCardIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  const w = size;
  const h = size * 0.7;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.08;
  roundRectPath(ctx, cx - w / 2, cy - h / 2, w, h, size * 0.12);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillRect(cx - w / 2, cy - h / 2 + h * 0.24, w, h * 0.18);
  ctx.restore();
}
