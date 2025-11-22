import type { ZoneName } from "./zones";
import { ZONES } from "./zones";

export interface PreprocessConfig {
  targetWidth: number;
  jpegQuality: number;
  brightnessBoost: number;
  blockSize: number;
}

export type ZonesPayload = Record<ZoneName, string>;

function applyLightingCompensation(
  data: Uint8ClampedArray,
  boost: number
) {
  const gamma = 1.0 - boost * 0.2;
  const invGamma = 1 / Math.max(0.1, gamma);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lum = Math.pow(lum / 255, invGamma) * 255;
    lum = Math.min(255, lum * (1 + boost));
    data[i] = data[i + 1] = data[i + 2] = lum;
  }
}

function applyAdaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  blockSize: number
) {
  const block = Math.max(8, blockSize);

  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      let sum = 0;
      let count = 0;

      for (let y = by; y < Math.min(by + block, height); y++) {
        for (let x = bx; x < Math.min(bx + block, width); x++) {
          const idx = (y * width + x) * 4;
          sum += data[idx];
          count++;
        }
      }

      const mean = sum / Math.max(1, count);
      const threshold = Math.max(110, mean - 12);

      for (let y = by; y < Math.min(by + block, height); y++) {
        for (let x = bx; x < Math.min(bx + block, width); x++) {
          const idx = (y * width + x) * 4;
          const value = data[idx] > threshold ? 255 : 0;
          data[idx] = data[idx + 1] = data[idx + 2] = value;
        }
      }
    }
  }
}

export function extractZones(
  source: HTMLCanvasElement,
  config: PreprocessConfig
): ZonesPayload {
  const payload = {} as ZonesPayload;

  const baseCtx = source.getContext("2d", { willReadFrequently: true });
  if (!baseCtx) {
    throw new Error("Canvas context unavailable");
  }

  const { width: baseWidth, height: baseHeight } = source;

  Object.entries(ZONES).forEach(([key, zone]) => {
    const sx = Math.round(zone.x * baseWidth);
    const sy = Math.round(zone.y * baseHeight);
    const sw = Math.round(zone.w * baseWidth);
    const sh = Math.round(zone.h * baseHeight);

    const temp = document.createElement("canvas");
    const ctx = temp.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const scale = Math.max(1, config.targetWidth / sw);
    temp.width = Math.round(sw * scale);
    temp.height = Math.round(sh * scale);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, temp.width, temp.height);

    const imageData = ctx.getImageData(0, 0, temp.width, temp.height);
    applyLightingCompensation(imageData.data, config.brightnessBoost);
    applyAdaptiveThreshold(
      imageData.data,
      temp.width,
      temp.height,
      config.blockSize
    );
    ctx.putImageData(imageData, 0, 0);

    payload[key as ZoneName] = temp.toDataURL(
      "image/jpeg",
      config.jpegQuality
    );
  });

  return payload;
}

