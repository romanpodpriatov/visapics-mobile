import { deletionLabel, hoursLeft, useDraftStore } from '../draft';

const HOUR = 60 * 60 * 1000;

const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async (k: string) => mockStorage[k] ?? null),
  setItem: jest.fn(async (k: string, v: string) => {
    mockStorage[k] = v;
  }),
  removeItem: jest.fn(async (k: string) => {
    delete mockStorage[k];
  }),
}));

describe('draft store', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    useDraftStore.getState().reset();
    useDraftStore.setState({ countryCode: null, documentType: null });
  });

  it('starts with no document chosen', () => {
    expect(useDraftStore.getState().countryCode).toBeNull();
    expect(useDraftStore.getState().documentType).toBeNull();
  });

  it('starts with both processing options on, as the reference draws them', () => {
    expect(useDraftStore.getState().removeBackground).toBe(true);
    expect(useDraftStore.getState().enhance).toBe(true);
  });

  it('remembers the document that was chosen', () => {
    useDraftStore.getState().setSpec('gb', 'UK Passport 35x45 mm');
    expect(useDraftStore.getState().countryCode).toBe('gb');
    expect(useDraftStore.getState().documentType).toBe('UK Passport 35x45 mm');
  });

  it('changes one processing option without disturbing the other', () => {
    useDraftStore.getState().setOption('enhance', false);
    expect(useDraftStore.getState().enhance).toBe(false);
    expect(useDraftStore.getState().removeBackground).toBe(true);
  });

  it('starting a task records when it started, so the card can count down', () => {
    useDraftStore.getState().setTask('task-1');
    expect(useDraftStore.getState().taskId).toBe('task-1');
    expect(useDraftStore.getState().taskStartedAt).toEqual(expect.any(Number));
  });

  it('reset drops the task but keeps the document for the next photo', () => {
    useDraftStore.getState().setSpec('gb', 'UK Passport 35x45 mm');
    useDraftStore.getState().setTask('task-1');

    useDraftStore.getState().reset();

    expect(useDraftStore.getState().taskId).toBeNull();
    expect(useDraftStore.getState().taskStartedAt).toBeNull();
    expect(useDraftStore.getState().countryCode).toBe('gb');
  });

  it('survives a cold start', async () => {
    useDraftStore.getState().setSpec('jp', 'Japan Passport 45x35 mm');
    useDraftStore.getState().setOption('removeBackground', false);
    await useDraftStore.getState().persist();

    useDraftStore.setState({ countryCode: null, documentType: null, removeBackground: true });
    await useDraftStore.getState().hydrate();

    expect(useDraftStore.getState().countryCode).toBe('jp');
    expect(useDraftStore.getState().removeBackground).toBe(false);
  });

  it('finishes hydrating even when nothing was saved', async () => {
    await useDraftStore.getState().hydrate();
    expect(useDraftStore.getState().hydrated).toBe(true);
  });
});

describe('how long the server will keep the photo', () => {
  const startedAt = 1_000_000_000_000;

  it('counts down from the retention the server reports', () => {
    expect(hoursLeft(startedAt, 24, startedAt + 2 * HOUR)).toBe(22);
    expect(hoursLeft(startedAt, 168, startedAt + 2 * HOUR)).toBe(166);
  });

  it('rounds down, so it never promises more time than there is', () => {
    expect(hoursLeft(startedAt, 24, startedAt + 1.5 * HOUR)).toBe(22);
  });

  it('reaches zero once the file is gone', () => {
    expect(hoursLeft(startedAt, 24, startedAt + 40 * HOUR)).toBe(0);
  });

  it('reads in days once hours stop being useful', () => {
    expect(deletionLabel(22)).toBe('22 h');
    expect(deletionLabel(166)).toBe('6 days');
    expect(deletionLabel(48)).toBe('2 days');
  });
});
