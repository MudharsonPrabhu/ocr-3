import { NextResponse } from "next/server";
import { getFirestore } from "../../firebase/init";

const LIMIT = 20;

export async function GET() {
  try {
    const db = getFirestore();
    const snapshots = await db
      .collection("scans")
      .orderBy("created_at", "desc")
      .limit(LIMIT)
      .get();

    const items = snapshots.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        text: data.text ?? "",
        timestamp: data.created_at?.toDate?.().toISOString?.() ?? null
      };
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("History API error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500 }
    );
  }
}

