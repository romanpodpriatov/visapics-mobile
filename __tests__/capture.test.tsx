import { act, fireEvent, screen } from '@testing-library/react-native';

import Capture from '../app/capture';
import { useDraftStore } from '../src/store/draft';
import { renderScreen } from '../src/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

const mockCapturePhoto = jest.fn(async () => ({
  toImageAsync: async () => ({
    saveToTemporaryFileAsync: async () => '/tmp/photo.jpg',
    dispose: jest.fn(),
  }),
  dispose: jest.fn(),
}));

jest.mock('react-native-vision-camera', () => ({
  Camera: 'Camera',
  useCameraDevice: () => ({ id: 'front' }),
  usePhotoOutput: () => ({ capturePhoto: mockCapturePhoto }),
  useFrameOutput: () => ({}),
}));

/** Captured so the test can play the detector's part. */
let emitFaces: ((faces: unknown[]) => void) | null = null;
jest.mock('react-native-vision-camera-face-detector', () => ({
  useFaceDetectorOutput: (options: { onFacesDetected: (faces: unknown[]) => void }) => {
    emitFaces = options.onFacesDetected;
    return {};
  },
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (arg: unknown) => void, arg: unknown) => fn(arg),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

const ukPassport = {
  id: 1,
  document_type: 'UK Passport 35x45 mm',
  background_color: 'light_grey',
  dpi: 600,
  photo_width_mm: 35,
  photo_height_mm: 45,
  head_height_min_mm: 29,
  head_height_max_mm: 34,
  head_height_min_percent: null,
  head_height_max_percent: null,
  eyes_position_from_bottom_mm: null,
  eyes_position_max_from_bottom_mm: null,
  file_size_min_kb: null,
  file_size_max_kb: null,
};

const seeds: [string[], unknown][] = [[['specifications', 'gb'], [ukPassport]]];

const goodFace = {
  bounds: { x: 340, y: 480, width: 400, height: 520 },
  yawAngle: 0,
  rollAngle: 0,
  frameWidth: 1080,
  frameHeight: 1920,
};

const smallFace = { ...goodFace, bounds: { x: 470, y: 800, width: 140, height: 180 } };

const see = (faces: unknown[]) =>
  act(() => {
    emitFaces?.(faces);
    jest.advanceTimersByTime(150);
  });

describe('capture', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCapturePhoto.mockClear();
    mockReplace.mockClear();
    emitFaces = null;
    useDraftStore.setState({ countryCode: 'gb', documentType: 'UK Passport 35x45 mm' });
  });
  afterEach(() => jest.useRealTimers());

  it('keeps the shutter shut until every check passes', () => {
    renderScreen(<Capture />, seeds);
    see([smallFace]);

    expect(screen.getByLabelText('Take photo').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByLabelText('Take photo'));
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockCapturePhoto).not.toHaveBeenCalled();
  });

  it('counts down and takes the photo once everything passes', () => {
    renderScreen(<Capture />, seeds);
    see([goodFace]);

    expect(screen.getByText('4/4')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Take photo'));

    // Three seconds, a second at a time, so each tick's state update lands
    // before the next timer is scheduled.
    for (let i = 0; i < 3; i += 1) {
      act(() => {
        jest.advanceTimersByTime(1000);
      });
    }

    expect(mockCapturePhoto).toHaveBeenCalled();
  });

  it('cancels a countdown the moment a check stops passing', () => {
    // Someone presses the shutter, then leans out of frame. A countdown that
    // fired anyway would defeat the only gate this screen has.
    renderScreen(<Capture />, seeds);
    see([goodFace]);

    fireEvent.press(screen.getByLabelText('Take photo'));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    see([smallFace]);
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockCapturePhoto).not.toHaveBeenCalled();
  });

  it('counts the checks that pass', () => {
    renderScreen(<Capture />, seeds);

    see([smallFace]);
    expect(screen.getByText('3/4')).toBeTruthy();

    see([goodFace]);
    expect(screen.getByText('4/4')).toBeTruthy();
  });

  it('does not claim the light was checked before a frame was read', () => {
    renderScreen(<Capture />, seeds);
    see([goodFace]);

    expect(screen.getAllByText('Not measured')).toHaveLength(2);
  });
});
