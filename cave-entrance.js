import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import caveUrl from './assets/cave.glb?url';

export function createCaveEntrance(onReady) {
  const section = document.querySelector('.cave-entrance');
  const view = section.querySelector('.cave-view');
  const instructions = section.querySelector('.cave-instructions');
  const controls = instructions.parentElement;
  const project = document.querySelector('#project');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#252d31');
  scene.fog = new THREE.FogExp2(scene.background, 0.033);
  const outsideColor = scene.background.clone();
  const insideColor = new THREE.Color('#0a0a08');
  const camera = new THREE.PerspectiveCamera(47, 1, 0.08, 85);
  const sky = new THREE.HemisphereLight(0xa1c0d4, 0x51412c, 1.35);
  const daylight = new THREE.DirectionalLight(0xcbdaf1, 2.4);
  daylight.position.set(-9, 14, -20);
  const torch = new THREE.PointLight(0xffa34c, 16, 16);
  const ray = new THREE.Vector3();
  scene.add(sky, daylight, torch);

  const stone = new THREE.MeshStandardMaterial({ color: 0x68645a, roughness: 1, side: THREE.DoubleSide });
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
      `float depthInside = smoothstep(-24.0, -14.0, cavePosition.z);
      float chamber = depthInside
        * (1.0 - smoothstep(mix(2.0, 8.0, depthInside), mix(6.5, 13.0, depthInside), abs(cavePosition.x)))
        * (1.0 - smoothstep(mix(1.5, 7.5, depthInside), mix(5.5, 12.0, depthInside), cavePosition.y));
      float daylightExposure = mix(1.0, 0.09, chamber);
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
  stone.onBeforeCompile = shadeCaveInterior;
  ground.onBeforeCompile = shadeCaveInterior;
  const foreground = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), ground);
  foreground.rotation.x = -Math.PI / 2;
  foreground.position.y = -2.02;
  scene.add(foreground);

  let renderer;
  let disposed = false;
  let ready = false;
  let pickedUp = false;
  let lastWidth;
  let lastHeight;
  const disposeModel = (model) => model.traverse((object) => {
    if (object.isMesh) object.geometry.dispose();
  });

  new GLTFLoader().loadAsync(caveUrl).then(({ scene: model }) => {
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
    const materials = new Set();
    model.traverse((object) => {
      if (!object.isMesh) return;
      materials.add(object.material);
      object.material = object.name === 'Ground' ? ground : stone;
    });
    materials.forEach((material) => material.dispose());
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
    getPosition() {
      if (!ready) return null;
      // Use the entrance's stable scroll length even when mobile browser bars move.
      const length = section.offsetHeight;
      const distance = window.scrollY / length;
      const revealStart = 0.56;
      const join = 0.88;
      const handoff = THREE.MathUtils.smoothstep(distance, revealStart, join);
      const approaching = handoff > 0 && handoff < 1;
      // Cancel the document's vertical motion during the approach. The title
      // grows in place and meets its normal document position at the join.
      const remaining = (join - distance) * length;
      const offset = approaching ? -remaining * (1 - THREE.MathUtils.smoothstep(distance, 0.82, join)) : 0;
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

      // The passage opens toward negative Z, slightly below the exterior eye line.
      camera.position.set(
        THREE.MathUtils.lerp(-0.45, -0.2, progress),
        THREE.MathUtils.lerp(1.2, -0.65, THREE.MathUtils.smoothstep(progress, 0, 0.55)),
        THREE.MathUtils.lerp(camera.aspect < 0.85 ? -46 : -37, -8, progress),
      );
      camera.lookAt(-0.2, -0.65, 1);
      camera.updateMatrixWorld();
      const darkness = THREE.MathUtils.smoothstep(progress, 0.45, 0.95);
      sky.intensity = THREE.MathUtils.lerp(1.35, 0.045, darkness);
      daylight.intensity = 2.4 * (1 - darkness);
      scene.background.copy(outsideColor).lerp(insideColor, darkness);
      scene.fog.color.copy(scene.background);
      ray.set(x / width * 2 - 1, 1 - y / height * 2, 0.5).unproject(camera)
        .sub(camera.position).normalize();
      torch.position.copy(camera.position).addScaledVector(ray, THREE.MathUtils.lerp(8, 2.8, progress));
      torch.intensity = (pickedUp ? 40 : 12) * (0.97 + Math.sin(performance.now() / 110) * 0.03);
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
      stone.dispose();
      ground.dispose();
    },
  };
}
