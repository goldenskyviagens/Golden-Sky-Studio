// Carrega uma imagem (logo, foto de destino etc.) como HTMLImageElement pronta
// para desenhar em canvas. Usado pelo export PNG de qualquer módulo.
const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  let cached = cache.get(src);
  if (!cached) {
    cached = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Não consegui carregar a imagem: ${src}`));
      img.src = src;
    });
    cache.set(src, cached);
  }
  return cached;
}
