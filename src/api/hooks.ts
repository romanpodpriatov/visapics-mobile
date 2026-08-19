/**
 * Every server read the app does, as TanStack Query options.
 *
 * The options factories are exported separately from the hooks so a screen can
 * prefetch one, and so the paths and cache policy can be tested without
 * mounting a component.
 */
import { queryOptions, useQuery } from '@tanstack/react-query';

import { useAuthStore } from '../store/auth';
import { ApiError, api } from './client';
import type { Config, Country, CreditsSummary, Specification, SpecificationSummary } from './types';

/**
 * The catalogue moves when a government changes a rule, which is not something
 * that happens while someone is taking a photo.
 */
const CATALOGUE_STALE_TIME = 60 * 60 * 1000;

const path = (...segments: string[]) => segments.map(encodeURIComponent).join('/');

export const configQuery = () =>
  queryOptions({
    queryKey: ['config'] as const,
    queryFn: () => api.get<Config>('/config'),
    staleTime: CATALOGUE_STALE_TIME,
  });

export const countriesQuery = () =>
  queryOptions({
    queryKey: ['countries'] as const,
    queryFn: () => api.get<Country[]>('/countries'),
    staleTime: CATALOGUE_STALE_TIME,
  });

export const specificationsQuery = (countryCode: string) =>
  queryOptions({
    queryKey: ['specifications', countryCode] as const,
    queryFn: () => api.get<SpecificationSummary[]>(`/specifications/${path(countryCode)}`),
    staleTime: CATALOGUE_STALE_TIME,
  });

export const specificationQuery = (countryCode: string, documentType: string) =>
  queryOptions({
    queryKey: ['specification', countryCode, documentType] as const,
    // Document names carry spaces and brackets, so the segment is encoded.
    queryFn: () => api.get<Specification>(`/specifications/${path(countryCode, documentType)}`),
    staleTime: CATALOGUE_STALE_TIME,
  });

export const creditsQuery = () =>
  queryOptions({
    queryKey: ['credits'] as const,
    queryFn: () => api.get<CreditsSummary>('/credits'),
    // Deliberately not cached: a balance that lags a purchase is
    // indistinguishable, from the user's side, from being robbed.
    staleTime: 0,
  });

/**
 * What is worth trying again.
 *
 * Anything under 500 is an answer the server meant — no credits, not yours,
 * already gone — and repeating it only delays the screen that has to say so.
 * A 5xx or a dropped connection is worth two more attempts.
 */
export const retryPolicy = (failureCount: number, error: unknown): boolean => {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
};

export const useConfig = () => useQuery(configQuery());
export const useCountries = () => useQuery(countriesQuery());
/** The documents of one country, once a country has been chosen. */
export const useSpecifications = (countryCode: string) =>
  useQuery({ ...specificationsQuery(countryCode), enabled: countryCode.length > 0 });
export const useSpecification = (countryCode: string, documentType: string) =>
  useQuery(specificationQuery(countryCode, documentType));
/**
 * The balance, once there is a session to ask with. Before then the call is a
 * guaranteed 401, and several of those at launch is how a refresh token gets
 * burned for nothing.
 */
export const useCredits = () => {
  const hasSession = useAuthStore((s) => s.accessToken !== null);
  return useQuery({ ...creditsQuery(), enabled: hasSession });
};
