import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export async function loadLantern() {
  const url = new URL('./assets/lantern.glb', import.meta.url).href;
  const gltf = await new GLTFLoader().loadAsync(url);
  const model = gltf.scene;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  model.position.sub(sphere.center);
  const normalized = new THREE.Group();
  normalized.add(model);
  // Fit inside the same bounding sphere used for the title clearance.
  normalized.scale.setScalar(0.85 / Math.max(sphere.radius, 0.001));
  let flame;

  model.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.castShadow = !materials.some((material) => material.name === 'glass' || material.name === 'light');
    object.receiveShadow = true;
    for (const material of materials) {
      if (material.name === 'glass') {
        // Transmission refracts the 3D flame and frame; the HTML remains a
        // separate compositing layer. Reflections come from the environment.
        material.color.set(0xfff7e9);
        material.metalness = 0;
        material.metalnessMap = null;
        material.roughness = 0.07;
        material.roughnessMap = null;
        material.transmission = 0.92;
        material.thickness = 0.08;
        material.ior = 1.46;
        material.clearcoat = 1;
        material.clearcoatRoughness = 0.06;
        material.envMapIntensity = 1.3;
        material.transparent = true;
        material.opacity = 1;
        material.depthWrite = false;
        material.side = THREE.FrontSide;
      }
      if (material.name.startsWith('copper')) {
        material.color.set(0xb77a4e);
        material.metalness = 0.9;
        material.roughness = 0.28;
        material.envMapIntensity = 0.85;
      }
      if (material.name === 'light') {
        material.color.set(0xffa326);
        material.emissive.set(0xffad32);
        material.emissiveIntensity = 4;
        flame = object;
      }
      material.needsUpdate = true;
    }
  });
  if (flame) {
    // A small hot core sits inside the existing flame silhouette.
    const core = new THREE.Mesh(flame.geometry, new THREE.MeshBasicMaterial({
      color: 0xfff3c0, toneMapped: false,
    }));
    core.scale.set(0.48, 0.78, 0.48);
    flame.add(core);

    // A local emissive halo keeps the transparent page canvas intact, rather
    // than blooming the entire website or turning its background opaque.
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(255, 244, 185, 1)');
    gradient.addColorStop(0.12, 'rgba(255, 206, 92, .8)');
    gradient.addColorStop(0.35, 'rgba(255, 139, 30, .24)');
    gradient.addColorStop(1, 'rgba(255, 100, 10, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      color: 0xffc46d,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
    }));
    // Place both light and halo at the flame's actual centre in model space.
    model.updateWorldMatrix(true, true);
    flame.geometry.computeBoundingBox();
    const centre = flame.geometry.boundingBox.getCenter(new THREE.Vector3());
    flame.localToWorld(centre);
    model.worldToLocal(centre);
    halo.position.copy(centre);
    halo.scale.set(1.8, 2.4, 1);
    halo.renderOrder = 10;
    const fireLight = new THREE.PointLight(0xffa13e, 1, 0, 2);
    fireLight.position.copy(centre);
    model.add(halo, fireLight);
    normalized.userData.fire = {
      flame, core, halo, light: fireLight, baseScale: flame.scale.clone(),
    };
  }
  return normalized;
}

export function updateLanternFire(model, seconds, size) {
  const fire = model.userData.fire;
  if (!fire) return;
  const flicker = 1 + Math.sin(seconds * 11) * 0.055 + Math.sin(seconds * 17.3) * 0.035;
  fire.light.intensity = size * size * 0.65 * flicker;
  fire.flame.scale.copy(fire.baseScale);
  fire.flame.scale.y *= 1 + Math.sin(seconds * 8.7) * 0.045;
  const materials = Array.isArray(fire.flame.material) ? fire.flame.material : [fire.flame.material];
  materials.forEach((material) => { material.emissiveIntensity = 4 * flicker; });
  fire.halo.material.opacity = 0.65 * flicker;
}

export function disposeLantern(model) {
  const resources = new Set();
  model.traverse((object) => {
    if (object.geometry) resources.add(object.geometry);
    const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : [];
    for (const material of materials) {
      resources.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) resources.add(value);
      }
    }
  });
  resources.forEach((resource) => resource.dispose());
}
