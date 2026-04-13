/**
 * Décode un QR (contenu copie, ex. CX-…) depuis une photo ou scan.
 * Pensé pour ne pas bloquer ni faire crasher l’onglet : image redimensionnée,
 * peu de variantes, pauses sur la file d’attente du navigateur.
 */

import type { DecodeHintType } from "@zxing/library";

/** Côté max de l’image de travail (évite OOM / gel sur photos 12–48 Mpx). */
const WORK_BITMAP_MAX_SIDE = 2200;
/** Côté max d’un extrait avant zooms supplémentaires. */
const CROP_DECODE_MAX_SIDE = 960;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function toGrayscale(src: ImageData): ImageData {
  const d = new Uint8ClampedArray(src.data.length);
  for (let i = 0; i < src.data.length; i += 4) {
    const y = 0.299 * src.data[i]! + 0.587 * src.data[i + 1]! + 0.114 * src.data[i + 2]!;
    d[i] = d[i + 1] = d[i + 2] = y;
    d[i + 3] = 255;
  }
  return new ImageData(d, src.width, src.height);
}

function binarizeMean(gray: ImageData): ImageData {
  let sum = 0;
  const n = gray.width * gray.height;
  for (let i = 0; i < gray.data.length; i += 4) sum += gray.data[i]!;
  const t = sum / Math.max(1, n);
  const d = new Uint8ClampedArray(gray.data.length);
  for (let i = 0; i < gray.data.length; i += 4) {
    const v = gray.data[i]! > t ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  return new ImageData(d, gray.width, gray.height);
}

function scaleNearest(src: ImageData, factor: number): ImageData {
  const w = Math.max(2, Math.floor(src.width * factor));
  const h = Math.max(2, Math.floor(src.height * factor));
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor(x / factor));
      const sy = Math.min(src.height - 1, Math.floor(y / factor));
      const si = (sy * src.width + sx) * 4;
      const oi = (y * w + x) * 4;
      d[oi] = src.data[si]!;
      d[oi + 1] = src.data[si + 1]!;
      d[oi + 2] = src.data[si + 2]!;
      d[oi + 3] = 255;
    }
  }
  return new ImageData(d, w, h);
}

function destSizeForMaxSide(sw: number, sh: number, maxSide: number) {
  const m = Math.max(sw, sh);
  if (m <= maxSide) return { w: sw, h: sh };
  const s = maxSide / m;
  return { w: Math.max(2, Math.floor(sw * s)), h: Math.max(2, Math.floor(sh * s)) };
}

function getRegionFromBitmap(
  bitmap: ImageBitmap,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  destW: number,
  destH: number,
): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = destW;
  canvas.height = destH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = destW >= sw && destH >= sh;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, destW, destH);
  return ctx.getImageData(0, 0, destW, destH);
}

function drawFullBitmap(bitmap: ImageBitmap, maxSide: number): ImageData | null {
  const W = bitmap.width;
  const H = bitmap.height;
  const s = Math.min(1, maxSide / Math.max(W, H));
  const w = Math.max(1, Math.floor(W * s));
  const h = Math.max(1, Math.floor(H * s));
  return getRegionFromBitmap(bitmap, 0, 0, W, H, w, h);
}

function rotateImageData(src: ImageData, deg: number): ImageData | null {
  const tmp = document.createElement("canvas");
  tmp.width = src.width;
  tmp.height = src.height;
  const tctx = tmp.getContext("2d");
  if (!tctx) return null;
  tctx.putImageData(src, 0, 0);

  const rad = (deg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const nw = Math.floor(src.width * cos + src.height * sin);
  const nh = Math.floor(src.width * sin + src.height * cos);
  const c = document.createElement("canvas");
  c.width = Math.max(2, nw);
  c.height = Math.max(2, nh);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(tmp, -src.width / 2, -src.height / 2);
  return ctx.getImageData(0, 0, c.width, c.height);
}

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: string },
) => { data: string } | null;

function tryJsqr(data: Uint8ClampedArray, width: number, height: number, jsQR: JsQrFn): string | null {
  const r = jsQR(data, width, height, { inversionAttempts: "attemptBoth" });
  return r?.data ?? null;
}

function imageDataToCanvas(img: ImageData): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2d");
  ctx.putImageData(img, 0, 0);
  return c;
}

function tryZxing(
  img: ImageData,
  reader: import("@zxing/browser").BrowserQRCodeReader,
): string | null {
  try {
    const canvas = imageDataToCanvas(img);
    return reader.decodeFromCanvas(canvas).getText() || null;
  } catch {
    return null;
  }
}

function tryDecodeImageData(
  img: ImageData,
  jsQR: JsQrFn,
  zxReader: import("@zxing/browser").BrowserQRCodeReader,
): string | null {
  const z = tryZxing(img, zxReader);
  if (z) return z;
  return tryJsqr(img.data, img.width, img.height, jsQR);
}

function quickVariants(base: ImageData): ImageData[] {
  const g = toGrayscale(base);
  return [base, g, binarizeMean(g)];
}

/** Peu de variantes lourdes (évite explosion mémoire / CPU). */
function extraVariants(base: ImageData): ImageData[] {
  const g = toGrayscale(base);
  const b = binarizeMean(g);
  const out: ImageData[] = [scaleNearest(g, 2), scaleNearest(b, 2)];
  const m = Math.max(base.width, base.height);
  if (m < 500) {
    out.push(scaleNearest(g, 2.5));
  }
  return out.filter((im) => Math.max(im.width, im.height) <= 1800);
}

