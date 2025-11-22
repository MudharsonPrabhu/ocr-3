export interface DiffConfig {
  threshold: number;
  sampleStep?: number;
}

export interface DiffResult {
  diff: number;
  snapshot: Uint8ClampedArray;
}

export function computeFrameDiff(
  current: ImageData,
  previous: Uint8ClampedArray | null,
  { threshold, sampleStep = 8 }: DiffConfig
): DiffResult {
  const buffer = current.data.slice(0);

  if (!previous) {
    return { diff: 0, snapshot: buffer };
  }

  let diff = 0;
  const data = current.data;

  for (let i = 0; i < data.length; i += sampleStep) {
    const b1 = (data[i] + data[i + 1] + data[i + 2]) / 3;
    const b2 = (previous[i] + previous[i + 1] + previous[i + 2]) / 3;
    diff += Math.abs(b1 - b2);
    if (diff > threshold) {
      break;
    }
  }

  return { diff, snapshot: buffer };
}

