const titleClearance = 24;
// A new stop must be this much closer to the viewport focus to take over.
const stopSwitchMargin = 60;

export function measureLanternStops(elements, size, scroll) {
  const modelRadius = size * 0.85;
  return elements.map((element) => {
    const isImage = element.tagName === 'IMG';
    let rect;
    if (isImage) {
      rect = element.getBoundingClientRect();
    } else {
      // Measure the letters, since headings can be much wider than their text.
      const range = document.createRange();
      range.selectNodeContents(element);
      rect = range.getBoundingClientRect();
    }

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + scroll + rect.height / 2,
      // Keep image orbits within the photograph.
      radiusX: isImage ? rect.width * 0.38 : rect.width / 2 + modelRadius + titleClearance,
      radiusY: rect.height * (isImage ? 0.32 : 0.28),
      size,
    };
  });
}

export function findNearestStop(bounds, activeIndex, { scroll, height, mainTop, maxScroll, immediate }) {
  const focus = scroll + height * 0.4;
  const distance = (index) => Math.abs(bounds[index].y - focus);
  // The first and last stops may never reach the viewport focus line.
  const atTop = scroll <= mainTop + 2;
  const atBottom = maxScroll > 2 && scroll >= maxScroll - 2;
  const nearest = atTop ? 0 : atBottom ? bounds.length - 1
    : bounds.reduce((best, _, index) => distance(index) < distance(best) ? index : best, 0);

  if (activeIndex < 0 || immediate) return nearest;
  if (nearest !== activeIndex && (atTop || atBottom || distance(nearest) + stopSwitchMargin < distance(activeIndex))) {
    return nearest;
  }
  return null;
}
