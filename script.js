import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadLantern, disposeLantern, updateLanternFire } from './lantern.js';
import { createPageShadows } from './page-shadows.js';
import { createImageReveals } from './image-reveal.js';
import { createLanternDrag } from './lantern-drag.js';
import { createDragSpring } from './drag-spring.js';
import { nativeScrolling, getRenderWindow } from './scroll-mode.js';
import './scrolling.js';
import './navigation.js';
import './typography.js';

const animationStage = document.querySelector('#animation-stage');
const stops = [...document.querySelectorAll('main h1, main h2, main img')];
// Extra clearance around the text at the ends of the lantern's orbit.
const titleClearance = 24;
const travelDuration = 1.25;
const orbitDuration = 10;
// A new stop must be this much closer to the viewport focus to take over.
const stopSwitchMargin = 60;
const lightIntensity = 3.5;
const lanternSize = 48;
// Page illumination: radius in pixels and darkness outside the lantern's reach.
const lanternLightRadius = 420;
const pageDarkness = 0.62;

if (animationStage && stops.length) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.warn('The lantern preview could not start.', error);
  }

  if (renderer) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    camera.position.z = 1000;
    const lantern = new THREE.Group();
    scene.add(lantern, new THREE.AmbientLight(0xffe5c4, 0.35));
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const reflections = pmrem.fromScene(room, 0.04);
    scene.environment = reflections.texture;
    scene.environmentIntensity = 0.85;
    room.dispose();
    pmrem.dispose();

    // A moving, torch-coloured key light and a quiet blue fill reveal the faces.
    const light = new THREE.DirectionalLight(0xffbb77, lightIntensity);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    Object.assign(light.shadow.camera, {
      left: -300, right: 300, top: 300, bottom: -300, near: 1, far: 1600,
    });
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.5;
    light.shadow.radius = 3;
    const fill = new THREE.DirectionalLight(0x8abfff, 1.1);
    scene.add(light, light.target, fill, fill.target);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    animationStage.replaceChildren(renderer.domElement);
    const pageLight = document.createElement('div');
    pageLight.className = 'lantern-page-light';
    pageLight.setAttribute('aria-hidden', 'true');
    pageLight.style.setProperty('--page-darkness', pageDarkness);
    document.body.append(pageLight);
    const pageShadows = createPageShadows();
    const imageReveals = createImageReveals(scene);

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
    let renderHeight = 0;
    let scrollFrame;
    let disposed = false;
    const lightOffset = new THREE.Vector3();
    const fillOffset = new THREE.Vector3();
    let lanternModel;
    let dragControl;
    let dragging = false;
    let returnMotion;
    const dragPosition = { x: 0, y: 0, blend: 0 };
    // Higher stiffness follows faster; lower damping adds more bounce.
    const dragSpring = createDragSpring(220, 22);
    let springTime = performance.now();

    const render = () => {
      if (!width || !height) return;
      const viewport = getRenderWindow(window.scrollY, height, pageHeight, nativeScrolling.matches);
      const origin = viewport.origin;
      if (renderHeight !== viewport.height) {
        renderHeight = viewport.height;
        camera.top = renderHeight / 2;
        camera.bottom = -renderHeight / 2;
        camera.updateProjectionMatrix();
        renderer.setSize(width, renderHeight);
      }
      const layerPosition = nativeScrolling.matches ? 'absolute' : 'fixed';
      const layerTop = nativeScrolling.matches ? `${origin}px` : '0px';
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
      const orbitX = pose.x + Math.cos(orbit.phase) * pose.radiusX;
      const orbitY = pose.y - depth * pose.radiusY;
      const x = THREE.MathUtils.lerp(orbitX, dragPosition.x, dragPosition.blend);
      const y = THREE.MathUtils.lerp(orbitY, dragPosition.y + window.scrollY, dragPosition.blend);
      dragControl?.update(x, y - window.scrollY, pose.size, Boolean(lanternModel));
      lantern.position.set(x - width / 2, renderHeight / 2 - (y - origin), 0);
      lantern.rotation.set(Math.sin(orbit.phase) * 0.08, 0.45 + Math.sin(orbit.phase) * 0.7, Math.sin(orbit.phase) * 0.12);
      lantern.scale.setScalar(pose.size);
      const size = pose.size;
      if (lanternModel) updateLanternFire(lanternModel, gsap.ticker.time, size);
      // Keep the lighting rig with the lantern as it travels between headings.
      light.target.position.copy(lantern.position);
      light.position.copy(lantern.position).add(lightOffset.set(
        Math.cos(orbit.phase) * size * 3,
        (2.7 + Math.sin(orbit.phase) * 0.8) * size,
        size * 4,
      ));
      light.intensity = lightIntensity * (
        1 + Math.sin(orbit.phase * 31) * 0.045 + Math.sin(orbit.phase * 47) * 0.025
      );
      const flicker = light.intensity / lightIntensity;
      pageLight.style.setProperty('--light-x', `${x}px`);
      pageLight.style.setProperty('--light-y', `${y - origin + size * 0.15}px`);
      pageLight.style.setProperty('--light-radius', `${Math.min(lanternLightRadius, width * 0.9) * (0.99 + flicker * 0.01)}px`);
      pageShadows.update(x, y + size * 0.15, Math.min(lanternLightRadius, width * 0.9));
      imageReveals.update(x, y + size * 0.15, gsap.ticker.time, width, renderHeight, origin);
      fill.target.position.copy(lantern.position);
      fill.position.copy(lantern.position).add(fillOffset.set(-size * 3, -size, size * 2));
      // Keep the lantern above the text and images throughout its orbit.
      animationStage.style.zIndex = '3';
      renderer.render(scene, camera);
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
      const focus = window.scrollY + height * 0.4;
      const distance = (index) => Math.abs(bounds[index].y - focus);
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      // Short final sections may never reach the viewport focus line. Select
      // endpoints explicitly and bypass the usual switching margin there.
      const atTop = window.scrollY <= 2;
      const atBottom = maxScroll > 2 && window.scrollY >= maxScroll - 2;
      const atEdge = atTop || atBottom;
      const nearest = atTop ? 0 : atBottom ? bounds.length - 1
        : bounds.reduce((best, _, index) => distance(index) < distance(best) ? index : best, 0);
      if (activeIndex < 0 || immediate) {
        goToStop(nearest, true);
      } else if (nearest !== activeIndex && (atEdge || distance(nearest) + stopSwitchMargin < distance(activeIndex))) {
        goToStop(nearest);
      }
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
      pageShadows.measure();
      imageReveals.measure();
      const measuredWidth = document.documentElement.clientWidth;
      // Browser chrome changing height must not constantly resize the canvas.
      if (!height || !nativeScrolling.matches || width !== measuredWidth) height = window.innerHeight;
      width = measuredWidth;
      pageHeight = document.querySelector('.site-footer').getBoundingClientRect().bottom + window.scrollY;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.updateProjectionMatrix();
      renderHeight = 0;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, nativeScrolling.matches ? 1.25 : 2));
      // One responsive size for every stop; scrolling never changes it.
      const size = Math.min(lanternSize, width * 0.12);
      const previousBounds = bounds;
      bounds = stops.map((stop) => {
        const isImage = stop.tagName === 'IMG';
        let rect;
        if (isImage) rect = stop.getBoundingClientRect();
        else {
          // Measure the letters, not the full-width heading block.
          const range = document.createRange();
          range.selectNodeContents(stop);
          rect = range.getBoundingClientRect();
        }
        const modelRadius = size * 0.85;
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + window.scrollY + rect.height / 2,
          // Sweep over image content to light it, rather than disappearing
          // beyond the sides of full-width photographs.
          radiusX: isImage ? rect.width * 0.38 : rect.width / 2 + modelRadius + titleClearance,
          radiusY: rect.height * (isImage ? 0.32 : 0.28),
          size,
        };
      });
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

    dragControl = createLanternDrag({
      onStart(point) {
        returnMotion?.kill();
        travel?.kill();
        dragging = true;
        dragSpring.reset(point);
        springTime = performance.now();
        Object.assign(dragPosition, point, { blend: 1 });
        render();
      },
      onMove(point) {
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
    loadLantern().then((model) => {
      if (disposed) disposeLantern(model);
      else {
        lantern.add(model);
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
      if (!nativeScrolling.matches || document.documentElement.clientWidth !== width) measure();
    };
    window.addEventListener('resize', onResize);
    nativeScrolling.addEventListener('change', measure);
    window.addEventListener('load', measure);
    document.fonts.ready.then(measure);

    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        disposed = true;
        travel?.kill();
        returnMotion?.kill();
        dragControl.dispose();
        rotation.kill();
        gsap.ticker.remove(render);
        if (scrollFrame !== undefined) cancelAnimationFrame(scrollFrame);
        resizeObserver.disconnect();
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onResize);
        nativeScrolling.removeEventListener('change', measure);
        window.removeEventListener('load', measure);
        disposeLantern(lantern);
        reflections.dispose();
        light.shadow.dispose();
        renderer.dispose();
        animationStage.replaceChildren();
        pageLight.remove();
        pageShadows.dispose();
        imageReveals.dispose();
        for (const property of ['position', 'top', 'bottom', 'height']) animationStage.style.removeProperty(property);
      });
    }
  }
}
