// Project HTML shadows away from the lantern without changing layout.
export function createPageShadows() {
  const targets = [...document.querySelectorAll('main h1, main h2, main p, main li, main img')].map((element) => {
    const type = element.tagName === 'IMG' ? 'image' : 'text';
    element.classList.add(`lantern-shadow-${type}`);
    return { element, type, x: 0, y: 0, halfWidth: 0, halfHeight: 0 };
  });

  return {
    measure() {
      for (const target of targets) {
        let rect;
        if (target.type === 'text') {
          // Block headings often extend far past their letters. Project from
          // the visible text bounds, matching the lantern's title orbit.
          const range = document.createRange();
          range.selectNodeContents(target.element);
          rect = range.getBoundingClientRect();
        } else {
          rect = target.element.getBoundingClientRect();
        }
        target.x = rect.left + rect.width / 2;
        target.y = rect.top + window.scrollY + rect.height / 2;
        target.halfWidth = rect.width / 2;
        target.halfHeight = rect.height / 2;
      }
    },
    update(lightX, lightY, radius) {
      for (const target of targets) {
        const dx = target.x - lightX;
        const dy = target.y - lightY;
        // Distance to the nearest edge lets large images react when the
        // lantern reaches their edge, even if their centre is further away.
        const distance = Math.hypot(
          Math.max(0, Math.abs(dx) - target.halfWidth),
          Math.max(0, Math.abs(dy) - target.halfHeight),
        );
        const strength = Math.max(0, 1 - distance / (radius * 1.2));
        const elevation = target.type === 'image' ? 0.16 : 0.09;
        const x = Math.max(-65, Math.min(65, dx * elevation));
        const y = Math.max(-65, Math.min(65, dy * elevation));
        const blur = target.type === 'image' ? 14 : 3;
        target.element.style.setProperty('--lantern-cast-shadow',
          `${x.toFixed(1)}px ${y.toFixed(1)}px ${blur}px rgb(0 0 0 / ${(strength * 0.85).toFixed(3)})`);
      }
    },
    dispose() {
      for (const { element, type } of targets) {
        element.classList.remove(`lantern-shadow-${type}`);
        element.style.removeProperty('--lantern-cast-shadow');
      }
    },
  };
}
