import { NextRequest, NextResponse } from "next/server";
import { getFirestore } from "../../../firebase/init";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(request: NextRequest) {
  if (request.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { text, timestamp } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided" }, { status: 400 });
    }

    const db = getFirestore();

    const doc = await db.collection("scans").add({
      text: text.trim(),
      created_at: FieldValue.serverTimestamp(),
      timestamp: timestamp || Date.now()
    });

    return NextResponse.json({
      saved: true,
      id: doc.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Save API error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

