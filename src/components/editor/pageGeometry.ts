export const EDITOR_PAGE = {
  width: 816,
  height: 1056,
  padding: 72,
  gap: 36,
};

export const EDITOR_PAGE_CONTENT_HEIGHT = EDITOR_PAGE.height - EDITOR_PAGE.padding * 2;
export const EDITOR_PAGE_STEP = EDITOR_PAGE.height + EDITOR_PAGE.gap;

export function nextPageContentTop(y: number) {
  const pageIndex = Math.max(0, Math.floor(y / EDITOR_PAGE_STEP));
  return (pageIndex + 1) * EDITOR_PAGE_STEP + EDITOR_PAGE.padding;
}

export function pageBottomFor(y: number) {
  const pageIndex = Math.max(0, Math.floor(y / EDITOR_PAGE_STEP));
  return pageIndex * EDITOR_PAGE_STEP + EDITOR_PAGE.height - EDITOR_PAGE.padding;
}
