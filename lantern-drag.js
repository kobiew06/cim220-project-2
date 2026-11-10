// Only this small hit area intercepts input; the rest of the page scrolls normally.
export function createLanternDrag({ onStart, onMove, onEnd }) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'lantern-drag-handle';
  handle.hidden = true;
  handle.title = 'Drag the lantern to explore';
  handle.setAttribute('aria-label', 'Move lantern. Drag, or press Enter and use arrow keys. Press Enter or Escape to release.');
  handle.setAttribute('aria-pressed', 'false');
  handle.setAttribute('data-lenis-prevent', '');
  document.body.append(handle);
  let pointerId = null;
  let keyboard = false;
  let centre = { x: 0, y: 0 };
  let offset = { x: 0, y: 0 };

  const clamp = (point) => ({
    x: Math.max(24, Math.min(document.documentElement.clientWidth - 24, point.x)),
    y: Math.max(48, Math.min(window.innerHeight - 24, point.y)),
  });
  const begin = () => {
    handle.classList.add('is-dragging');
    handle.setAttribute('aria-pressed', 'true');
    onStart(centre);
  };
  const finish = () => {
    if (pointerId === null && !keyboard) return;
    const captured = pointerId;
    pointerId = null;
    keyboard = false;
    handle.classList.remove('is-dragging');
    handle.setAttribute('aria-pressed', 'false');
    if (captured !== null && handle.hasPointerCapture(captured)) handle.releasePointerCapture(captured);
    onEnd();
  };
  const onDown = (event) => {
    if (event.button !== 0 || event.isPrimary === false || pointerId !== null) return;
    event.preventDefault();
    if (keyboard) finish();
    pointerId = event.pointerId;
    offset = { x: event.clientX - centre.x, y: event.clientY - centre.y };
    handle.setPointerCapture(pointerId);
    begin();
  };
  const onPointerMove = (event) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    centre = clamp({ x: event.clientX - offset.x, y: event.clientY - offset.y });
    onMove(centre);
  };
  const onPointerEnd = (event) => {
    if (event.pointerId === pointerId) finish();
  };
  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (event.repeat || pointerId !== null) return;
      if (keyboard) finish();
      else { keyboard = true; begin(); }
      return;
    }
    if (!keyboard) return;
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!steps[event.key]) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 16;
    centre = clamp({ x: centre.x + steps[event.key][0] * step, y: centre.y + steps[event.key][1] * step });
    onMove(centre);
  };
  const onWheel = (event) => {
    if (pointerId !== null || keyboard) event.preventDefault();
  };
  handle.addEventListener('pointerdown', onDown);
  handle.addEventListener('pointermove', onPointerMove);
  handle.addEventListener('pointerup', onPointerEnd);
  handle.addEventListener('pointercancel', onPointerEnd);
  handle.addEventListener('lostpointercapture', onPointerEnd);
  handle.addEventListener('keydown', onKey);
  handle.addEventListener('blur', finish);
  handle.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('blur', finish);

  return {
    update(x, y, size, loaded) {
      // Keep the held pointer/keyboard target independent of the visual spring.
      if (pointerId === null && !keyboard) centre = { x, y };
      const width = Math.max(64, size * 1.2);
      const height = Math.max(80, size * 1.9);
      handle.hidden = !loaded;
      handle.style.width = `${width}px`;
      handle.style.height = `${height}px`;
      handle.style.transform = `translate3d(${x - width / 2}px, ${y - height / 2}px, 0)`;
    },
    dispose() {
      window.removeEventListener('blur', finish);
      // Removing the button also removes all its input listeners and capture.
      pointerId = null;
      keyboard = false;
      handle.remove();
    },
  };
}