function collectVariantsLightFull(base: ImageData): ImageData[] {
  const g = toGrayscale(base);
  const b = binarizeMean(g);
  const out: ImageData[] = [base, g, b];
  const m = Math.max(base.width, base.height);
  if (m < 900) {
    out.push(scaleNearest(g, 2));
    out.push(scaleNearest(b, 2));
  } else if (m > 1400) {
    out.push(scaleNearest(g, 0.7));
    out.push(scaleNearest(b, 0.7));
  }
  return out;
}

/** Recadrages relatifs (0–1), pages centrées avec bandes noires. */
const CROP_SPECS: { x0: number; y0: number; x1: number; y1: number }[] = [
  { x0: 0, y0: 0.44, x1: 1, y1: 1 },
  { x0: 0, y0: 0.48, x1: 1, y1: 1 },
  { x0: 0, y0: 0.5, x1: 1, y1: 1 },
  { x0: 0.35, y0: 0.4, x1: 1, y1: 1 },
  { x0: 0.4, y0: 0.42, x1: 1, y1: 1 },
  { x0: 0.5, y0: 0.5, x1: 1, y1: 1 },
  { x0: 0.22, y0: 0.45, x1: 1, y1: 1 },
];

function specToPixels(
  W: number,
  H: number,
  s: { x0: number; y0: number; x1: number; y1: number },
) {
  const cx = Math.max(0, Math.floor(s.x0 * W));
  const cy = Math.max(0, Math.floor(s.y0 * H));
  const x1p = Math.min(W, Math.ceil(s.x1 * W));
  const y1p = Math.min(H, Math.ceil(s.y1 * H));
  return { cx, cy, cw: Math.max(2, x1p - cx), ch: Math.max(2, y1p - cy) };
}

async function openWorkBitmap(file: File): Promise<ImageBitmap> {
  const temp = await createImageBitmap(file);
  const scale = Math.min(1, WORK_BITMAP_MAX_SIDE / Math.max(temp.width, temp.height));
  if (scale >= 1) return temp;
  const w = Math.max(1, Math.floor(temp.width * scale));
  const h = Math.max(1, Math.floor(temp.height * scale));
  const resized = await createImageBitmap(temp, {
    resizeWidth: w,
    resizeHeight: h,
    resizeQuality: "high",
  });
  temp.close();
  return resized;
}

/**
 * Retourne le texte du premier QR décodé, ou null.
 */
export async function decodeQrFromImageFile(file: File): Promise<string | null> {
  const bitmap = await openWorkBitmap(file);
  try {
    const [{ default: jsQR }, { BrowserQRCodeReader }, { DecodeHintType: DHT }] = await Promise.all([
      import("jsqr"),
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map<DecodeHintType, unknown>();
    hints.set(DHT.TRY_HARDER, true);
    const zxReader = new BrowserQRCodeReader(hints);
    const js = jsQR as JsQrFn;

    let steps = 0;
    const tryOne = async (img: ImageData): Promise<string | null> => {
      steps += 1;
      if (steps % 5 === 0) await yieldToMain();
      return tryDecodeImageData(img, js, zxReader);
    };

    const tryList = async (list: ImageData[]): Promise<string | null> => {
      for (const img of list) {
        const hit = await tryOne(img);
        if (hit) return hit;
      }
      return null;
    };

    const W = bitmap.width;
    const H = bitmap.height;

    for (const spec of CROP_SPECS) {
      await yieldToMain();
      const { cx, cy, cw, ch } = specToPixels(W, H, spec);
      const { w, h } = destSizeForMaxSide(cw, ch, CROP_DECODE_MAX_SIDE);
      const crop = getRegionFromBitmap(bitmap, cx, cy, cw, ch, w, h);
      if (!crop) continue;
      const hit = await tryList(quickVariants(crop));
      if (hit) return hit;
    }

    for (let i = 0; i < 4; i += 1) {
      await yieldToMain();
      const spec = CROP_SPECS[i]!;
      const { cx, cy, cw, ch } = specToPixels(W, H, spec);
      const { w, h } = destSizeForMaxSide(cw, ch, CROP_DECODE_MAX_SIDE);
      const crop = getRegionFromBitmap(bitmap, cx, cy, cw, ch, w, h);
      if (!crop) continue;

      const hit = await tryList(extraVariants(crop));
      if (hit) return hit;

      const g2 = scaleNearest(toGrayscale(crop), 2);
      if (Math.max(g2.width, g2.height) <= 1600) {
        for (const deg of [-10, 10]) {
          await yieldToMain();
          const rot = rotateImageData(g2, deg);
          if (rot) {
            const h2 = await tryOne(rot);
            if (h2) return h2;
          }
        }
      }
    }

    await yieldToMain();
    const full = drawFullBitmap(bitmap, 1600);
    if (full) {
      const hit = await tryList(collectVariantsLightFull(full));
      if (hit) return hit;
    }

    return null;
  } finally {
    bitmap.close();
  }
}

/** Taille utile du QR sur le PDF (mm) et résolution PNG embarquée (px) — à garder alignées entre générations. */
export const PDF_QR_SIZE_MM = 22;
export const PDF_QR_PNG_WIDTH_PX = 240;
