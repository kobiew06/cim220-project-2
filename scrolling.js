import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { gsap } from 'gsap';

const lenis = new Lenis({
  // Higher values feel tighter; lower values give a longer glide.
  lerp: 0.12,
  smoothWheel: true,
  syncTouch: false,
  anchors: true,
  autoRaf: false,
  respectReducedMotion: false,
});

// Update scrolling before the cube and other GSAP animations on each frame.
const tick = (seconds) => lenis.raf(seconds * 1000);
gsap.ticker.add(tick, false, true);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    gsap.ticker.remove(tick);
    lenis.destroy();
  });
}
