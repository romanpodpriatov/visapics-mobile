/**
 * The photo being made right now: which document it is for, how it should be
 * processed, and the server task it became.
 *
 * It survives a cold start because the reference's "Continue" card promises
 * that it does — someone who closes the app on the train expects to find their
 * photo when they open it again.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const DRAFT_KEY = 'visapics.draft';

type Saved = {
  countryCode: string | null;
  documentType: string | null;
  removeBackground: boolean;
  enhance: boolean;
  taskId: string | null;
  taskStartedAt: number | null;
  /**
   * When this photo was paid for. The status endpoint cannot say: it reports
   * the mode the task ran in, which stays "preview" for ever. Unlocking again
   * is free and idempotent on the server, so this only has to be good enough
   * to know whether anyone has paid yet.
   */
  unlockedAt: number | null;
};

type DraftState = Saved & {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  persist: () => Promise<void>;
  setSpec: (countryCode: string, documentType: string) => void;
  setOption: (option: 'removeBackground' | 'enhance', value: boolean) => void;
  setTask: (taskId: string | null) => void;
  markUnlocked: () => void;
  reset: () => void;
};

const EMPTY: Saved = {
  countryCode: null,
  documentType: null,
  // Both on: the reference draws them on, and they are what makes a phone
  // snapshot into a document photo.
  removeBackground: true,
  enhance: true,
  taskId: null,
  taskStartedAt: null,
  unlockedAt: null,
};

export const useDraftStore = create<DraftState>((set, get) => ({
  ...EMPTY,
  hydrated: false,

  hydrate: async () => {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (raw) set(JSON.parse(raw) as Saved);
    set({ hydrated: true });
  },

  persist: async () => {
    const { countryCode, documentType, removeBackground, enhance, taskId, taskStartedAt } = get();
    const { unlockedAt } = get();
    await AsyncStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        countryCode,
        documentType,
        removeBackground,
        enhance,
        taskId,
        taskStartedAt,
        unlockedAt,
      } satisfies Saved),
    );
  },

  setSpec: (countryCode, documentType) => {
    set({ countryCode, documentType });
    void get().persist();
  },

  setOption: (option, value) => {
    set({ [option]: value } as Pick<Saved, 'removeBackground' | 'enhance'>);
    void get().persist();
  },

  setTask: (taskId) => {
    // The clock starts here, not when the result arrives: the server's
    // retention window runs from the upload.
    set({ taskId, taskStartedAt: taskId ? Date.now() : null, unlockedAt: null });
    void get().persist();
  },

  markUnlocked: () => {
    set({ unlockedAt: Date.now() });
    void get().persist();
  },

  reset: () => {
    // The document stays. Someone who has just made a UK passport photo is
    // most likely about to make another one.
    set({ taskId: null, taskStartedAt: null, unlockedAt: null });
    void get().persist();
  },
}));
