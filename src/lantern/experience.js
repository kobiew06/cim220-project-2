import * as THREE from 'three';
import { gsap } from 'gsap';
import { loadLantern, disposeLantern, updateLanternFire } from './lantern.js';
import { createPageShadows } from './page-shadows.js';
import { createImageReveals } from './image-reveal.js';
import { createLanternDrag } from './lantern-drag.js';
import { createDragSpring } from './drag-spring.js';
import { createCaveEntrance } from '../cave/entrance.js';
import { mobileLayout, getRenderWindow } from '../page/scroll-mode.js';
import { createLanternStage } from './stage.js';
import { measureLanternStops, findNearestStop } from './stops.js';

const travelDuration = 1.25;
const orbitDuration = 10;
const lanternSize = 48;
const entranceLanternScale = 1.6;
// Page illumination: radius in pixels and darkness outside the lantern's reach.
const lanternLightRadius = 420;
const pageDarkness = 0.62;

export function startLanternExperience() {
  const animationStage = document.querySelector('#animation-stage');
  const introHeading = document.querySelector('.intro-heading');
  const stops = [...document.querySelectorAll('main h1, main h2, main img')];
  const firstImageIndex = stops.findIndex((stop) => stop.matches('.hero-image img'));
  const dragHint = document.querySelector('.lantern-drag-hint');

  if (!animationStage || !stops.length) return null;
  const stage = createLanternStage(animationStage);
  if (!stage) return null;

  const pageLight = document.createElement('div');
  pageLight.className = 'lantern-page-light';
  pageLight.setAttribute('aria-hidden', 'true');
  pageLight.style.setProperty('--page-darkness', pageDarkness);
  document.body.append(pageLight);
  const pageShadows = createPageShadows();
  const imageReveals = createImageReveals(stage.scene);

  const orbit = { phase: 0 };
  // Tween the orbit's centre and dimensions, rather than scrubbing its position.
  // GSAP finishes this trip even when no more scroll events arrive.
  const pose = { x: 0, y: 0, radiusX: 0, radiusY: 0, size: 1 };
  let bounds = [];
  let activeIndex = -1;
  let travel;
  let width = 0;
  let height = 0;
  let pageHeight = 0;
  let mainTop = 0;
  let renderHeight = 0;
  let scrollFrame;
  let disposed = false;
  let lanternModel;
  let triedImageDrag = false;
  let firstImageBottom = Infinity;
  let firstImageLeft = 0;
  const hintHover = { blend: 0 };
  let hintTravel;
  let dragControl;
  let dragging = false;
  let returnMotion;
  const dragPosition = { x: 0, y: 0, blend: 0 };
  // Higher stiffness follows faster; lower damping adds more bounce.
  const dragSpring = createDragSpring(220, 22);
  let springTime = performance.now();

  const render = () => {
    if (!width || !height) return;
    const scroll = window.scrollY;
    const entrance = caveEntrance.getPosition();
    // During the entrance the lantern is held in screen space. A fixed layer
    // keeps native scrolling from carrying it away between rendered frames.
    const documentAnchored = mobileLayout.matches && !entrance;
    const viewport = getRenderWindow(scroll, height, pageHeight, documentAnchored);
    const origin = viewport.origin;
    if (renderHeight !== viewport.height) {
      renderHeight = viewport.height;
      stage.resize(width, renderHeight);
    }
    const layerPosition = documentAnchored ? 'absolute' : 'fixed';
    const layerTop = documentAnchored ? `${origin}px` : '0px';
    for (const layer of [animationStage, pageLight]) {
      layer.style.position = layerPosition;
      layer.style.top = layerTop;
      layer.style.bottom = 'auto';
      layer.style.height = `${renderHeight}px`;
    }
    const now = performance.now();
    if (dragging || dragPosition.blend > 0) {
      const point = dragSpring.step((now - springTime) / 1000);
      dragPosition.x = point.x;
      dragPosition.y = point.y;
    }
    springTime = now;
    const depth = Math.sin(orbit.phase);
    const handoff = entrance?.handoff ?? 1;
    const size = pose.size * THREE.MathUtils.lerp(entranceLanternScale, 1, handoff);
    const orbitX = THREE.MathUtils.lerp(width * 0.64, pose.x + Math.cos(orbit.phase) * pose.radiusX, handoff);
    const orbitY = THREE.MathUtils.lerp(
      scroll + height * 0.65,
      pose.y - depth * pose.radiusY,
      handoff,
    );
    const firstImageY = firstImageBottom - scroll;
    const hideHint = !lanternModel || Boolean(entrance) || triedImageDrag
      || firstImageY < height * 0.15 || firstImageY > height;
    if (dragHint.hidden !== hideHint) {
      dragHint.hidden = hideHint;
      hintTravel?.kill();
      hintTravel = gsap.to(hintHover, {
        blend: hideHint ? 0 : 1,
        duration: travelDuration,
        ease: 'power2.inOut',
      });
    }
    if (!hideHint) dragHint.style.top = `${firstImageBottom}px`;
    const hoverX = firstImageLeft + 96 + Math.cos(orbit.phase * 2) * 18;
    const hoverY = Number.isFinite(firstImageBottom) ? firstImageBottom - 108 + depth * 8 : orbitY;
    const x = THREE.MathUtils.lerp(THREE.MathUtils.lerp(orbitX, hoverX, hintHover.blend), dragPosition.x, dragPosition.blend);
    const y = THREE.MathUtils.lerp(THREE.MathUtils.lerp(orbitY, hoverY, hintHover.blend), dragPosition.y + scroll, dragPosition.blend);
    const screenY = y - scroll;
    dragControl?.update(x, screenY, size, Boolean(lanternModel), documentAnchored ? scroll : null);
    pageLight.style.setProperty('--page-light-strength', handoff);
    if (entrance) caveEntrance.render(entrance.progress, x, screenY, Boolean(lanternModel));
    const flicker = stage.updateLighting({ x, y, width, renderHeight, origin, size, phase: orbit.phase });
    if (lanternModel) updateLanternFire(lanternModel, gsap.ticker.time, size);
    pageLight.style.setProperty('--light-x', `${x}px`);
    pageLight.style.setProperty('--light-y', `${y - origin + size * 0.15}px`);
    pageLight.style.setProperty('--light-radius', `${Math.min(lanternLightRadius, width * 0.9) * (0.99 + flicker * 0.01)}px`);
    pageShadows.update(x, y + size * 0.15, Math.min(lanternLightRadius, width * 0.9));
    imageReveals.update(x, y + size * 0.15, gsap.ticker.time, width, renderHeight, origin);
    stage.render();
  };

  const goToStop = (index, immediate = false) => {
    travel?.kill();
    activeIndex = index;
    if (immediate) {
      Object.assign(pose, bounds[index]);
    } else {
      travel = gsap.to(pose, {
        ...bounds[index],
        duration: travelDuration,
        ease: 'power2.inOut',
        onComplete: render,
      });
    }
    render();
  };

  const selectStop = (immediate = false) => {
    if (!bounds.length || dragging) return;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const nearest = findNearestStop(bounds, activeIndex, {
      scroll: window.scrollY, height, mainTop, maxScroll, immediate,
    });
    if (nearest !== null) goToStop(nearest, activeIndex < 0 || immediate);
  };

  const onScroll = () => {
    // Select destinations on scroll; do not tie travel progress to scroll speed.
    if (scrollFrame !== undefined) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = undefined;
      selectStop();
    });
  };

  const measure = () => {
    if (disposed) return;
    // Orbit targets and projected shadows use the heading's settled layout.
    introHeading.style.transform = 'none';
    const measuredWidth = document.documentElement.clientWidth;
    // Browser chrome changing height must not constantly resize the canvas.
    if (!height || !mobileLayout.matches || width !== measuredWidth) height = window.innerHeight;
    width = measuredWidth;
    pageShadows.measure();
    imageReveals.measure();
    mainTop = document.querySelector('main').getBoundingClientRect().top + window.scrollY;
    pageHeight = document.querySelector('.site-footer').getBoundingClientRect().bottom + window.scrollY;
    renderHeight = 0;
    stage.setWidth(width, Math.min(window.devicePixelRatio, mobileLayout.matches ? 1.25 : 2));
    const previousBounds = bounds;
    bounds = measureLanternStops(stops, Math.min(lanternSize, width * 0.12), window.scrollY);
    if (firstImageIndex >= 0) {
      ({ bottom: firstImageBottom, left: firstImageLeft } = stops[firstImageIndex].getBoundingClientRect());
      firstImageBottom += window.scrollY;
      dragHint.style.left = `${firstImageLeft}px`;
    }
    const headingTop = introHeading.getBoundingClientRect().top + window.scrollY;
    introHeading.style.setProperty('--cave-title-origin', `${bounds[0].y - headingTop}px`);
    introHeading.style.removeProperty('transform');
    if (activeIndex < 0) selectStop(true);
    else if (!dragging) {
      // Keep an in-flight trip moving to its new responsive destination.
      const previous = previousBounds[activeIndex];
      const changed = !previous || Object.keys(bounds[activeIndex]).some((key) => Math.abs(bounds[activeIndex][key] - previous[key]) > 0.5);
      if (changed) goToStop(activeIndex, !travel?.isActive());
      selectStop();
    }
    render();
  };

  const caveEntrance = createCaveEntrance(measure);
  dragControl = createLanternDrag({
    onStart(point) {
      if (caveEntrance.getPosition()) caveEntrance.pickUp();
      returnMotion?.kill();
      travel?.kill();
      dragging = true;
      dragSpring.reset(point);
      springTime = performance.now();
      Object.assign(dragPosition, point, { blend: 1 });
      render();
    },
    onMove(point) {
      if (!dragHint.hidden) triedImageDrag = true;
      dragSpring.aim(point);
      render();
    },
    onEnd() {
      if (disposed) return;
      dragging = false;
      selectStop();
      if (activeIndex >= 0) goToStop(activeIndex);
      returnMotion = gsap.to(dragPosition, {
        blend: 0, duration: 1, ease: 'power2.inOut',
      });
    },
  });
  const lanternLoaded = loadLantern().then((model) => {
    if (disposed) disposeLantern(model);
    else {
      stage.lantern.add(model);
      lanternModel = model;
      pageLight.classList.add('is-lit');
      render();
    }
  }).catch((error) => console.error('The lantern model could not load.', error));
  measure();
  const rotation = gsap.to(orbit, {
    phase: Math.PI * 2, duration: orbitDuration, repeat: -1, ease: 'none',
  });
  gsap.ticker.add(render);
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(document.querySelector('main'));
  stops.forEach((stop) => resizeObserver.observe(stop));
  window.addEventListener('scroll', onScroll, { passive: true });
  const onResize = () => {
    if (!mobileLayout.matches || document.documentElement.clientWidth !== width) measure();
  };
  window.addEventListener('resize', onResize);
  mobileLayout.addEventListener('change', measure);
  window.addEventListener('load', measure);
  document.fonts.ready.then(measure);

  function dispose() {
    disposed = true;
    dragHint.hidden = true;
    hintTravel?.kill();
    travel?.kill();
    returnMotion?.kill();
    dragControl.dispose();
    caveEntrance.dispose();
    introHeading.style.removeProperty('--cave-title-origin');
    rotation.kill();
    gsap.ticker.remove(render);
    if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
    resizeObserver.disconnect();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    mobileLayout.removeEventListener('change', measure);
    window.removeEventListener('load', measure);
    disposeLantern(stage.lantern);
    pageLight.remove();
    pageShadows.dispose();
    imageReveals.dispose();
    stage.dispose();
    for (const property of ['position', 'top', 'bottom', 'height']) animationStage.style.removeProperty(property);
  }

  return { loaded: Promise.allSettled([caveEntrance.loaded, lanternLoaded]), dispose };
}
