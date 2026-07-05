import { NextResponse } from "next/server";
import { prisma, dbConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function unavailable() {
  return NextResponse.json({ error: "database not configured" }, { status: 503 });
}

/** GET a single document. */
export async function GET(_req: Request, { params }: Ctx) {
  if (!dbConfigured) return unavailable();
  const { id } = await params;
  try {
    const d = await prisma.document.findUnique({ where: { id } });
    // Return 200 null (not 404) so the client can quietly fall back without
    // logging a benign network error for documents that simply don't exist yet.
    if (!d) return NextResponse.json(null);
    return NextResponse.json({
      id: d.id,
      kind: d.kind,
      title: d.title,
      data: d.data,
      updatedAt: d.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("GET /api/documents/[id] failed:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/** PUT upserts a document (create or update). */
export async function PUT(req: Request, { params }: Ctx) {
  if (!dbConfigured) return unavailable();
  const { id } = await params;
  try {
    const body = await req.json();
    const kind = String(body.kind ?? "editor");
    const title = String(body.title ?? "Untitled");
    const data = String(body.data ?? "");

    const doc = await prisma.document.upsert({
      where: { id },
      create: { id, kind, title, data },
      update: { kind, title, data },
    });
    return NextResponse.json({
      id: doc.id,
      kind: doc.kind,
      title: doc.title,
      data: doc.data,
      updatedAt: doc.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error("PUT /api/documents/[id] failed:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}

/** DELETE a document. */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!dbConfigured) return unavailable();
  const { id } = await params;
  try {
    await prisma.document.deleteMany({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/documents/[id] failed:", e);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}
