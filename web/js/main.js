/** Likeness — boot: find out which studio is speaking, then open the catalogue. */
import { register, start } from './core/router.js';
import { connect } from './studio/studio.js';
import { catalogue } from './screens/catalogue.js';
import { sitting } from './screens/sitting.js';
import { developing } from './screens/developing.js';
import { reveal } from './screens/reveal.js';
import { lab } from './screens/lab.js';
import { drawer } from './screens/drawer.js';

await connect();
register('catalogue', catalogue);
register('sitting', sitting);
register('developing', developing);
register('reveal', reveal);
register('lab', lab);
register('drawer', drawer);
await start();
