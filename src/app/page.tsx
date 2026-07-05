import Link from "next/link";
import {
  FileText,
  PenLine,
  Table,
  Image as ImageIcon,
  Highlighter,
  Square,
  Undo2,
  Download,
} from "lucide-react";

export default function Home() {
  return (
    <main className="flex-1">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <span className="text-lg font-bold tracking-tight">
            Asunium<span className="text-blue-600"> Studio</span>
          </span>
          <nav className="flex items-center gap-2 text-sm font-medium">
            <Link
              href="/editor"
              className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              Editor
            </Link>
            <Link
              href="/pdf"
              className="rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              PDF Viewer
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-12 text-center">
        <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
          Frontend + Backend + Database · Production ready
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-extrabold tracking-tight text-slate-900">
          Two powerful tools.
          <span className="block text-blue-600">One clean studio.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Annotate large PDFs with shapes and text markup, or craft rich
          documents with tables, images and one-click DOCX export.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/editor"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
          >
            <PenLine size={18} /> Open Text Editor
          </Link>
          <Link
            href="/pdf"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <FileText size={18} /> Open PDF Viewer
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-12 md:grid-cols-2">
        <FeatureCard
          href="/editor"
          accent="from-violet-500 to-blue-500"
          icon={<PenLine className="text-white" size={22} />}
          title="Rich Text Editor"
          points={[
            { icon: <Table size={15} />, label: "Tables with cell merge & images" },
            { icon: <ImageIcon size={15} />, label: "Image resize + text wrap layout" },
            { icon: <Download size={15} />, label: "Multi-page DOCX export" },
            { icon: <FileText size={15} />, label: "Resume · Invoice · Report templates" },
          ]}
        />
        <FeatureCard
          href="/pdf"
          accent="from-blue-500 to-cyan-500"
          icon={<FileText className="text-white" size={22} />}
          title="PDF Viewer & Annotator"
          points={[
            { icon: <Highlighter size={15} />, label: "Highlight, underline, strikethrough" },
            { icon: <Square size={15} />, label: "Rectangle · Oval · Arrow · Cloud" },
            { icon: <Undo2 size={15} />, label: "Undo/redo + keyboard shortcuts" },
            { icon: <ImageIcon size={15} />, label: "Touch pinch-zoom & pan, big-PDF fast" },
          ]}
        />
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        Built for the Asunium challenge · Next.js · TypeScript · Tiptap · pdf.js
      </footer>
    </main>
  );
}

function FeatureCard({
  href,
  title,
  icon,
  accent,
  points,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  accent: string;
  points: { icon: React.ReactNode; label: string }[];
}) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
      >
        {icon}
      </div>
      <h3 className="mt-5 text-xl font-bold text-slate-900">{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {points.map((p, i) => (
          <li key={i} className="flex items-center gap-2.5 text-sm text-slate-600">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-slate-500">
              {p.icon}
            </span>
            {p.label}
          </li>
        ))}
      </ul>
      <span className="mt-6 inline-block text-sm font-semibold text-blue-600 group-hover:underline">
        Open tool →
      </span>
    </Link>
  );
}
