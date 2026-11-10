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

  model.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    object.castShadow = !materials.some((material) => material.name === 'glass' || material.name === 'light');
    object.receiveShadow = true;
    for (const material of materials) {
      if (material.name === 'glass') {
        // Transparent canvas cannot refract the HTML behind it. Use clear,
        // translucent glass so the flame remains visible over page content.
        material.transmission = 0;
        material.transparent = true;
        material.opacity = 0.2;
        material.depthWrite = false;
        material.side = THREE.FrontSide;
      }
      if (material.name === 'light') {
        material.emissiveIntensity = 3;
      }
      material.needsUpdate = true;
    }
  });
  return normalized;
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
