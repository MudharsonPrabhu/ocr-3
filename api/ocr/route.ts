import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "../../firebase/init";
import { ZONE_ORDER, type ZoneName } from "../../lib/zones";
import { FieldValue } from "firebase-admin/firestore";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";

interface OcrZoneResult {
  text: string;
  confidence: number;
}

interface OcrResponse {
  ParsedResults?: Array<{
    ParsedText?: string;
    MeanConfidence?: number;
  }>;
  OCRExitCode?: number;
  ErrorMessage?: string | string[];
}

async function callOcrSpace(base64Image: string, engine: number, apiKey: string): Promise<OcrZoneResult> {
  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("OCREngine", engine.toString());
  form.append("scale", "true");
  form.append("isTable", "false");
  form.append("isOverlayRequired", "false");
  form.append("detectOrientation", "true");
  form.append("language", "eng");
  form.append("base64Image", base64Image);

  const res = await fetch(OCR_SPACE_URL, {
    method: "POST",
    body: form
  });

  if (!res.ok) {
    throw new Error(`OCR.Space error (${res.status})`);
  }

  const json = (await res.json()) as OcrResponse;

  const parsedText = json.ParsedResults?.map((p) => p.ParsedText?.trim()).join("\n").trim() ?? "";
  const confidences =
    json.ParsedResults?.map((p) => p.MeanConfidence ?? 0).filter((v) => Number.isFinite(v)) ?? [];
  const confidence =
    confidences.length > 0
      ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length)
      : parsedText
        ? 80
        : 0;

  return { text: parsedText, confidence };
}

async function processZone(
  zoneName: ZoneName,
  base64: string,
  apiKey: string
): Promise<OcrZoneResult> {
  let lastError: unknown = null;

  for (const engine of [2, 1]) {
    try {
      const result = await callOcrSpace(base64, engine, apiKey);
      if (result.text) {
        return result;
      }
      lastError = new Error("Empty OCR text");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("OCR failed");
}

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  const apiKey = process.env.OCR_SPACE_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OCR_SPACE_KEY" }, { status: 500 });
  }

  try {
    const { zones, meta } = await request.json();

    if (!zones || typeof zones !== "object") {
      return NextResponse.json({ error: "No zones provided" }, { status: 400 });
    }

    const db = getFirestore();

    const perZone: Record<ZoneName, OcrZoneResult> = {} as Record<ZoneName, OcrZoneResult>;
    const raw: Record<string, OcrZoneResult> = {};
    const confidenceSamples: number[] = [];

    for (const zone of ZONE_ORDER) {
      if (!zones[zone]) continue;
      try {
        const result = await processZone(zone, zones[zone], apiKey);
        perZone[zone] = result;
        raw[zone] = result;
        if (result.confidence) confidenceSamples.push(result.confidence);
      } catch (error) {
        perZone[zone] = { text: "", confidence: 0 };
        raw[zone] = { text: "", confidence: 0 };
        console.warn(`OCR failed for zone ${zone}`, error);
      }
    }

    const combined = ZONE_ORDER.map((zone) => `[${zone}] ${perZone[zone]?.text ?? ""}`.trim())
      .join("\n")
      .trim();

    const avgConfidence =
      confidenceSamples.length > 0
        ? Math.round(confidenceSamples.reduce((a, b) => a + b, 0) / confidenceSamples.length)
        : 0;

    const doc = await db.collection("scans").add({
      text: combined,
      raw,
      created_at: FieldValue.serverTimestamp(),
      meta: meta ?? {}
    });

    return NextResponse.json({
      saved: true,
      id: doc.id,
      text: combined,
      confidence: avgConfidence,
      timestamp: new Date().toISOString(),
      zones: perZone
    });
  } catch (error) {
    console.error("OCR API error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

