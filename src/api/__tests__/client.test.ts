import { ApiError, REFRESH_URL, api } from '../client';
import { useAuthStore } from '../../store/auth';

/** The `{success, data}` envelope every /api/v1 route returns. */
const ok = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data }),
  } as Response);

/** Any other body, verbatim — the site has more than one error shape. */
const raw = (status: number, body: unknown) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);

const fail = (status: number, code: string, message = 'nope', extra: object = {}) =>
  raw(status, { success: false, error: { code, message, ...extra } });

const headersOf = (call: [unknown, RequestInit?]) =>
  (call[1]?.headers ?? {}) as Record<string, string>;

describe('api client', () => {
  beforeEach(() =>
    useAuthStore.setState({ accessToken: null, refreshToken: null }),
  );
  afterEach(() => jest.restoreAllMocks());

  it('unwraps the success envelope', async () => {
    jest.spyOn(globalThis, 'fetch').mockReturnValue(ok({ credits_remaining: 3 }) as never);
    await expect(api.get('/credits')).resolves.toEqual({ credits_remaining: 3 });
  });

  it('throws ApiError carrying status and code', async () => {
    jest.spyOn(globalThis, 'fetch').mockReturnValue(fail(402, 'E402_NO_CREDITS') as never);
    await expect(api.get('/credits')).rejects.toMatchObject({
      status: 402,
      code: 'E402_NO_CREDITS',
    });
  });

  it('keeps the rest of the error body, which is where the 402 carries its products', async () => {
    const products = [{ product_id: 'org.visapics.app.photo.single', credits: 1 }];
    jest
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(fail(402, 'E402_NO_CREDITS', 'No photo credits', { products }) as never);
    await expect(api.post('/photo/abc/unlock')).rejects.toMatchObject({
      data: { products },
    });
  });

  it('reads the message out of a bare {error: "..."} body', async () => {
    // What an unauthenticated /api/v1 call really returns: the JWT layer
    // answers before the blueprint's error handler can wrap it.
    jest
      .spyOn(globalThis, 'fetch')
      .mockReturnValue(raw(401, { error: 'Authentication required' }) as never);
    await expect(api.get('/credits')).rejects.toMatchObject({
      status: 401,
      message: 'Authentication required',
    });
  });

  it('sends the bearer token when a session exists', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockReturnValue(ok({}) as never);
    useAuthStore.setState({ accessToken: 'tok-123' });
    await api.get('/credits');
    expect(headersOf(spy.mock.calls[0] as never).Authorization).toBe('Bearer tok-123');
  });

  it('refreshes once on 401 and replays the request', async () => {
    useAuthStore.setState({ accessToken: 'stale', refreshToken: 'refresh-1' });
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(fail(401, 'E401') as never)
      // /auth/refresh answers bare, outside the /api/v1 envelope.
      .mockReturnValueOnce(raw(200, { access_token: 'fresh' }) as never)
      .mockReturnValueOnce(ok({ credits_remaining: 5 }) as never);

    await expect(api.get('/credits')).resolves.toEqual({ credits_remaining: 5 });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(useAuthStore.getState().accessToken).toBe('fresh');
    expect(headersOf(spy.mock.calls[2] as never).Authorization).toBe('Bearer fresh');
  });

  it('sends the refresh token, not the access token, to the refresh endpoint', async () => {
    // /auth/refresh is jwt_required(refresh=True): an access token there is a
    // 422 that reads to the user as being signed out for no reason.
    useAuthStore.setState({ accessToken: 'stale', refreshToken: 'refresh-1' });
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(fail(401, 'E401') as never)
      .mockReturnValueOnce(raw(200, { access_token: 'fresh' }) as never)
      .mockReturnValueOnce(ok({}) as never);

    await api.get('/credits');
    expect(spy.mock.calls[1][0]).toBe(REFRESH_URL);
    expect(headersOf(spy.mock.calls[1] as never).Authorization).toBe('Bearer refresh-1');
  });

  it('keeps the refresh token when the server sends no replacement', async () => {
    useAuthStore.setState({ accessToken: 'stale', refreshToken: 'refresh-1' });
    jest
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(fail(401, 'E401') as never)
      .mockReturnValueOnce(raw(200, { access_token: 'fresh' }) as never)
      .mockReturnValueOnce(ok({}) as never);

    await api.get('/credits');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-1');
  });

  it('refreshes once for several requests that 401 in the same tick', async () => {
    // Three screens mount together, all three 401. A refresh each would burn
    // the token and sign the user out mid-flow.
    useAuthStore.setState({ accessToken: 'stale', refreshToken: 'refresh-1' });
    const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(((url: string, init: RequestInit) => {
      if (url === REFRESH_URL) return raw(200, { access_token: 'fresh' });
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer fresh' ? ok({ n: 1 }) : fail(401, 'E401');
    }) as never);

    await Promise.all([api.get('/credits'), api.get('/usage'), api.get('/config')]);
    expect(spy.mock.calls.filter((c: unknown[]) => c[0] === REFRESH_URL)).toHaveLength(1);
  });

  it('does not loop when the refresh itself fails', async () => {
    useAuthStore.setState({ accessToken: 'stale', refreshToken: 'refresh-1' });
    const spy = jest
      .spyOn(globalThis, 'fetch')
      .mockReturnValueOnce(fail(401, 'E401') as never)
      .mockReturnValueOnce(raw(401, { msg: 'Token has expired' }) as never);

    await expect(api.get('/credits')).rejects.toBeInstanceOf(ApiError);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('does not try to refresh when there is no refresh token', async () => {
    const spy = jest.spyOn(globalThis, 'fetch').mockReturnValue(fail(401, 'E401') as never);
    await expect(api.get('/credits')).rejects.toBeInstanceOf(ApiError);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('never sends credentials to a host other than visapics.org', async () => {
    // Guards against a redirect or a mistyped path leaking a bearer token.
    const spy = jest.spyOn(globalThis, 'fetch').mockReturnValue(ok({}) as never);
    await expect(api.get('https://evil.example/steal')).rejects.toThrow(/absolute/);
    expect(spy).not.toHaveBeenCalled();
  });
});
