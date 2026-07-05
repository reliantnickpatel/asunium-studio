"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AsuniumLogo from "@/components/AsuniumLogo";
import { listDocs, type StoredDoc } from "@/lib/persistence";
import { hasCachedPdf } from "@/lib/pdf/fileCache";
import {
  ArrowUpRight,
  Clock3,
  FilePenLine,
  Files,
  FolderOpen,
  Home as HomeIcon,
  LayoutGrid,
  ScanText,
  Settings,
  ShieldCheck,
} from "lucide-react";

const tools = [
  {
    href: "/editor",
    icon: FilePenLine,
    title: "Document editor",
    description: "Write, format, paginate, and export Word documents.",
    action: "New document",
    accent: "#3867d6",
    preview: "document" as const,
  },
  {
    href: "/pdf",
    icon: ScanText,
    title: "PDF studio",
    description: "Review large drawings, annotate precisely, and export.",
    action: "Open PDF studio",
    accent: "#d8594f",
    preview: "pdf" as const,
  },
];

export default function Home() {
  const [recent, setRecent] = useState<StoredDoc[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listDocs("editor"), listDocs("pdf")]).then(async ([editorDocs, pdfDocs]) => {
      const cachedPdfIds = new Set(
        (
          await Promise.all(
            pdfDocs.map(async (doc) => ((await hasCachedPdf(doc.id)) ? doc.id : null))
          )
        ).filter((id): id is string => id !== null)
      );
      if (cancelled) return;
      setRecent(
        [...editorDocs, ...pdfDocs.filter((doc) => cachedPdfIds.has(doc.id))]
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 6)
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="studio-home-dark min-h-screen text-[#e9edf2]">
      <aside className="studio-sidebar-in fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/10 bg-[#07080a] text-slate-300 md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-5">
          <AsuniumLogo size={36} showWordmark markClassName="bg-[#252525]" />
        </div>

        <nav className="space-y-1 px-3 py-4 text-sm">
          <Link href="/" className="flex h-10 items-center gap-3 rounded-md bg-white/10 px-3 font-medium text-white">
            <HomeIcon size={17} /> Workspace
          </Link>
          <Link href="/editor" className="flex h-10 items-center gap-3 rounded-md px-3 hover:bg-white/5 hover:text-white">
            <FilePenLine size={17} /> Documents
          </Link>
          <Link href="/pdf" className="flex h-10 items-center gap-3 rounded-md px-3 hover:bg-white/5 hover:text-white">
            <ScanText size={17} /> PDF studio
          </Link>
        </nav>

        <div className="mt-auto border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-slate-400">
            <ShieldCheck size={16} className="text-emerald-400" />
            <span>Files stay in your workspace</span>
          </div>
          <button className="mt-1 flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm hover:bg-white/5 hover:text-white">
            <Settings size={16} /> Settings
          </button>
        </div>
      </aside>

      <section className="min-h-screen md:pl-60">
        <header className="studio-appbar flex h-16 items-center justify-between border-b border-white/10 bg-[#0d0f13] px-5 md:px-8">
          <div className="flex items-center gap-3 md:hidden">
            <AsuniumLogo size={34} />
            <span className="text-sm font-semibold">Asunium Studio</span>
          </div>
          <div className="hidden items-center gap-2 text-sm text-[#8e96a2] md:flex">
            <LayoutGrid size={16} /> Workspace
          </div>
          <div className="flex items-center gap-2 text-xs text-[#8e96a2]">
            <span className="studio-status-dot h-2 w-2 rounded-full bg-emerald-500" /> Local autosave active
          </div>
        </header>

        <div className="studio-content-in mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <p className="text-xs font-semibold uppercase text-[#747d89]">Your workspace</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">What are you working on?</h1>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/pdf" className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-[#171a20] px-4 text-sm font-medium text-[#dce1e7] hover:bg-[#20242b]">
                <FolderOpen size={16} /> Open PDF
              </Link>
              <Link href="/editor" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#3867d6] px-4 text-sm font-medium text-white hover:bg-[#2f58bd]">
                <FilePenLine size={16} /> New document
              </Link>
            </div>
          </div>

          <section className="grid gap-4 py-7 lg:grid-cols-2">
            {tools.map((tool, index) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="studio-tool-card group grid min-h-[300px] overflow-hidden rounded-lg border border-t-2 border-white/10 bg-[#111318] shadow-[0_1px_2px_rgba(0,0,0,0.25)] transition duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#14171d] hover:shadow-[0_18px_45px_rgba(0,0,0,0.42)] sm:grid-cols-[1fr_44%]"
                  style={{ borderTopColor: tool.accent, animationDelay: `${180 + index * 110}ms` }}
                >
                  <div className="flex flex-col p-6">
                    <span className="studio-tool-icon flex h-10 w-10 items-center justify-center rounded-md text-white" style={{ backgroundColor: tool.accent }}>
                      <Icon size={20} />
                    </span>
                    <h2 className="mt-5 text-xl font-semibold text-white">{tool.title}</h2>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-[#9098a4]">{tool.description}</p>
                    <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold" style={{ color: tool.accent }}>
                      {tool.action} <ArrowUpRight size={16} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
                  <div className="relative hidden overflow-hidden border-l border-white/10 bg-[#090b0f] p-6 sm:block">
                    {tool.preview === "document" ? <DocumentPreview /> : <PdfPreview />}
                  </div>
                </Link>
              );
            })}
          </section>

          <section className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold"><Clock3 size={16} /> Recent work</div>
              <span className="text-xs text-[#747d89]">Stored locally</span>
            </div>
            {recent === null ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((item) => <div key={item} className="h-24 animate-pulse rounded-lg border border-white/10 bg-white/[0.035]" />)}
              </div>
            ) : recent.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {recent.map((doc, index) => {
                  const DocIcon = doc.kind === "editor" ? FilePenLine : ScanText;
                  return (
                    <Link
                      key={doc.id}
                      href={`${doc.kind === "editor" ? "/editor" : "/pdf"}?doc=${encodeURIComponent(doc.id)}`}
                      className="studio-menu-item-in group flex min-w-0 items-center gap-3 rounded-lg border border-white/10 bg-[#111318] p-4 transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-[#171a20]"
                      style={{ animationDelay: `${index * 55}ms` }}
                    >
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${doc.kind === "editor" ? "bg-[#3867d6]" : "bg-[#d8594f]"}`}><DocIcon size={18} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white">{doc.title || "Untitled"}</span>
                        <span className="mt-1 block text-xs text-[#747d89]">{doc.kind === "editor" ? "Document" : "PDF annotations"} · {new Date(doc.updatedAt).toLocaleDateString()}</span>
                      </span>
                      <ArrowUpRight size={15} className="shrink-0 text-[#59616d] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 flex min-h-24 items-center gap-4 rounded-lg border border-dashed border-white/15 bg-[#0f1116] px-5 text-sm text-[#747d89]">
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-[#171a20]"><Files size={17} /></span>
                Save a document or PDF annotation and it will appear here.
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function DocumentPreview() {
  return (
    <div className="studio-document-sheet absolute left-6 top-7 h-[270px] w-[190px] border border-[#d8dce1] bg-white p-6 shadow-[0_14px_30px_rgba(20,27,38,0.13)]">
      <div className="h-3 w-20 bg-[#252a32]" />
      <div className="mt-3 h-1.5 w-28 bg-[#c7ccd2]" />
      <div className="mt-7 h-2 w-16 bg-[#3867d6]" />
      <div className="mt-3 space-y-2">
        <div className="h-1.5 w-full bg-[#dde1e5]" /><div className="h-1.5 w-full bg-[#dde1e5]" /><div className="h-1.5 w-4/5 bg-[#dde1e5]" />
      </div>
      <div className="mt-6 h-2 w-20 bg-[#252a32]" />
      <div className="mt-3 space-y-2">
        <div className="h-1.5 w-full bg-[#dde1e5]" /><div className="h-1.5 w-11/12 bg-[#dde1e5]" /><div className="h-1.5 w-3/4 bg-[#dde1e5]" />
      </div>
    </div>
  );
}

function PdfPreview() {
  return (
    <div className="studio-pdf-sheet absolute left-6 top-7 h-[270px] w-[200px] border border-[#d8dce1] bg-white p-5 shadow-[0_14px_30px_rgba(20,27,38,0.13)]">
      <div className="flex items-center justify-between border-b border-[#d8dce1] pb-3"><div className="h-2 w-20 bg-[#252a32]" /><div className="h-5 w-5 rounded-full border-2 border-[#d8594f]" /></div>
      <div className="relative mt-4 h-40 overflow-hidden border border-[#d8dce1] bg-[#f7f8f9]">
        <div className="studio-scan-line absolute inset-x-0 top-0 z-10 h-px bg-[#d8594f] shadow-[0_0_8px_#d8594f]" />
        <div className="absolute left-3 top-4 h-px w-28 rotate-12 bg-[#8e969f]" /><div className="absolute left-8 top-12 h-px w-24 -rotate-12 bg-[#8e969f]" />
        <div className="absolute bottom-5 left-4 h-16 w-28 border border-[#8e969f]" /><div className="absolute bottom-8 left-8 h-8 w-16 border-2 border-[#d8594f]" />
      </div>
      <div className="mt-4 flex gap-2"><span className="h-2 w-12 bg-[#c7ccd2]" /><span className="h-2 w-8 bg-[#d8594f]" /></div>
    </div>
  );
}
