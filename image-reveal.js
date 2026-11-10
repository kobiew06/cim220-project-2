import * as THREE from 'three';

// A lantern-driven two-image reveal, inspired by the interaction in
// https://codepen.io/DenDionigi/pen/YzOZxeR. Shader implemented for this scene.
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragmentShader = `
  uniform sampler2D uBase;
  uniform sampler2D uHidden;
  uniform vec2 uBaseCrop;
  uniform vec2 uHiddenCrop;
  uniform vec2 uSize;
  uniform vec2 uLight;
  uniform float uTime;
  uniform float uRadius;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    vec2 blend = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), blend.x),
               mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), blend.x), blend.y);
  }
  void main() {
    vec2 pixel = vUv * uSize;
    vec2 delta = pixel - uLight;
    float distanceToLight = length(delta);
    float turbulence = noise(pixel * 0.025 + vec2(uTime * 0.28, -uTime * 0.19));
    float detail = noise(pixel * 0.065 - uTime * 0.15);
    float edge = distanceToLight + (turbulence - 0.5) * 38.0 + (detail - 0.5) * 12.0;
    float reveal = 1.0 - smoothstep(uRadius * 0.65, uRadius, edge);
    // Distort the transition ring, leaving the revealed centre easy to read.
    float rim = reveal * (1.0 - reveal) * 4.0;
    vec2 direction = delta / max(distanceToLight, 1.0);
    vec2 displacement = direction * (turbulence - 0.5) * 20.0 * rim / uSize;
    vec2 baseUv = (vUv + displacement - 0.5) * uBaseCrop + 0.5;
    vec2 hiddenUv = (vUv - displacement - 0.5) * uHiddenCrop + 0.5;
    vec4 base = texture2D(uBase, clamp(baseUv, 0.001, 0.999));
    vec4 hidden = texture2D(uHidden, clamp(hiddenUv, 0.001, 0.999));
    gl_FragColor = mix(base, hidden, reveal);
    #include <colorspace_fragment>
  }
`;

function coverCrop(texture, width, height) {
  const imageAspect = texture.image.width / texture.image.height;
  const boxAspect = width / height;
  return imageAspect > boxAspect
    ? new THREE.Vector2(boxAspect / imageAspect, 1)
    : new THREE.Vector2(1, imageAspect / boxAspect);
}

export function createImageReveals(scene) {
  const loader = new THREE.TextureLoader();
  const entries = [...document.querySelectorAll('main img[data-reveal-src]')].map((image) => ({
    image, originalOpacity: image.style.opacity, mesh: null, shadow: null, textures: [], rect: null,
  }));
  let disposed = false;
  const measureEntry = (entry) => {
    const rect = entry.image.getBoundingClientRect();
    entry.rect = { left: rect.left, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
    if (!entry.mesh || !rect.width || !rect.height) return;
    const uniforms = entry.mesh.material.uniforms;
    uniforms.uSize.value.set(rect.width, rect.height);
    uniforms.uRadius.value = Math.min(190, Math.max(100, rect.width * 0.22));
    uniforms.uBaseCrop.value.copy(coverCrop(entry.textures[0], rect.width, rect.height));
    uniforms.uHiddenCrop.value.copy(coverCrop(entry.textures[1], rect.width, rect.height));
    entry.mesh.scale.set(rect.width, rect.height, 1);
    if (entry.shadow) Object.assign(entry.shadow.style, {
      left: `${entry.image.offsetLeft}px`, top: `${entry.image.offsetTop}px`,
      width: `${rect.width}px`, height: `${rect.height}px`,
    });
  };

  for (const entry of entries) {
    const load = async (url) => {
      const texture = await loader.loadAsync(url);
      texture.colorSpace = THREE.SRGBColorSpace;
      if (disposed) texture.dispose();
      else entry.textures.push(texture);
      return texture;
    };
    // Load in sequence so texture order stays deterministic and failures can
    // dispose everything without hiding the original HTML fallback image.
    (async () => {
      const base = await load(entry.image.currentSrc || entry.image.src);
      if (disposed) return;
      const hidden = await load(entry.image.dataset.revealSrc);
      if (disposed) return;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          uBase: { value: base }, uHidden: { value: hidden },
          uBaseCrop: { value: new THREE.Vector2(1, 1) },
          uHiddenCrop: { value: new THREE.Vector2(1, 1) },
          uSize: { value: new THREE.Vector2(1, 1) },
          uLight: { value: new THREE.Vector2(-10000, -10000) },
          uTime: { value: 0 }, uRadius: { value: 150 },
        },
        vertexShader, fragmentShader, toneMapped: false, depthWrite: false,
      });
      entry.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      entry.mesh.position.z = -300;
      entry.mesh.renderOrder = -10;
      scene.add(entry.mesh);
      // Retain the photograph's moving CSS shadow when its HTML pixels are
      // replaced by the shader. The caption and its links remain normal HTML.
      entry.shadow = document.createElement('span');
      entry.shadow.className = 'image-reveal-shadow';
      entry.shadow.setAttribute('aria-hidden', 'true');
      entry.image.parentElement.append(entry.shadow);
      measureEntry(entry);
      entry.image.style.opacity = '0';
    })().catch((error) => {
      entry.textures.forEach((texture) => texture.dispose());
      entry.textures = [];
      if (!disposed) console.warn('Image reveal unavailable; keeping the original photo.', error);
    });
  }

  return {
    measure() { entries.forEach(measureEntry); },
    update(lightX, lightY, time, width, height, origin = window.scrollY) {
      for (const entry of entries) {
        if (!entry.mesh || !entry.rect) continue;
        const rect = entry.rect;
        const top = rect.top - origin;
        entry.mesh.visible = top + rect.height >= 0 && top <= height;
        if (!entry.mesh.visible) continue;
        entry.shadow.style.boxShadow = entry.image.style.getPropertyValue('--lantern-cast-shadow');
        entry.mesh.position.set(rect.left + rect.width / 2 - width / 2, height / 2 - top - rect.height / 2, -300);
        const uniforms = entry.mesh.material.uniforms;
        uniforms.uLight.value.set(lightX - rect.left, rect.height - (lightY - rect.top));
        uniforms.uTime.value = time;
      }
    },
    dispose() {
      disposed = true;
      for (const entry of entries) {
        entry.image.style.opacity = entry.originalOpacity;
        entry.shadow?.remove();
        if (entry.mesh) {
          scene.remove(entry.mesh);
          entry.mesh.geometry.dispose();
          entry.mesh.material.dispose();
        }
        entry.textures.forEach((texture) => texture.dispose());
      }
    },
  };
}
