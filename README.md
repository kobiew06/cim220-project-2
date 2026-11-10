# The Allegory of the Cave: CIM220 Project 2

This is our project site, built with HTML, CSS, JavaScript, Three.js and GSAP. Vite runs the local development server and builds the website.

## Open it

Install Node.js LTS, then open this folder in WebStorm. In its terminal, run:

```sh
npm install
npm run dev
```

Open the local URL printed in the terminal to see the cube automatically orbit the main title, alternating in front of and behind the text. Changes to the files update the browser while the server is running. Press Ctrl+C in the terminal to stop it.

## Change things

- `index.html`: the page sections and text.
- `styles.css`: colours and layout.
- `script.js`: the Three.js scene, cube, lighting and GSAP rotation. Try changing the material's `color` or the animation's `duration`.

The example photos are from Unsplash. Replace their image links and credits with our own project images when they’re ready.

`#animation-stage` is a transparent overlay inside `.intro-heading`. The title uses CSS layer 2; the cube's canvas switches between layers 1 and 3 during its orbit. This switches the entire cube's layer rather than intersecting individual letters in 3D. Its orbit resizes with the heading.

## Build

Run `npm run build` to create the production site in `dist/`, then `npm run preview` to check it locally. Hosting must publish the built `dist/` folder rather than the source files. A GitHub Pages project deployment also needs Vite's base path configured for the repository URL.

Commit `package.json` and `package-lock.json` so teammates can run `npm install`. The `.gitignore` excludes `node_modules/` and `dist/`.
