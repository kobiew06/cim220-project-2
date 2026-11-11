import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';
import { caveRevealStart, caveRevealEnd, mobileLayout } from './scroll-mode.js';

let lenis;
const configure = () => {
  lenis?.destroy();
  lenis = new Lenis({
    lerp: 0.12,
    smoothWheel: true,
    syncTouch: mobileLayout.matches,
    syncTouchLerp: 0.13,
    touchInertiaExponent: 1.25,
    anchors: true,
    autoRaf: false,
    respectReducedMotion: false,
  });
};
configure();
mobileLayout.addEventListener('change', configure);

const enterCaveLink = document.querySelector('.cave-controls a');
const entrance = document.querySelector('.cave-entrance');
const project = document.querySelector('#project');
const header = document.querySelector('.site-header');
const caveTravelDuration = 3.5;
const caveRevealDuration = 1.3;
let previousScroll = window.scrollY;

const isPlainClick = (event) => event.button === 0
  && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

const navigateToSection = (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || !isPlainClick(event)) return;
  const target = document.getElementById(link.hash.slice(1));
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  if (lenis.isLocked) return;
  lenis.resize();
  scrollTo(target, { duration: mobileLayout.matches ? 0.55 : undefined });
};
header.addEventListener('click', navigateToSection);

const enterCave = (event) => {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  // Lenis also handles anchor clicks at window level.
  event.stopPropagation();
  if (lenis.isLocked) return;
  scrollTo(project, {
    duration: caveTravelDuration,
    lock: true,
    onComplete: () => project.querySelector('h1').focus({ preventScroll: true }),
  });
};
enterCaveLink.addEventListener('click', enterCave);

function scrollTo(target, { duration, lock = false, onComplete } = {}) {
  lenis.scrollTo(target, {
    duration,
    easing: duration === undefined ? undefined : gsap.parseEase('sine.inOut'),
    lock,
    onComplete,
    userData: { siteNavigation: true },
  });
}

const finishCaveReveal = () => {
  const current = window.scrollY;
  const forward = current > previousScroll;
  previousScroll = current;
  if (!forward || entrance.hidden || lenis.userData.siteNavigation) return;
  const length = entrance.offsetHeight;
  const end = Math.ceil(length * caveRevealEnd);
  if (current <= length * caveRevealStart || current >= end) return;
  lenis.resize();
  scrollTo(end, { duration: caveRevealDuration, lock: true });
};
window.addEventListener('scroll', finishCaveReveal, { passive: true });

// Update scrolling before the camera and lantern render on each frame.
const tick = (seconds) => lenis.raf(seconds * 1000);
gsap.ticker.add(tick, false, true);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    gsap.ticker.remove(tick);
    mobileLayout.removeEventListener('change', configure);
    header.removeEventListener('click', navigateToSection);
    enterCaveLink.removeEventListener('click', enterCave);
    window.removeEventListener('scroll', finishCaveReveal);
    lenis.destroy();
  });
}
