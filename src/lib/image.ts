/** Browser-only helpers for preparing photos before sending them to the AI. */

const MAX_EDGE = 1600;
const QUALITY = 0.75;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error ?? new Error("Could not read that file"));
    r.readAsDataURL(file);
  });
}

/**
 * Downscale + JPEG-compress a photo so the data URL stays small enough for the
 * server function body limit (full-size phone photos are several MB of base64
 * and the request fails before it ever reaches the model).
 */
export async function compressImageToDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  const raw = await readAsDataUrl(file);

  try {
    const img = await loadImage(raw);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return raw;
    ctx.drawImage(img, 0, 0, w, h);
    let out = canvas.toDataURL("image/jpeg", QUALITY);
    // Very dense photos can still be large; step the quality down once.
    if (out.length > 3_500_000) out = canvas.toDataURL("image/jpeg", 0.5);
    return out.startsWith("data:image/") ? out : raw;
  } catch {
    return raw;
  }
}
