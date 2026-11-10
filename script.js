import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadLantern, disposeLantern, updateLanternFire } from './lantern.js';
import { createPageShadows } from './page-shadows.js';
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
const shadowOpacity = 0.28;
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

    // This transparent receiver shows only the real cast shadow over the HTML.
    const shadowGeometry = new THREE.PlaneGeometry(1, 1);
    const shadowMaterial = new THREE.ShadowMaterial({
      color: 0x160c06, opacity: shadowOpacity, depthWrite: false,
    });
    const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
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
    const lightOffset = new THREE.Vector3();
    const fillOffset = new THREE.Vector3();
    let lanternModel;

    const render = () => {
      const depth = Math.sin(orbit.phase);
      const x = pose.x + Math.cos(orbit.phase) * pose.radiusX;
      const y = pose.y - depth * pose.radiusY;
      lantern.position.set(x - width / 2, height / 2 - (y - window.scrollY), 0);
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
      pageLight.style.setProperty('--light-y', `${y - window.scrollY + size * 0.15}px`);
      pageLight.style.setProperty('--light-radius', `${Math.min(lanternLightRadius, width * 0.9) * (0.99 + flicker * 0.01)}px`);
      pageShadows.update(x, y + size * 0.15, Math.min(lanternLightRadius, width * 0.9));
      fill.target.position.copy(lantern.position);
      fill.position.copy(lantern.position).add(fillOffset.set(-size * 3, -size, size * 2));
      shadowPlane.position.set(lantern.position.x, lantern.position.y - size * 0.4, -size * 1.5);
      shadowPlane.scale.set(size * 6, size * 6, 1);
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
          onUpdate: render,
          onComplete: render,
        });
      }
      render();
    };

    const selectStop = (immediate = false) => {
      if (!bounds.length) return;
      const focus = window.scrollY + height * 0.4;
      const distance = (index) => Math.abs(bounds[index].y - focus);
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - height);
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
        render();
      });
    };

    const measure = () => {
      if (disposed) return;
      pageShadows.measure();
      width = document.documentElement.clientWidth;
      height = window.innerHeight;
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      // One responsive size for every stop; scrolling never changes it.
      const size = Math.min(lanternSize, width * 0.12);
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
      else {
        // Keep an in-flight trip moving to its new responsive destination.
        goToStop(activeIndex, !travel?.isActive());
        selectStop();
      }
    };

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
      phase: Math.PI * 2, duration: orbitDuration, repeat: -1, ease: 'none', onUpdate: render,
    });
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(document.querySelector('main'));
    stops.forEach((stop) => resizeObserver.observe(stop));
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
        disposeLantern(lantern);
        reflections.dispose();
        shadowGeometry.dispose();
        shadowMaterial.dispose();
        light.shadow.dispose();
        renderer.dispose();
        animationStage.replaceChildren();
        pageLight.remove();
        pageShadows.dispose();
      });
    }
  }
}
