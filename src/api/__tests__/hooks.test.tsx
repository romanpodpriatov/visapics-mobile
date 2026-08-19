import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { ApiError, api } from '../client';
import {
  configQuery,
  countriesQuery,
  creditsQuery,
  retryPolicy,
  specificationQuery,
  specificationsQuery,
  useCredits,
  useSpecifications,
} from '../hooks';
import { useAuthStore } from '../../store/auth';

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

describe('retrying', () => {
  it('gives up at once on an answer the server meant', () => {
    // A 402 is not a glitch. Retrying it three times delays the paywall.
    expect(retryPolicy(0, new ApiError('No credits', 402, 'E402_NO_CREDITS'))).toBe(false);
    expect(retryPolicy(0, new ApiError('Gone', 410, 'E410_EXPIRED'))).toBe(false);
  });

  it('retries a server fault, twice', () => {
    const boom = new ApiError('Server error', 500, 'E500');
    expect(retryPolicy(0, boom)).toBe(true);
    expect(retryPolicy(1, boom)).toBe(true);
    expect(retryPolicy(2, boom)).toBe(false);
  });

  it('retries a connection that dropped', () => {
    expect(retryPolicy(0, new TypeError('Network request failed'))).toBe(true);
  });
});

describe('useCredits', () => {
  // One client for the suite: a new one per render remounts the provider on
  // every pass and spins.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  afterEach(() => jest.restoreAllMocks());

  it('does not ask for a country\'s documents before a country is chosen', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useSpecifications(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not ask for a balance before there is a session', () => {
    // Without a session the call is a guaranteed 401, and a 401 storm at
    // launch is how a refresh token gets burned.
    useAuthStore.setState({ accessToken: null });
    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const { result } = renderHook(() => useCredits(), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
