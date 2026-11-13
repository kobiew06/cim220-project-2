import './page/scrolling.js';
import './page/navigation.js';
import './page/typography.js';
import { startLanternExperience } from './lantern/experience.js';

const experience = startLanternExperience();
const revealPage = () => requestAnimationFrame(() => {
  document.documentElement.classList.remove('is-loading');
});

if (experience) {
  experience.loaded.then(revealPage);
  import.meta.hot?.dispose(experience.dispose);
} else {
  revealPage();
}
