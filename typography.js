// Fit single-line headings to their available width, including after fonts load.
const headings = [...document.querySelectorAll('main h1, main h2')];
let frame;
let disposed = false;
const fit = () => {
  if (disposed) return;
  headings.forEach((heading) => {
    heading.style.removeProperty('font-size');
    const range = document.createRange();
    range.selectNodeContents(heading);
    const textWidth = range.getBoundingClientRect().width;
    const available = heading.clientWidth;
    if (textWidth > available && available > 0) {
      const size = parseFloat(getComputedStyle(heading).fontSize);
      heading.style.fontSize = `${size * (available - 2) / textWidth}px`;
    }
  });
};
const schedule = () => {
  if (frame !== undefined) cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => { frame = undefined; fit(); });
};
fit();
const observer = new ResizeObserver(schedule);
headings.forEach((heading) => observer.observe(heading.parentElement));
window.addEventListener('resize', schedule);
document.fonts.ready.then(fit);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposed = true;
    observer.disconnect();
    window.removeEventListener('resize', schedule);
    if (frame !== undefined) cancelAnimationFrame(frame);
    headings.forEach((heading) => heading.style.removeProperty('font-size'));
  });
}
