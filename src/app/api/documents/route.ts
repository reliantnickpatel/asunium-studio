import { NextResponse } from "next/server";
import { prisma, dbConfigured } from "@/lib/prisma";

// Never statically cache — always reflect DB state.
export const dynamic = "force-dynamic";

/** GET /api/documents?kind=editor|pdf  → list documents (metadata + data). */
export async function GET(req: Request) {
  if (!dbConfigured) {
    // Signal the client to use its localStorage fallback.
    return NextResponse.json({ error: "database not configured" }, { status: 503 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const kind = searchParams.get("kind") ?? undefined;
    const docs = await prisma.document.findMany({
      where: kind ? { kind } : undefined,
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(
      docs.map((d) => ({
        id: d.id,
        kind: d.kind,
        title: d.title,
        data: d.data,
        updatedAt: d.updatedAt.toISOString(),
      }))
    );
  } catch (e) {
    console.error("GET /api/documents failed:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
