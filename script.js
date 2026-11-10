import * as THREE from 'three';
import { gsap } from 'gsap';

const animationStage = document.querySelector('#animation-stage');
const titles = [...document.querySelectorAll('main h1, main h2')];
// Extra pixels beyond the text before the cube changes its stacking order.
const titleClearance = 24;
const travelDuration = 1.25;
const orbitDuration = 10;
// A new title must be this much closer to the viewport focus to take over.
const titleSwitchMargin = 60;

if (animationStage && titles.length) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.warn('The cube preview could not start.', error);
  }

  if (renderer) {
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    camera.position.z = 1000;
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xfbc246, roughness: 0.35, metalness: 0.15,
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube, new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 4);
    light.position.set(3, 4, 5);
    scene.add(light);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    animationStage.replaceChildren(renderer.domElement);

    const orbit = { phase: 0 };
    // Tween the orbit's centre and dimensions, rather than scrubbing its position.
    // GSAP finishes this trip even when no more scroll events arrive.
    const pose = { x: 0, y: 0, radiusX: 0, radiusY: 0, size: 1 };
    let bounds = [];
    let activeIndex = -1;
    let travel;
    let width = 0;
    let height = 0;
    let scrollFrame;
    let disposed = false;

    const render = () => {
      const depth = Math.sin(orbit.phase);
      const x = pose.x + Math.cos(orbit.phase) * pose.radiusX;
      const y = pose.y - depth * pose.radiusY;
      cube.position.set(x - width / 2, height / 2 - (y - window.scrollY), 0);
      cube.rotation.set(0.4 + orbit.phase, 0.6 + orbit.phase * 2, 0.15);
      cube.scale.setScalar(pose.size * (1 + depth * 0.12));
      // Every heading is layer 2, between the front and back halves of the orbit.
      animationStage.style.zIndex = depth >= 0 ? '3' : '1';
      renderer.render(scene, camera);
    };

    const goToTitle = (index, immediate = false) => {
      travel?.kill();
      activeIndex = index;
      if (immediate) {
        Object.assign(pose, bounds[index]);
      } else {
        travel = gsap.to(pose, {
          ...bounds[index],
          duration: travelDuration,
          ease: 'power2.inOut',
          onUpdate: render,
          onComplete: render,
        });
      }
      render();
    };

    const selectTitle = (immediate = false) => {
      if (!bounds.length) return;
      const focus = window.scrollY + height * 0.4;
      const distance = (index) => Math.abs(bounds[index].y - focus);
      const nearest = bounds.reduce((best, _, index) => distance(index) < distance(best) ? index : best, 0);
      if (activeIndex < 0 || immediate) {
        goToTitle(nearest, true);
      } else if (nearest !== activeIndex && distance(nearest) + titleSwitchMargin < distance(activeIndex)) {
        goToTitle(nearest);
      }
    };

    const onScroll = () => {
      // Select destinations on scroll; do not tie travel progress to scroll speed.
      if (scrollFrame !== undefined) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = undefined;
        selectTitle();
        render();
      });
    };

    const measure = () => {
      if (disposed) return;
      width = document.documentElement.clientWidth;
      height = window.innerHeight;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      bounds = titles.map((title) => {
        // Measure the letters, not the full-width heading block.
        const range = document.createRange();
        range.selectNodeContents(title);
        const rect = range.getBoundingClientRect();
        const size = Math.min(100, Math.max(28, rect.width * 0.18), Math.max(28, rect.height * 0.5));
        const cubeRadius = size * Math.sqrt(3) / 2 * 1.12;
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY + rect.height / 2,
          radiusX: rect.width / 2 + cubeRadius + titleClearance,
          radiusY: rect.height * 0.28,
          size,
        };
      });
      if (activeIndex < 0) selectTitle(true);
      else {
        // Keep an in-flight trip moving to its new responsive destination.
        goToTitle(activeIndex, !travel?.isActive());
        selectTitle();
      }
    };

    measure();
    const rotation = gsap.to(orbit, {
      phase: Math.PI * 2, duration: orbitDuration, repeat: -1, ease: 'none', onUpdate: render,
    });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(document.querySelector('main'));
    titles.forEach((title) => resizeObserver.observe(title));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
    document.fonts.ready.then(measure);

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        disposed = true;
        travel?.kill();
        rotation.kill();
        if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
        resizeObserver.disconnect();
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', measure);
        window.removeEventListener('load', measure);
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        animationStage.replaceChildren();
      });
    }
  }
}
