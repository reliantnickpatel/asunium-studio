# Asunium Studio

A production-ready web suite built for the Asunium challenge — **both** challenge tracks in one app:

1. **Rich Text Editor** — headings, bold/italic/underline, alignment, lists, tables (with cell merge + images inside cells), image resize + text-wrap layout, Resume/Invoice/Report templates, multi-page support, and **DOCX export**.
2. **PDF Viewer & Annotator** — text markup (highlight / underline / strikethrough) and shape markup (rectangle, oval, arrow, cloud), all editable (move / resize / recolor / delete), with **undo/redo, keyboard shortcuts, touch pinch-zoom & pan**, and virtualized rendering for large multi-page PDFs.

Plus a real **frontend + backend + database** stack: Next.js API routes persist documents & annotation sets to a database, with an offline-first localStorage fallback so the app works everywhere.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 |
| Rich text | Tiptap v3 (ProseMirror) |
| DOCX export | `docx` |
| PDF rendering | pdf.js (`pdfjs-dist` v6), self-hosted worker |
| State / history | Zustand (custom undo/redo) |
| Backend | Next.js Route Handlers (`/api/documents`) |
| Database | Prisma 6 — SQLite by default, Postgres-ready |

---

## Getting started (local)

```bash
npm install
npm run db:push      # creates the SQLite database (dev.db) + generates the Prisma client
npm run dev          # http://localhost:3000
```

- **Editor:** http://localhost:3000/editor
- **PDF Viewer:** http://localhost:3000/pdf

> `npm install` runs `prisma generate` automatically (postinstall). `npm run db:push` creates the local SQLite file.

---

## Feature checklist

### Rich Text Editor
- [x] Toolbar: headings (H1–H3) + normal text, **bold**, *italic*, <u>underline</u>, ~~strike~~
- [x] Text color + multi-color highlight
- [x] Text alignment (left / center / right / justify)
- [x] Bullet & numbered lists
- [x] Insert & edit tables — add/remove rows & columns, toggle header row
- [x] **Merge / split table cells**
- [x] **Images inside table cells**
- [x] **Image resize** (drag handle) + **left/right/center float layout** (text wraps)
- [x] Templates: Resume · Invoice · Report (+ Blank)
- [x] **Multi-page** support, including explicit page breaks in the DOCX export
- [x] **DOCX export** — headings, styles, alignment, lists, tables (with merges + images), images, page breaks
- [x] Autosave + word count

### PDF Viewer & Annotator
- [x] Open via button or **drag & drop**
- [x] Text markup: highlight, underline, strikethrough
- [x] Shape markup: **rectangle, oval, arrow, cloud**
- [x] Fully editable: select, move, resize (8 handles / endpoint handles), recolor, adjust width, delete
- [x] **Undo / redo** (per-gesture history)
- [x] **Keyboard shortcuts** (see below)
- [x] **Touch**: pinch-zoom + two-finger/hand-tool pan
- [x] **Large-PDF performance**: page virtualization via IntersectionObserver + DPR-capped canvas rendering + render cancellation
- [x] Per-file annotation autosave (restores when the same file is reopened)

### Keyboard shortcuts (PDF)
| Key | Action | Key | Action |
|---|---|---|---|
| `V` | Select/edit | `1` | Highlight |
| `H` | Pan | `2` | Underline |
| `4` | Rectangle | `3` | Strikethrough |
| `5` | Oval | `6` | Arrow |
| `7` | Cloud | `Del` | Delete selected |
| `Ctrl/⌘ Z` | Undo | `Ctrl/⌘ Y` / `⇧Z` | Redo |
| `Ctrl/⌘ ±` | Zoom in/out | | |

---

## Deployment (Vercel)

The app deploys to Vercel out of the box. It runs even **without** a database (the frontend transparently falls back to `localStorage`). To enable server-side persistence with a real database on Vercel (serverless), use Postgres:

1. Provision a Postgres database (e.g. **Vercel Postgres** or **Neon** — both have free tiers).
2. In `prisma/schema.prisma`, change the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. In Vercel → Project → Settings → Environment Variables, add `DATABASE_URL` = your Postgres connection string.
4. Push the schema once: `npx prisma db push` (locally against the same URL, or via a one-off job).
5. Deploy. The build runs `prisma generate` automatically.

> **Self-hosted / "old laptop" option:** keep the default SQLite provider — `npm run build && npm start` gives you a fully persistent database on any Node host.

---

## Architecture notes

- **One deploy, two tools.** Landing page (`/`) links to `/editor` and `/pdf`. All backend logic lives in `/api/documents`.
- **Coordinate model (PDF):** annotations are stored in **normalized 0–1 page coordinates**, so they stay pixel-perfect across any zoom level or device DPR. Stroke widths scale with zoom.
- **Undo/redo:** a snapshot is pushed onto the history stack at the **start of each gesture** (draw/move/resize), so one Ctrl+Z reverts one logical edit rather than every pixel of a drag.
- **DOCX export** parses the editor's HTML (`DOMParser`) and maps it to the `docx` object model — including `columnSpan`/`rowSpan` for merged cells and embedded `ImageRun`s with preserved aspect ratio.
- **Graceful persistence:** every save writes to `localStorage` first (instant), then syncs to the server if the database is reachable; reads prefer the server and fall back to local.

```
src/
  app/
    page.tsx                 landing
    editor/page.tsx          text editor route
    pdf/page.tsx             pdf viewer route
    api/documents/**         REST handlers (list / get / upsert / delete)
  components/
    editor/                  RichEditor, toolbar, resizable image, page break
    pdf/                     viewer, page renderer, annotation layer, store, shapes
  lib/
    editor/exportDocx.ts     HTML → DOCX
    editor/templates.ts      resume / invoice / report
    persistence.ts           localStorage + server sync
    prisma.ts                db client (guarded)
prisma/schema.prisma
public/pdf.worker.min.mjs    self-hosted pdf.js worker
```

---

## How AI was used

This project was built with AI assistance (Claude Code) as a pair-programmer. AI was used to scaffold the Next.js app, write component/boilerplate code, and set up the DOCX/pdf.js integrations. All architecture decisions (normalized-coordinate annotation model, per-gesture undo history, offline-first persistence with graceful DB fallback, virtualization strategy) were directed and reviewed, and the full flow was verified with an automated browser smoke test (editor typing, table insert, DOCX export validity, PDF rendering, annotation drawing, undo) plus a database CRUD test — all passing.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Production server |
| `npm run db:push` | Sync schema → database |
| `npm run db:studio` | Prisma Studio (inspect data) |
