# The Allegory of the Cave: CIM220 Project 2

This is our project site, built with HTML, CSS, JavaScript, Three.js and GSAP. Vite runs the local development server and builds the website.

## Open it

Install Node.js LTS, then open this folder in WebStorm. In its terminal, run:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal to see the lantern orbit the title. As you scroll, it travels to the nearest title or image and orbits that stop. Each trip finishes even if you stop scrolling. Scroll up to return to earlier stops. Changes to the files update the browser while the server is running. Press Ctrl+C in the terminal to stop it.

## Change things

- `index.html`: the page sections and text.
- `styles.css`: colours and layout.
- `script.js`: the Three.js scene, lantern, lighting and GSAP motion. Try changing the material's `color` or the animation's `duration`.
- `navigation.js`: tracks the current section and slides one persistent underline between navigation links as you scroll.
- `scrolling.js`: Lenis smooths mouse-wheel scrolling and navigation jumps on GSAP's animation loop. Touch scrolling stays native. Adjust `lerp` (currently `0.12`) for a tighter response (higher) or a longer glide (lower).

The lantern has an animated warm key light, subtle torch flicker, a cool fill light and a transparent plane that receives its cast shadow. Adjust `lightIntensity` and `shadowOpacity` at the top of `script.js`. The lighting and shadow follow the lantern between titles; HTML elements are not 3D shadow receivers.

`lantern.js` tunes the copper and transmissive glass, adds a white-hot flame core, a local soft emissive halo and a point light at the flame. `updateLanternFire` synchronizes the internal light, emission, halo and subtle flame motion. The halo gives a localized bloom-like effect without post-processing the HTML. ACES tone mapping controls bright highlights. Glass refracts the 3D scene and reflects the environment; it does not refract HTML content behind the canvas.

The page uses dark backgrounds and a fixed radial lighting overlay that reveals the HTML around the lantern. Adjust `lanternLightRadius` and `pageDarkness` in `script.js` to tune the illuminated area and ambient darkness. The overlay follows the lantern in viewport coordinates, leaves links clickable, and activates after the model loads. Navigation stays above the overlay.

`page-shadows.js` projects text shadows and rectangular image shadows away from the lantern. Change `elevation`, `blur`, or the opacity multiplier there to tune their length, softness and darkness. Positions are cached on layout changes. Objects within photographs do not cast separate shadows.

The example photos are from Unsplash. Replace their image links and credits with our own project images when they’re ready.

`#animation-stage` is a transparent fixed overlay. All `main h1`, `main h2` and `main img` elements are destinations, in document order. Image orbits sweep over the photograph to illuminate it. Scroll selects the stop nearest 40% down the viewport, with a small margin to prevent flickering between destinations. GSAP completes each move independently of further scrolling. Edit `travelDuration`, `orbitDuration` and `titleClearance` in `script.js` to tune the motion. The titles and images use CSS layer 2; the lantern stays in front on layer 3 throughout its orbit. Stop positions are measured again when the layout resizes.

## Build

The browser loads `assets/lantern.glb`, exported from `assets/lantern.blend` with its textures embedded. `lantern.js` loads and normalizes it and adapts its glass for the transparent website canvas. After editing the Blender source, extract `assets/textures.rar` into `assets/` if needed, then run `blender --background --python scripts/export-lantern.py` to regenerate the GLB. The original Blender file is preserved.

Run `npm run build` to create the production site in `dist/`, then `npm run preview` to check it locally. Hosting must publish the built `dist/` folder rather than the source files. A GitHub Pages project deployment also needs Vite's base path configured for the repository URL.

Commit `package.json` and `package-lock.json` so teammates can run `npm install`. The `.gitignore` excludes `node_modules/` and `dist/`.
