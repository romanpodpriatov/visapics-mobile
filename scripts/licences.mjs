/**
 * Collect the licences of everything shipped, into assets/licences.json.
 *
 * Several dependencies require attribution, and a missing licences screen is a
 * legitimate complaint. Run after changing dependencies:  node scripts/licences.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const entries = Object.keys(pkg.dependencies ?? {})
  .sort()
  .map((name) => {
    try {
      const meta = JSON.parse(
        readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'),
      );
      return {
        name,
        version: meta.version,
        licence: typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? 'see package'),
        url: meta.homepage ?? meta.repository?.url ?? null,
      };
    } catch {
      return null;
    }
  })
  .filter(Boolean);

writeFileSync(join(root, 'assets', 'licences.json'), `${JSON.stringify(entries, null, 2)}\n`);
console.log(`wrote ${entries.length} licences`);
