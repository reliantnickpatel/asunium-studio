"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// pdf.js relies on browser APIs + a web worker, so load it client-side only.
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center text-slate-400">
      <Loader2 className="animate-spin" /> &nbsp;Loading viewer…
    </div>
  ),
});

export default function PdfViewerClient() {
  return <PdfViewer />;
}
