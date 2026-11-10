import * as THREE from 'three';
import { gsap } from 'gsap';

const animationStage = document.querySelector('#animation-stage');
const title = document.querySelector('.intro-title h1');
// Extra pixels between the cube's outer edge and the title at each layer switch.
const titleClearance = 24;

if (animationStage && title) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.warn('The cube preview could not start.', error);
  }

  if (renderer) {
    const scene = new THREE.Scene();
    // Pixel-sized coordinates keep the orbit aligned with the HTML heading.
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
    let bounds;
    const render = () => {
      if (!bounds) return;
      const { x, y, radiusX, radiusY, size } = bounds;
      const depth = Math.sin(orbit.phase);
      cube.position.set(x + Math.cos(orbit.phase) * radiusX, y + depth * radiusY, 0);
      cube.rotation.set(0.4 + orbit.phase, 0.6 + orbit.phase * 2, 0.15);
      cube.scale.setScalar(size * (1 + depth * 0.12));
      // HTML text is layer 2. Move the whole transparent canvas behind/in front.
      animationStage.style.zIndex = depth >= 0 ? '3' : '1';
      renderer.render(scene, camera);
    };
    const resize = () => {
      const stageRect = animationStage.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const { width, height } = stageRect;
      if (!width || !height) return;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      const size = Math.min(100, titleRect.width * 0.18, titleRect.height * 0.5);
      // A bounding sphere covers every rotation, including the largest orbit scale.
      const cubeRadius = size * Math.sqrt(3) / 2 * 1.12;
      bounds = {
        x: titleRect.left - stageRect.left + titleRect.width / 2 - width / 2,
        y: height / 2 - (titleRect.top - stageRect.top + titleRect.height / 2),
        radiusX: titleRect.width / 2 + cubeRadius + titleClearance,
        radiusY: titleRect.height * 0.28,
        size,
      };
      render();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(animationStage);
    resizeObserver.observe(title);
    resize();

    const animation = gsap.to(orbit, {
      phase: Math.PI * 2,
      duration: 10,
      repeat: -1,
      ease: 'none',
      onUpdate: render,
    });

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        animation.kill();
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        renderer.dispose();
        animationStage.replaceChildren();
      });
    }
  }
}
