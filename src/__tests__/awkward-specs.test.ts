/**
 * The formatting rules, run against the specifications that actually break
 * them. Every fixture here is a real response from
 * https://visapics.org/api/v1/specifications/<country>/<document>:
 *
 *   un/…UCard        the one specification of 951 that states no head height
 *   gb/UK Passport online   head height as a single share, not a band
 *   ca/Canada Passport      50×70 mm, the unusual size
 *   ae/Emirates ID / …      a name with a slash in it
 *
 * A simulator shows three documents. This shows the four that go wrong.
 */
import type { Specification } from '../api/types';
import { buildRules, buildSpecRows } from '../format';

import fixtures from './fixtures/awkward-specifications.json';

const specs = Object.entries(fixtures as Record<string, Specification>);

describe('the awkward specifications', () => {
  it('covers all four', () => {
    expect(specs).toHaveLength(4);
  });

  it.each(specs)('%s renders no blank measurement', (_name, spec) => {
    for (const row of buildSpecRows(spec)) {
      expect(row.value).not.toMatch(/undefined|NaN|null/);
      expect(row.value.trim()).not.toBe('');
    }
  });

  it.each(specs)('%s states rules only in its own words', (_name, spec) => {
    for (const rule of buildRules(spec)) {
      expect(rule.body).not.toMatch(/undefined|NaN|null/);
    }
  });

  it('says a single head height once, not as a band of one', () => {
    const online = (fixtures as Record<string, Specification>)['gb/UK Passport online'];
    const headHeight = buildSpecRows(online).find((r) => r.label === 'Head height');
    expect(headHeight?.value).toBe('35 mm'); // 0.55 × 63.5 mm
  });

  it('admits when a document states no head height at all', () => {
    const ucard = (fixtures as Record<string, Specification>)[
      'un/University of Bristol UCard 390x520 px'
    ];
    const headHeight = buildSpecRows(ucard).find((r) => r.label === 'Head height');
    expect(headHeight?.value).toBe('not specified');
  });
});
