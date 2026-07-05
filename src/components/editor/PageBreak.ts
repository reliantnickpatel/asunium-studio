import { Node, mergeAttributes } from "@tiptap/core";

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
          chain().insertContent({ type: this.name }).run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      // Cmd+Enter (macOS) / Ctrl+Enter (Windows) → new page below.
      "Mod-Enter": () => this.editor.commands.setPageBreak(),
    };
  },
});
