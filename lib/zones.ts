export type ZoneName = "seq_no" | "body_no" | "suffix" | "tube_assy";

export type ZoneConfig = Record<ZoneName, { x: number; y: number; w: number; h: number }>;

export const ZONES: ZoneConfig = {
  seq_no: { x: 0.1, y: 0.05, w: 0.25, h: 0.07 },
  body_no: { x: 0.1, y: 0.13, w: 0.25, h: 0.07 },
  suffix: { x: 0.1, y: 0.21, w: 0.25, h: 0.07 },
  tube_assy: { x: 0.1, y: 0.3, w: 0.75, h: 0.35 }
};

export const ZONE_ORDER: ZoneName[] = ["seq_no", "body_no", "suffix", "tube_assy"];

