const sharp = require("sharp");
const path = require("path");

const SRC = "C:\\1Projetos\\GOLDEN STUDIO\\logo-golden-sky.png.png";
const OUT_DIR = path.join(__dirname, "..", "public", "branding");
const OUT_FULL = path.join(OUT_DIR, "logo-golden-sky.png");
const OUT_MARK = path.join(OUT_DIR, "logo-golden-sky-mark.png");

const BG = [3, 26, 91]; // #031A5B, cor de fundo sólida detectada na logo

function colorToAlpha(data, channels) {
  for (let i = 0; i < data.length; i += channels) {
    const c = [data[i], data[i + 1], data[i + 2]];
    let alpha = 0;
    for (let ch = 0; ch < 3; ch++) {
      let a;
      if (c[ch] > BG[ch]) {
        a = (c[ch] - BG[ch]) / (255 - BG[ch]);
      } else if (c[ch] < BG[ch]) {
        a = (BG[ch] - c[ch]) / (BG[ch] || 1);
      } else {
        a = 0;
      }
      if (a > alpha) alpha = a;
    }
    alpha = Math.min(1, Math.max(0, alpha));
    if (alpha > 0) {
      for (let ch = 0; ch < 3; ch++) {
        const v = BG[ch] + (c[ch] - BG[ch]) / alpha;
        data[i + ch] = Math.min(255, Math.max(0, Math.round(v)));
      }
    } else {
      data[i] = BG[0];
      data[i + 1] = BG[1];
      data[i + 2] = BG[2];
    }
    data[i + 3] = Math.round(alpha * 255);
  }
  return data;
}

async function main() {
  const img = sharp(SRC).ensureAlpha();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const processed = colorToAlpha(Buffer.from(data), info.channels);

  // Salva o canvas completo (transparente, sem recorte) como intermediário.
  const rawPng = await sharp(processed, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .png()
    .toBuffer();

  const fullBuffer = await sharp(rawPng).trim({ threshold: 5 }).toBuffer();
  await sharp(fullBuffer).toFile(OUT_FULL);
  const fullMeta = await sharp(fullBuffer).metadata();
  console.log("full logo saved:", OUT_FULL, fullMeta.width, fullMeta.height);

  // Recorta só o símbolo (nuvem + avião), sem o texto "GOLDEN SKY" / "AGÊNCIA DE VIAGENS".
  // Linha 1483 = fim do ícone, 1617 = início do texto (detectado em find-mark-bounds.js).
  const markHeight = 1483;
  const markCropped = await sharp(rawPng)
    .extract({ left: 0, top: 0, width: info.width, height: markHeight })
    .toBuffer();
  const markBuffer = await sharp(markCropped).trim({ threshold: 5 }).toBuffer();
  await sharp(markBuffer).toFile(OUT_MARK);
  const markMeta = await sharp(markBuffer).metadata();
  console.log("mark saved:", OUT_MARK, markMeta.width, markMeta.height);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
