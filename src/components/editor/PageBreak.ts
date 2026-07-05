import { Node, mergeAttributes } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { EDITOR_PAGE, nextPageContentTop } from "./pageGeometry";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: {
      /** Insert a hard page break (renders in editor + DOCX export). */
      setPageBreak: () => ReturnType;
    };
  }
}

/**
 * PageBreak — an atomic block node that forces a new page.
 * Serializes to <div data-page-break> so the DOCX exporter can emit a real
 * Word page break, and reload can restore it.
 */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      height: {
        default: EDITOR_PAGE.gap + EDITOR_PAGE.padding,
        parseHTML: (el) => {
          const raw = el.getAttribute("data-page-break-height");
          const height = raw ? parseInt(raw, 10) : NaN;
          return Number.isFinite(height) ? height : EDITOR_PAGE.gap + EDITOR_PAGE.padding;
        },
        renderHTML: (attrs) => ({
          "data-page-break-height": String(attrs.height),
          style: `height: ${attrs.height}px;`,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "true",
        class: "page-break-node",
      }),
    ];
  },

  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name, attrs: { height: pageBreakHeightForEditor(this.editor) } },
              { type: "paragraph" },
            ])
            .run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Cmd+Enter (macOS) / Ctrl+Enter (Windows) → new page below.
      "Mod-Enter": () => this.editor.commands.setPageBreak(),
    };
  },
});

function pageBreakHeightForEditor(editor: Editor) {
  const fallback = EDITOR_PAGE.height - EDITOR_PAGE.padding + EDITOR_PAGE.gap;
  const dom = editor.view.dom as HTMLElement;

  try {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    const editorRect = dom.getBoundingClientRect();
    const y = Math.max(EDITOR_PAGE.padding, coords.top - editorRect.top);
    return Math.max(EDITOR_PAGE.gap + EDITOR_PAGE.padding, Math.ceil(nextPageContentTop(y) - y));
  } catch {
    return fallback;
  }
}
