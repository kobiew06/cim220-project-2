export const nativeScrolling = window.matchMedia('(max-width: 767px), (hover: none), (pointer: coarse)');

// An overscanned document-anchored canvas moves with native/compositor scrolling
// between JS frames. Clamp its extent so it never adds extra page scroll height.
export function getRenderWindow(scroll, viewportHeight, pageHeight, native) {
  if (!native) return { origin: scroll, height: viewportHeight };
  const height = Math.min(pageHeight, viewportHeight + 320);
  const origin = Math.max(0, Math.min(scroll - 160, pageHeight - height));
  return { origin, height };
}
