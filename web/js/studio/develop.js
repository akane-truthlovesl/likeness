/** One door to whichever studio is speaking. House sitters are showcase specimens in every edition. */
import { studio } from './studio.js';
import * as showcase from './showcase.js';
import * as live from './live.js';

const local = sitting => !studio.live || sitting.source === 'house';

/** @returns {AsyncGenerator<any>} */
export const develop = (sitting, worldId, recipe = 'locked') => (local(sitting) ? showcase.develop(sitting, worldId, recipe) : live.develop(sitting, worldId, recipe));
export const compare = (sitting, worldId, portrait) => (local(sitting) || portrait.mode === 'showcase' ? showcase.compare(sitting, worldId) : live.compare(sitting, worldId, portrait));
