// Turn any picture into a sepia pencil sketch on aged paper. Ported from the
// Bruma Joint Archives' wanted-poster portrait filter (src/ui/sketch.ts), so a
// sketch made here at Standard size looks like one made at the Lectern.
//
// The drawing is the classic pencil-sketch blend: the grey image is divided by
// a blurred negative of itself ("colour dodge"), which leaves flat areas paper
// white and draws dark lines where the tone changes. Edges found by a Sobel
// pass are pressed in harder, then the result is inked in sepia on paper, with
// grain, and fades out towards the margins as a sketch on a sheet does.
// Plain pixel loops rather than canvas filters, so it looks the same everywhere.

/** The archive draws the poster frame (10:11) at 450×495; the radii below are tuned to that size. */
const BASE_W = 450;
const BASE_H = 495;

const INK = [58, 44, 28];
const PAPER = [233, 220, 188];

export const FORMATS = {
  png: { mime: 'image/png', ext: 'png', label: 'PNG image' },
  jpeg: { mime: 'image/jpeg', ext: 'jpg', label: 'JPEG image', quality: 0.92 },
  webp: { mime: 'image/webp', ext: 'webp', label: 'WebP image', quality: 0.9 },
};

/** A separable box blur, run three times to approach a Gaussian. */
function blur(src, w, h, r) {
  const a = Float32Array.from(src);
  const b = new Float32Array(a.length);
  const pass = (from, to, horizontal) => {
    const len = horizontal ? w : h;
    const lines = horizontal ? h : w;
    for (let line = 0; line < lines; line++) {
      const at = (i) => (horizontal ? line * w + i : i * w + line);
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += from[at(Math.min(len - 1, Math.max(0, i)))];
      for (let i = 0; i < len; i++) {
        to[at(i)] = sum / (2 * r + 1);
        sum += from[at(Math.min(len - 1, i + r + 1))] - from[at(Math.max(0, i - r))];
      }
    }
  };
  for (let k = 0; k < 3; k++) {
    pass(a, b, true);
    pass(b, a, false);
  }
  return a;
}

/**
 * The filter. `k` is the drawing's size relative to the archive's poster: at 1
 * this is the archive's filter exactly; larger sheets widen the blurs and
 * strengthen the edges in proportion, so the strokes keep the same weight.
 */
function draw(img, k) {
  const { width: w, height: h, data } = img;
  const n = w * h;
  const grey = new Float32Array(n);
  for (let i = 0; i < n; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];

  // Pencil: colour-dodge the grey with its blurred negative.
  const negative = new Float32Array(n);
  for (let i = 0; i < n; i++) negative[i] = 255 - grey[i];
  const soft = blur(negative, w, h, Math.max(1, Math.round(5 * k)));
  // Edges, on a lightly smoothed image so they follow form rather than noise.
  const smooth = blur(grey, w, h, Math.max(1, Math.round(k)));

  const out = new ImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let tone = Math.min(255, (grey[i] * 255) / Math.max(1, 255 - soft[i]));

      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const s = (dx, dy) => smooth[(y + dy) * w + (x + dx)];
        const gx = -s(-1, -1) - 2 * s(-1, 0) - s(-1, 1) + s(1, -1) + 2 * s(1, 0) + s(1, 1);
        const gy = -s(-1, -1) - 2 * s(0, -1) - s(1, -1) + s(-1, 1) + 2 * s(0, 1) + s(1, 1);
        tone -= Math.min(120, Math.hypot(gx, gy) * 0.42 * k);
      }
      // Shading: keep a little of the original's darks, so it is drawn, not traced.
      tone = tone * 0.82 + grey[i] * 0.18;
      // Levels: deepen the strokes, clear the paper.
      tone = Math.min(255, Math.max(0, (tone - 35) * 1.3));

      // Fade to bare paper towards the edges of the sheet.
      const ex = Math.min(x, w - 1 - x) / (w * 0.12);
      const ey = Math.min(y, h - 1 - y) / (h * 0.1);
      const margin = Math.min(1, ex, ey);
      const t = 1 - (1 - tone / 255) * margin * margin;

      const grain = (Math.random() - 0.5) * 14;
      for (let c = 0; c < 3; c++) {
        out.data[i * 4 + c] = Math.min(255, Math.max(0, INK[c] + (PAPER[c] - INK[c]) * t + grain));
      }
      out.data[i * 4 + 3] = 255;
    }
  }
  return out;
}

/**
 * Where to cut the picture and how big to draw it. "poster" crops to the
 * archive's 10:11 frame, taking extra height mostly from the bottom since a
 * face usually sits high; "whole" keeps the picture's shape at the same
 * number of pixels as the poster, so `k` means the same in both.
 */
function layout(width, height, frame, k) {
  if (frame === 'whole') {
    const area = BASE_W * BASE_H * k * k;
    const ratio = width / height;
    return {
      sx: 0, sy: 0, sw: width, sh: height,
      outW: Math.max(1, Math.round(Math.sqrt(area * ratio))),
      outH: Math.max(1, Math.round(Math.sqrt(area / ratio))),
    };
  }
  const want = BASE_W / BASE_H;
  let sw = width;
  let sh = height;
  let sx = 0;
  let sy = 0;
  if (sw / sh > want) {
    sw = sh * want;
    sx = (width - sw) / 2;
  } else {
    sh = sw / want;
    sy = (height - sh) * 0.25;
  }
  return { sx, sy, sw, sh, outW: Math.round(BASE_W * k), outH: Math.round(BASE_H * k) };
}

/** Sketch a picture (a File or Blob) onto a new canvas. */
export async function sketch(file, { frame = 'poster', scale = 1 } = {}) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This picture could not be opened.');
  }
  const { sx, sy, sw, sh, outW, outH } = layout(bitmap.width, bitmap.height, frame, scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  // Paper under the picture, so a transparent one is drawn on paper, not on black.
  ctx.fillStyle = `rgb(${PAPER.join(',')})`;
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);
  bitmap.close();
  ctx.putImageData(draw(ctx.getImageData(0, 0, outW, outH), scale), 0, 0);
  return canvas;
}

/** The canvas as an image file in one of FORMATS. */
export function encode(canvas, format) {
  const { mime, quality } = FORMATS[format];
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('The sketch could not be saved.'))), mime, quality),
  );
}
