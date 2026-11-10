# The Allegory of the Cave: CIM220 Project 2

This is our project site, built with HTML, CSS, JavaScript, Three.js and GSAP. Vite runs the local development server and builds the website.

## Open it

Install Node.js LTS, then open this folder in WebStorm. In its terminal, run:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal to see the cube orbit the title. As you scroll, it travels to the nearest section title and orbits that heading. Each trip finishes even if you stop scrolling. Scroll up to return to earlier headings. Changes to the files update the browser while the server is running. Press Ctrl+C in the terminal to stop it.

## Change things

- `index.html`: the page sections and text.
- `styles.css`: colours and layout.
- `script.js`: the Three.js scene, cube, lighting and GSAP rotation. Try changing the material's `color` or the animation's `duration`.

The cube has an animated warm key light, subtle torch flicker, a cool fill light and a transparent plane that receives its cast shadow. Adjust `lightIntensity` and `shadowOpacity` at the top of `script.js`. The lighting and shadow follow the cube between titles; HTML elements are not 3D shadow receivers.

The example photos are from Unsplash. Replace their image links and credits with our own project images when they’re ready.

`#animation-stage` is a transparent fixed overlay. All `main h1` and `main h2` headings are destinations. Scroll selects the heading nearest 40% down the viewport, with a small margin to prevent flickering between destinations. GSAP completes each move independently of further scrolling. Edit `travelDuration`, `orbitDuration` and `titleClearance` in `script.js` to tune the motion. The titles and images use CSS layer 2; the cube switches between layers 1 and 3. This switches the entire cube's layer rather than intersecting individual letters in 3D. Heading positions are measured again when the layout resizes.

## Build

Run `npm run build` to create the production site in `dist/`, then `npm run preview` to check it locally. Hosting must publish the built `dist/` folder rather than the source files. A GitHub Pages project deployment also needs Vite's base path configured for the repository URL.

Commit `package.json` and `package-lock.json` so teammates can run `npm install`. The `.gitignore` excludes `node_modules/` and `dist/`.
