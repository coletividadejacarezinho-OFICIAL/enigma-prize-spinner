/** Reads a picked photo and shrinks it so it fits in the phone's local storage. */
export async function fileToSmallDataUrl(file: File, max = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Imagem inválida"));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Sem suporte a imagem");
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/webp", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
