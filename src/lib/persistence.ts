"use client";

/**
 * Persistence layer with graceful degradation:
 *   - localStorage is ALWAYS written (instant, offline-first)
 *   - if the backend/database is configured, changes also sync to the server
 *   - reads prefer the server, falling back to localStorage
 *
 * This lets the deployed app work with or without a DATABASE_URL.
 */

export type DocKind = "editor" | "pdf";

export type StoredDoc = {
  id: string;
  kind: DocKind;
  title: string;
  /** editor: HTML string · pdf: JSON string of annotation state */
  data: string;
  updatedAt: string;
};

const LS_KEY = "asunium.docs.v1";

function readAll(): StoredDoc[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeAll(docs: StoredDoc[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(docs));
}

function localUpsert(doc: StoredDoc) {
  const all = readAll();
  const i = all.findIndex((d) => d.id === doc.id);
  if (i >= 0) all[i] = doc;
  else all.unshift(doc);
  writeAll(all);
}

let serverOk: boolean | null = null;

async function tryServer<T>(fn: () => Promise<T>): Promise<T | null> {
  if (serverOk === false) return null;
  try {
    const r = await fn();
    serverOk = true;
    return r;
  } catch {
    serverOk = false;
    return null;
  }
}

export async function saveDoc(doc: StoredDoc): Promise<StoredDoc> {
  const withTime = { ...doc, updatedAt: new Date().toISOString() };
  localUpsert(withTime); // always local first

  await tryServer(async () => {
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(withTime),
    });
    if (!res.ok) throw new Error("save failed");
    return res.json();
  });

  return withTime;
}

export async function listDocs(kind: DocKind): Promise<StoredDoc[]> {
  const server = await tryServer(async () => {
    const res = await fetch(`/api/documents?kind=${kind}`);
    if (!res.ok) throw new Error("list failed");
    return (await res.json()) as StoredDoc[];
  });
  if (server) {
    // Merge server list into local cache
    server.forEach(localUpsert);
    return server;
  }
  return readAll()
    .filter((d) => d.kind === kind)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDoc(id: string): Promise<StoredDoc | null> {
  const server = await tryServer(async () => {
    const res = await fetch(`/api/documents/${id}`);
    if (!res.ok) throw new Error("get failed");
    return (await res.json()) as StoredDoc;
  });
  if (server) return server;
  return readAll().find((d) => d.id === id) ?? null;
}

export async function deleteDoc(id: string): Promise<void> {
  writeAll(readAll().filter((d) => d.id !== id));
  await tryServer(async () => {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("delete failed");
    return true;
  });
}
