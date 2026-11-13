import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const lightIntensity = 3.5;

export function createLanternStage(element) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  } catch (error) {
    console.warn('The lantern preview could not start.', error);
    return null;
  }

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
  element.replaceChildren(renderer.domElement);
  const lightOffset = new THREE.Vector3();
  const fillOffset = new THREE.Vector3();

  function updateLighting({ x, y, width, renderHeight, origin, size, phase }) {
    lantern.position.set(x - width / 2, renderHeight / 2 - (y - origin), 0);
    lantern.rotation.set(Math.sin(phase) * 0.08, 0.45 + Math.sin(phase) * 0.7, Math.sin(phase) * 0.12);
    lantern.scale.setScalar(size);
    // Keep the lighting rig with the lantern as it travels between headings.
    light.target.position.copy(lantern.position);
    light.position.copy(lantern.position).add(lightOffset.set(
      Math.cos(phase) * size * 3,
      (2.7 + Math.sin(phase) * 0.8) * size,
      size * 4,
    ));
    light.intensity = lightIntensity * (
      1 + Math.sin(phase * 31) * 0.045 + Math.sin(phase * 47) * 0.025
    );
    fill.target.position.copy(lantern.position);
    fill.position.copy(lantern.position).add(fillOffset.set(-size * 3, -size, size * 2));
    return light.intensity / lightIntensity;
  }

  return {
    lantern,
    scene,
    setWidth(width, pixelRatio) {
      camera.left = -width / 2;
      camera.right = width / 2;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(pixelRatio);
    },
    resize(width, height) {
      camera.top = height / 2;
      camera.bottom = -height / 2;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
    updateLighting,
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      reflections.dispose();
      light.shadow.dispose();
      renderer.dispose();
      element.replaceChildren();
    },
  };
}
