export const mobileLayout = window.matchMedia('(max-width: 767px), (hover: none), (pointer: coarse)');
export const caveRevealStart = 0.56;
export const caveRevealEnd = 0.88;

// An overscanned document-anchored canvas moves with the page
// between JS frames. Clamp its extent so it never adds extra page scroll height.
export function getRenderWindow(scroll, viewportHeight, pageHeight, documentAnchored) {
  if (!documentAnchored) return { origin: scroll, height: viewportHeight };
  const height = Math.min(pageHeight, viewportHeight + 320);
  const origin = Math.max(0, Math.min(scroll - 160, pageHeight - height));
  return { origin, height };
}
