import { gsap } from 'gsap';

const nav = document.querySelector('.site-header nav');

if (nav) {
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const sections = links.map((link) => document.getElementById(link.hash.slice(1)));
  // Each letter rolls independently so the flip travels across the label.
  const hoverEffects = links.map((link) => {
    const originalNodes = [...link.childNodes];
    const originalLabel = link.getAttribute('aria-label');
    const label = link.textContent;
    const rolls = [];
    const fragment = document.createDocumentFragment();
    for (const character of label) {
      const glyph = document.createElement('span');
      glyph.className = 'nav-glyph';
      glyph.setAttribute('aria-hidden', 'true');
      const roll = document.createElement('span');
      roll.className = 'nav-glyph-roll';
      for (let copy = 0; copy < 2; copy++) {
        const face = document.createElement('span');
        face.className = 'nav-glyph-face';
        face.textContent = character === ' ' ? '\u00a0' : character;
        roll.append(face);
      }
      glyph.append(roll);
      fragment.append(glyph);
      rolls.push(roll);
    }
    link.replaceChildren(fragment);
    link.setAttribute('aria-label', label);
    const wave = gsap.timeline({ paused: true });
    rolls.forEach((roll, index) => {
      const start = index * 0.028;
      wave.to(roll, {
        yPercent: -50, duration: 0.3, ease: 'power2.inOut',
      }, start);
      wave.to(roll, {
        rotationX: -35, duration: 0.15, repeat: 1, yoyo: true, ease: 'sine.inOut',
      }, start);
    });
    let hovered = false;
    let keyboardFocused = false;
    const updateFlip = () => {
      if (hovered || keyboardFocused) wave.play();
      else wave.reverse();
    };
    const onEnter = (event) => {
      if (event.pointerType === 'touch') return;
      hovered = true;
      updateFlip();
    };
    const onLeave = () => {
      hovered = false;
      updateFlip();
    };
    const onFocus = () => {
      keyboardFocused = link.matches(':focus-visible');
      updateFlip();
    };
    const onBlur = () => {
      keyboardFocused = false;
      updateFlip();
    };
    link.addEventListener('pointerenter', onEnter);
    link.addEventListener('pointerleave', onLeave);
    link.addEventListener('pointercancel', onLeave);
    link.addEventListener('focus', onFocus);
    link.addEventListener('blur', onBlur);
    return () => {
      wave.kill();
      link.removeEventListener('pointerenter', onEnter);
      link.removeEventListener('pointerleave', onLeave);
      link.removeEventListener('pointercancel', onLeave);
      link.removeEventListener('focus', onFocus);
      link.removeEventListener('blur', onBlur);
      link.replaceChildren(...originalNodes);
      if (originalLabel === null) link.removeAttribute('aria-label');
      else link.setAttribute('aria-label', originalLabel);
    };
  });
  const indicator = document.createElement('span');
  indicator.className = 'nav-indicator';
  indicator.setAttribute('aria-hidden', 'true');
  nav.append(indicator);

  let sectionTops = [];
  let linkBounds = [];
  let activeIndex = -1;
  let frame;
  let slide;
  let disposed = false;

  const select = (index, immediate = false) => {
    if (index === activeIndex && !immediate) return;
    activeIndex = index;
    links.forEach((link, i) => {
      if (i === index) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
    const { x, width } = linkBounds[index];
    slide?.kill();
    const destination = { x, width, opacity: 1 };
    if (immediate) gsap.set(indicator, destination);
    else slide = gsap.to(indicator, {
      ...destination, duration: 0.45, ease: 'power3.out', overwrite: true,
    });
  };

  const update = (immediate = false) => {
    if (!sectionTops.length) return;
    // The section becomes current as its top reaches the upper part of the view.
    const focus = window.scrollY + Math.max(90, window.innerHeight * 0.25);
    let index = 0;
    sectionTops.forEach((top, i) => { if (top <= focus) index = i; });
    // The final section can be shorter than the viewport.
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      index = links.length - 1;
    }
    select(index, immediate || activeIndex < 0);
  };

  const measure = () => {
    if (disposed) return;
    const navRect = nav.getBoundingClientRect();
    linkBounds = links.map((link) => {
      const rect = link.getBoundingClientRect();
      return { x: rect.left - navRect.left, width: rect.width };
    });
    sectionTops = sections.map((section) => section.getBoundingClientRect().top + window.scrollY);
    update(true);
  };
  const onScroll = () => {
    if (frame !== undefined) return;
    frame = requestAnimationFrame(() => {
      frame = undefined;
      update();
    });
  };

  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(nav);
  observer.observe(document.querySelector('main'));
  const entrance = document.querySelector('.cave-entrance');
  if (entrance) observer.observe(entrance);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure);
  window.addEventListener('load', measure);
  document.fonts.ready.then(measure);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      disposed = true;
      slide?.kill();
      if (frame !== undefined) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      window.removeEventListener('load', measure);
      links.forEach((link) => link.removeAttribute('aria-current'));
      indicator.remove();
      hoverEffects.forEach((cleanup) => cleanup());
    });
  }
}
