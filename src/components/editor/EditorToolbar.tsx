"use client";

import { type Editor } from "@tiptap/react";
import { useRef, useState, useEffect, type ReactNode } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Highlighter,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Table as TableIcon,
  Image as ImageIcon,
  Link as LinkIcon,
  Undo2,
  Redo2,
  ChevronDown,
  Rows,
  Columns,
  Merge,
  Split,
  Trash2,
  Type,
  SeparatorHorizontal,
} from "lucide-react";

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 min-w-8 items-center justify-center gap-1 rounded px-1.5 text-sm transition
        ${active ? "bg-[#dce6fb] text-[#2853b8]" : "text-slate-600 hover:bg-[#e8ebee] hover:text-slate-900"}
        disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px bg-[#d5d9de]" />;
}

function Dropdown({
  label,
  icon,
  children,
}: {
  label?: string;
  icon: ReactNode;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 items-center gap-1 rounded px-2 text-sm text-slate-600 hover:bg-[#e8ebee] hover:text-slate-900"
      >
        {icon}
        {label && <span>{label}</span>}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="studio-popover absolute left-0 top-9 z-30 min-w-44 rounded-md border border-[#cfd4d9] bg-white p-1 shadow-[0_12px_30px_rgba(20,27,38,0.16)]">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  onClick,
  icon,
  children,
  disabled,
}: {
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-[#eef1f3] disabled:opacity-40"
    >
      {icon}
      {children}
    </button>
  );
}

const HIGHLIGHTS = ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"];
const COLORS = ["#0f172a", "#dc2626", "#2563eb", "#16a34a", "#d97706", "#7c3aed"];

export default function EditorToolbar({ editor }: { editor: Editor }) {
  const imgInput = useRef<HTMLInputElement>(null);
  // subscribe to selection/transaction changes so active states re-render
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  const headingValue = editor.isActive("heading", { level: 1 })
    ? "H1"
    : editor.isActive("heading", { level: 2 })
    ? "H2"
    : editor.isActive("heading", { level: 3 })
    ? "H3"
    : "Normal";

  const onPickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor
        .chain()
        .focus()
        .setImage({ src: reader.result as string })
        .run();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="flex h-12 min-w-max items-center gap-0.5 px-3">
      <Btn title="Undo (Ctrl+Z)" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 size={16} />
      </Btn>
      <Btn title="Redo (Ctrl+Y)" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 size={16} />
      </Btn>
      <Divider />

      {/* Heading / block type */}
      <Dropdown label={headingValue} icon={<Type size={15} />}>
        {(close) => (
          <>
            <MenuItem
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                close();
              }}
            >
              Normal text
            </MenuItem>
            {[1, 2, 3].map((lvl) => (
              <MenuItem
                key={lvl}
                onClick={() => {
                  editor.chain().focus().toggleHeading({ level: lvl as 1 | 2 | 3 }).run();
                  close();
                }}
              >
                <span className={lvl === 1 ? "text-lg font-bold" : lvl === 2 ? "text-base font-bold" : "text-sm font-semibold"}>
                  Heading {lvl}
                </span>
              </MenuItem>
            ))}
          </>
        )}
      </Dropdown>
      <Divider />

      <Btn title="Bold (Ctrl+B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={16} />
      </Btn>
      <Btn title="Italic (Ctrl+I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={16} />
      </Btn>
      <Btn title="Underline (Ctrl+U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline size={16} />
      </Btn>
      <Btn title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={16} />
      </Btn>

      {/* Text color */}
      <Dropdown icon={<span className="font-bold text-slate-700">A</span>}>
        {(close) => (
          <div className="p-1">
            <div className="mb-1 px-1 text-xs font-medium text-slate-400">Text color</div>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-6 w-6 rounded-full border border-slate-200"
                  style={{ background: c }}
                  onClick={() => {
                    editor.chain().focus().setColor(c).run();
                    close();
                  }}
                />
              ))}
            </div>
            <MenuItem
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                close();
              }}
            >
              Reset color
            </MenuItem>
          </div>
        )}
      </Dropdown>

      {/* Highlight */}
      <Dropdown icon={<Highlighter size={16} />}>
        {(close) => (
          <div className="p-1">
            <div className="mb-1 px-1 text-xs font-medium text-slate-400">Highlight</div>
            <div className="flex gap-1.5">
              {HIGHLIGHTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-6 w-6 rounded-full border border-slate-200"
                  style={{ background: c }}
                  onClick={() => {
                    editor.chain().focus().toggleHighlight({ color: c }).run();
                    close();
                  }}
                />
              ))}
            </div>
            <MenuItem
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                close();
              }}
            >
              Remove highlight
            </MenuItem>
          </div>
        )}
      </Dropdown>
      <Divider />

      <Btn title="Align left" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft size={16} />
      </Btn>
      <Btn title="Align center" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter size={16} />
      </Btn>
      <Btn title="Align right" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight size={16} />
      </Btn>
      <Btn title="Justify" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify size={16} />
      </Btn>
      <Divider />

      <Btn title="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List size={16} />
      </Btn>
      <Btn title="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered size={16} />
      </Btn>
      <Divider />

      {/* Table */}
      <Dropdown icon={<TableIcon size={16} />} label="Table">
        {(close) => (
          <>
            <MenuItem
              icon={<TableIcon size={14} />}
              onClick={() => {
                editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
                close();
              }}
            >
              Insert 3×3 table
            </MenuItem>
            {editor.isActive("table") && (
              <>
                <div className="my-1 border-t border-slate-100" />
                <MenuItem icon={<Rows size={14} />} onClick={() => editor.chain().focus().addRowAfter().run()}>
                  Add row below
                </MenuItem>
                <MenuItem icon={<Rows size={14} />} onClick={() => editor.chain().focus().addRowBefore().run()}>
                  Add row above
                </MenuItem>
                <MenuItem icon={<Columns size={14} />} onClick={() => editor.chain().focus().addColumnAfter().run()}>
                  Add column right
                </MenuItem>
                <MenuItem icon={<Columns size={14} />} onClick={() => editor.chain().focus().addColumnBefore().run()}>
                  Add column left
                </MenuItem>
                <div className="my-1 border-t border-slate-100" />
                <MenuItem icon={<Merge size={14} />} onClick={() => editor.chain().focus().mergeCells().run()}>
                  Merge cells
                </MenuItem>
                <MenuItem icon={<Split size={14} />} onClick={() => editor.chain().focus().splitCell().run()}>
                  Split cell
                </MenuItem>
                <MenuItem
                  onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                >
                  Toggle header row
                </MenuItem>
                <div className="my-1 border-t border-slate-100" />
                <MenuItem onClick={() => editor.chain().focus().deleteRow().run()}>
                  Delete row
                </MenuItem>
                <MenuItem onClick={() => editor.chain().focus().deleteColumn().run()}>
                  Delete column
                </MenuItem>
                <MenuItem
                  icon={<Trash2 size={14} />}
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    close();
                  }}
                >
                  Delete table
                </MenuItem>
              </>
            )}
          </>
        )}
      </Dropdown>

      <Btn title="Insert image" onClick={() => imgInput.current?.click()}>
        <ImageIcon size={16} />
      </Btn>
      <input ref={imgInput} type="file" accept="image/*" hidden onChange={onPickImage} />

      <Btn
        title="Insert / edit link"
        active={editor.isActive("link")}
        onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev || "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }}
      >
        <LinkIcon size={16} />
      </Btn>

      <Divider />

      <Btn
        title="Insert page break (new page)"
        onClick={() => editor.chain().focus().setPageBreak().run()}
      >
        <SeparatorHorizontal size={16} />
        <span className="hidden text-xs font-medium sm:inline">Page break</span>
      </Btn>
    </div>
  );
}
