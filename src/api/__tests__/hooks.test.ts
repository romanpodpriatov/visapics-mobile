import { api } from '../client';
import {
  configQuery,
  countriesQuery,
  creditsQuery,
  specificationQuery,
  specificationsQuery,
} from '../hooks';

const HOUR = 60 * 60 * 1000;

/** Run a query's fetcher against a spied client and report the path it asked for. */
const pathAsked = async (options: { queryFn?: unknown }) => {
  const get = jest.spyOn(api, 'get').mockResolvedValue(undefined as never);
  await (options.queryFn as () => Promise<unknown>)();
  return get.mock.calls[0][0];
};

describe('query hooks', () => {
  afterEach(() => jest.restoreAllMocks());

  const routes: [string, string, { queryFn?: unknown }][] = [
    ['config', '/config', configQuery()],
    ['countries', '/countries', countriesQuery()],
    ['documents of a country', '/specifications/us', specificationsQuery('us')],
    ['credits', '/credits', creditsQuery()],
  ];

  it.each(routes)('asks for %s at %s', async (_name, path, options) => {
    await expect(pathAsked(options)).resolves.toBe(path);
  });

  it('percent-encodes the document type on its way into the path', async () => {
    // Document names carry spaces and brackets — "US Citizenship
    // (naturalization) 2x2 inch (51x51 mm)" is a real row.
    const options = specificationQuery('us', 'US Citizenship (naturalization) 2x2 inch (51x51 mm)');
    await expect(pathAsked(options)).resolves.toBe(
      '/specifications/us/US%20Citizenship%20(naturalization)%202x2%20inch%20(51x51%20mm)',
    );
  });

  it("keys each country's document list separately", () => {
    expect(specificationsQuery('us').queryKey).not.toEqual(specificationsQuery('gb').queryKey);
  });

  it('caches the catalogue for an hour, because it barely changes', () => {
    expect(configQuery().staleTime).toBe(HOUR);
    expect(countriesQuery().staleTime).toBe(HOUR);
    expect(specificationsQuery('us').staleTime).toBe(HOUR);
    expect(specificationQuery('us', 'Passport').staleTime).toBe(HOUR);
  });

  it('never serves a stale credit balance', () => {
    // A balance that lags a purchase is indistinguishable from being robbed.
    expect(creditsQuery().staleTime).toBe(0);
  });
});
