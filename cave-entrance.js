import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import caveUrl from './assets/cave.glb?url';
import { caveRevealStart, caveRevealEnd } from './scroll-mode.js';

export function createCaveEntrance(onReady) {
  const section = document.querySelector('.cave-entrance');
  const view = section.querySelector('.cave-view');
  const instructions = section.querySelector('.cave-instructions');
  const controls = instructions.parentElement;
  const project = document.querySelector('#project');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.FogExp2(0x000000, 0.033);
  const camera = new THREE.PerspectiveCamera(47, 1, 0.08, 85);
  const sky = new THREE.HemisphereLight(0xa1c0d4, 0x51412c, 1.35);
  const daylight = new THREE.DirectionalLight(0xcbdaf1, 2.4);
  daylight.position.set(-14, 12, 5);
  const torch = new THREE.PointLight(0xffa34c, 16, 16);
  const ray = new THREE.Vector3();
  const lookAhead = new THREE.Vector3();
  // The scan starts on a sloped trail that descends into a narrow tunnel.
  const passage = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-11.65, 4.85, 0),
    new THREE.Vector3(-8.7, 1.3, 0.75),
    new THREE.Vector3(-6, 0.2, 0.5),
    new THREE.Vector3(-3, -0.8, 0.45),
    new THREE.Vector3(0, -1.45, 0.65),
    new THREE.Vector3(3.5, -1.8, 0.75),
    new THREE.Vector3(8.4, -2, 1.1),
    new THREE.Vector3(12.5, -2.15, 1.1),
  ], false, 'centripetal');
  scene.add(sky, daylight, torch);

  const ground = new THREE.MeshStandardMaterial({ color: 0x443f34, roughness: 1 });
  // Fade daylight below the arch and deeper into the chamber. The lantern's
  // point light is evaluated separately, so it can still reveal those surfaces.
  function shadeCaveInterior(shader) {
    shader.vertexShader = 'varying vec3 cavePosition;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n cavePosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
    shader.fragmentShader = 'varying vec3 cavePosition;\n' + shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      `float chamber = smoothstep(-1.5, 5.0, cavePosition.x)
        * (1.0 - smoothstep(0.0, 3.2, cavePosition.y));
      float daylightExposure = mix(1.0, 0.12, chamber);
      ${THREE.ShaderChunk.lights_fragment_begin
        .replace('getDirectionalLightInfo( directionalLight, directLight );',
          'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= daylightExposure;')
        .replace('irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );',
          'irradiance += daylightExposure * getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );')}`,
    ).replace('#include <fog_fragment>', THREE.ShaderChunk.fog_fragment.replace(
      'mix( gl_FragColor.rgb, fogColor, fogFactor )',
      'mix( gl_FragColor.rgb, fogColor * daylightExposure, fogFactor )',
    ));
  }
  ground.onBeforeCompile = shadeCaveInterior;
  const foreground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), ground);
  foreground.rotation.x = -Math.PI / 2;
  foreground.position.y = -4.3;
  // The scan is open at its far end. Block the lit ground behind that gap.
  const tunnelBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }),
  );
  tunnelBackdrop.position.set(18, 0, 0);
  tunnelBackdrop.rotation.y = -Math.PI / 2;
  scene.add(foreground, tunnelBackdrop);

  let renderer;
  let disposed = false;
  let ready = false;
  let pickedUp = false;
  let lastWidth;
  let lastHeight;
  function disposeModel(model) {
    const materials = new Set();
    const textures = new Set();
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      materials.add(object.material);
      if (object.material.map) textures.add(object.material.map);
    });
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => {
      texture.dispose();
      texture.image?.close?.();
    });
  }

  const loaded = new GLTFLoader().loadAsync(caveUrl).then(({ scene: model }) => {
    if (disposed) {
      disposeModel(model);
      return;
    }
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (error) {
      disposeModel(model);
      console.warn('The cave entrance could not start.', error);
      return;
    }
    model.scale.setScalar(1 / 30);
    model.traverse((object) => {
      if (!object.isMesh) return;
      object.material.side = THREE.DoubleSide;
      object.material.roughness = 1;
      object.material.metalness = 0;
      object.material.onBeforeCompile = shadeCaveInterior;
    });
    scene.add(model);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.setAttribute('aria-hidden', 'true');
    view.prepend(renderer.domElement);

    // Preserve the destination if the browser loaded a direct section link.
    const scroll = window.scrollY;
    section.hidden = false;
    ready = true;
    if (scroll > 0 || (window.location.hash && window.location.hash !== '#top')) {
      window.scrollTo({ top: scroll + section.offsetHeight, behavior: 'instant' });
    }
    onReady();
  }).catch((error) => console.warn('The cave model could not load.', error));

  return {
    loaded,
    getPosition() {
      if (!ready) return null;
      // Use the entrance's stable scroll length even when mobile browser bars move.
      const length = section.offsetHeight;
      const distance = window.scrollY / length;
      const handoff = THREE.MathUtils.smoothstep(distance, caveRevealStart, caveRevealEnd);
      const approaching = handoff > 0 && handoff < 1;
      // Cancel the document's vertical motion during the approach. The title
      // grows in place and meets its normal document position at the join.
      const remaining = (caveRevealEnd - distance) * length;
      const offset = approaching ? -remaining * (1 - THREE.MathUtils.smoothstep(distance, 0.82, caveRevealEnd)) : 0;
      const depth = approaching ? -1800 * (1 - handoff) : 0;
      project.style.setProperty('--cave-title-transform', approaching
        ? `translateY(${offset}px) perspective(850px) translateZ(${depth}px)`
        : 'none');
      view.style.visibility = handoff === 1 ? 'hidden' : '';
      view.style.opacity = 1 - handoff;
      project.style.setProperty('--cave-page-reveal', handoff);
      project.inert = handoff === 0;
      if (handoff === 1) return null;
      const progress = THREE.MathUtils.clamp(distance / 0.67, 0, 1);
      return { progress, handoff };
    },
    pickUp() {
      pickedUp = true;
    },
    render(progress, x, y, lanternReady) {
      const message = lanternReady && !pickedUp && progress < 0.12
        ? 'Grab the lantern, then scroll'
        : 'Scroll to enter the cave';
      if (instructions.textContent !== message) instructions.textContent = message;
      controls.style.opacity = 1 - THREE.MathUtils.smoothstep(progress, 0.12, 0.55);
      controls.inert = progress >= 0.55;

      const width = view.clientWidth;
      const height = view.clientHeight;
      if (width !== lastWidth || height !== lastHeight) {
        camera.aspect = width / height;
        camera.fov = camera.aspect < 0.85 ? 55 : 47;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        lastWidth = width;
        lastHeight = height;
      }

      const travel = progress * 0.88;
      passage.getPointAt(travel, camera.position);
      passage.getPointAt(Math.min(1, travel + 0.24), lookAhead);
      const exteriorFraming = 1 - THREE.MathUtils.smoothstep(progress, 0, 0.32);
      lookAhead.y += 1.75 * exteriorFraming;
      lookAhead.z -= 0.75 * exteriorFraming;
      camera.lookAt(lookAhead);
      camera.updateMatrixWorld();
      const darkness = THREE.MathUtils.smoothstep(progress, 0.45, 0.95);
      sky.intensity = THREE.MathUtils.lerp(1.35, 0.045, darkness);
      daylight.intensity = 2.4 * (1 - darkness);
      ray.set(x / width * 2 - 1, 1 - y / height * 2, 0.5).unproject(camera)
        .sub(camera.position).normalize();
      torch.position.copy(camera.position).addScaledVector(ray, THREE.MathUtils.lerp(4.4, 1.7, progress));
      torch.intensity = (pickedUp ? 36 : 14) * (0.97 + Math.sin(performance.now() / 110) * 0.03);
      renderer.render(scene, camera);
    },
    dispose() {
      disposed = true;
      section.hidden = true;
      project.style.removeProperty('--cave-page-reveal');
      project.style.removeProperty('--cave-title-transform');
      project.inert = false;
      renderer?.domElement.remove();
      renderer?.dispose();
      disposeModel(scene);
    },
  };
}
