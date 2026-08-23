import { act, fireEvent, screen } from '@testing-library/react-native';

import Capture from '../app/capture';
import { readFrameStats } from '../src/capture/frameStats';
import { useDraftStore } from '../src/store/draft';
import { configFixture, renderScreen } from '../src/test-utils';

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

/** The options the screen configured its frame output with. */
let frameOptions: {
  onFrame: (frame: unknown) => void;
  enablePreviewSizedOutputBuffers?: boolean;
  pixelFormat?: string;
  targetResolution?: { width: number; height: number };
} | null = null;

/** The props the screen handed the camera, and its photo output options. */
let cameraProps: {
  onError?: (error: Error) => void;
  onSessionConfigSelected?: (config: unknown) => void;
  constraints?: Record<string, unknown>[];
} | null = null;
let photoOptions: {
  qualityPrioritization?: string;
  targetResolution?: { width: number; height: number };
} | null = null;

jest.mock('react-native-vision-camera', () => ({
  Camera: (props: never) => {
    cameraProps = props;
    return null;
  },
  useCameraDevice: () => ({ id: 'front' }),
  usePhotoOutput: (options: never) => {
    photoOptions = options;
    return { capturePhoto: mockCapturePhoto };
  },
  useFrameOutput: (options: never) => {
    frameOptions = options;
    return {};
  },
  CommonResolutions: {
    VGA_4_3: { width: 480, height: 640 },
    FHD_4_3: { width: 1440, height: 1920 },
  },
}));

jest.mock('../src/capture/frameStats', () => ({
  readFrameStats: jest.fn(() => ({ luma: 0.5, lumaSpread: 0 })),
}));

/** Captured so the test can play the detector's part. */
let emitFaces: ((faces: unknown[]) => void) | null = null;
const mockCreateFaceOutput = jest.fn(
  (options: { onFacesDetected: (faces: unknown[]) => void }) => {
    emitFaces = options.onFacesDetected;
    return {};
  },
);
jest.mock('react-native-vision-camera-face-detector', () => ({
  createFaceDetectorOutput: (options: never) => mockCreateFaceOutput(options),
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

const seeds: [string[], unknown][] = [
  [['specifications', 'gb'], [ukPassport]],
  [['config'], configFixture],
];

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

    expect(screen.getByText('Ready')).toBeTruthy();
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

  it('counts what is left to fix, not a fraction of a moving denominator', () => {
    // "2/4" beside seven tiles was arithmetic about which checks happened to
    // be measurable, which is not a thing anyone is trying to find out.
    renderScreen(<Capture />, seeds);
    see([{ ...goodFace, rollAngle: 30 }]);

    expect(screen.getByText('1 to fix')).toBeTruthy();
  });

  it('does not claim the light was checked before a frame was read', () => {
    // Exposure, shadows and background all need pixels. Saying "not measured"
    // is honest; showing them as passed would be a claim about a government
    // document that nothing had verified.
    renderScreen(<Capture />, seeds);
    see([goodFace]);

    expect(screen.getAllByText('Not measured')).toHaveLength(2);
  });

  it('judges the face by the server\u2019s own limits, under the server\u2019s names', () => {
    // Not four rules of our own. The photo that prompted this was refused for
    // a 5.6 degree roll against a gate that passes at 2, while the app was not
    // looking at roll at all.
    renderScreen(<Capture />, seeds);
    see([{ ...goodFace, rollAngle: 5.6 }]);

    expect(screen.getByText('Head straight')).toBeTruthy();
    expect(screen.getByLabelText('Take photo').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText('Hold your head straight')).toBeTruthy();
  });
});

describe('the frame pipeline', () => {
  const render = () => {
    useDraftStore.setState({ countryCode: 'gb', documentType: 'UK Passport 35x45 mm' });
    renderScreen(<Capture />, seeds);
  };

  beforeEach(() => {
    frameOptions = null;
    jest.mocked(readFrameStats).mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  /**
   * Measured on a physical iPhone: the preview stuttered and went dark. The
   * frame output was negotiating full-resolution buffers and every single
   * frame was downloaded to the CPU and handed to the JS thread — which is
   * exactly what VisionCamera documents as stalling the camera pipeline.
   */
  it('asks for small preview-sized buffers rather than full-resolution ones', () => {
    render();

    expect(frameOptions?.enablePreviewSizedOutputBuffers).toBe(true);
    expect(frameOptions?.targetResolution).toEqual({ width: 480, height: 640 });
  });

  it('asks for YUV, which is the format the statistics assume', () => {
    // readFrameStats reads plane 0 as 8-bit luma. Under 'native' that plane is
    // whatever the session negotiated, which may not be luma at all.
    render();

    expect(frameOptions?.pixelFormat).toBe('yuv');
  });

  it('releases every frame it is handed', () => {
    // The throttle that used to sit here was added to cure a stutter that
    // turned out to be a non-binned session, and it was the only moving part
    // between the camera and a worklet that never ran.
    render();

    const dispose = jest.fn();
    for (let i = 0; i < 20; i += 1) {
      frameOptions?.onFrame({ isValid: true, hasPixelBuffer: true, dispose });
    }

    expect(dispose).toHaveBeenCalledTimes(20);
    expect(jest.mocked(readFrameStats)).toHaveBeenCalledTimes(20);
  });
});

describe('the camera session', () => {
  const render = () => {
    useDraftStore.setState({ countryCode: 'gb', documentType: 'UK Passport 35x45 mm' });
    renderScreen(<Capture />, seeds);
  };

  beforeEach(() => {
    cameraProps = null;
    photoOptions = null;
  });

  it('does not ask the sensor for its largest photo', () => {
    // Asking for the maximum makes the session negotiate a full-resolution
    // non-binned readout, which VisionCamera documents as worse in low light
    // and heavier on bandwidth — a dark, stuttering preview on a real iPhone.
    // 1440×1920 is far above the 992×1275 the server needs.
    render();

    expect(photoOptions?.targetResolution).toEqual({ width: 1440, height: 1920 });
    expect(photoOptions?.qualityPrioritization).not.toBe('quality');
  });

  it('reports what the camera settled on, so a dark preview can be diagnosed', () => {
    render();

    act(() =>
      cameraProps?.onSessionConfigSelected?.({
        isBinned: false,
        selectedFPS: 30,
        nativePixelFormat: 'yuv',
      }),
    );

    expect(screen.getByText('full-res · 30fps · yuv')).toBeTruthy();
  });

  it('shows a camera failure instead of a preview that quietly stops', () => {
    // Nothing was listening to onError, so a session that refused to
    // reconfigure — flipping to the back camera, for one — looked like a
    // frozen screen with nothing to report.
    render();

    act(() => cameraProps?.onError?.(new Error('Camera device is unavailable')));

    expect(screen.getByText('Camera device is unavailable')).toBeTruthy();
  });

  it('asks the session for a binned format and a capped frame rate', () => {
    // Two fixes aimed at this from the outputs' side changed nothing on a real
    // iPhone, so the intent is now stated where the session negotiates it.
    // VisionCamera's own words for { binned: true }: "improves low-light
    // sensitivity", "significantly less bandwidth". And a 60fps session caps
    // every exposure at 1/60s, which is half the light of a 30fps one — the
    // ordinary reason a preview is dark indoors while the stock camera is not.
    render();

    expect(cameraProps?.constraints).toEqual([{ binned: true }, { fps: 30 }]);
  });

  it('builds the face detector once, however often the screen re-renders', () => {
    // The library's own hook memoizes on a rest object it rebuilds every
    // render, so the output was new every time — and VisionCamera's note is
    // explicit: "The outputs have to be explicitly memoized." A session that
    // reconfigures on every render never gets round to reporting a face,
    // which is why all four gates sat at 0/4 whatever the person did.
    mockCreateFaceOutput.mockClear();
    render();

    const first = mockCreateFaceOutput.mock.calls.length;
    act(() =>
      cameraProps?.onSessionConfigSelected?.({
        isBinned: true,
        selectedFPS: 30,
        nativePixelFormat: 'yuv',
      }),
    );
    act(() => cameraProps?.onError?.(new Error('anything')));

    expect(first).toBe(1);
    expect(mockCreateFaceOutput).toHaveBeenCalledTimes(1);
  });

  it('says why the pixels could not be read, when they could not', () => {
    // "NOT MEASURED" on lighting and background says something went wrong but
    // not what, and the worklet runs where no debugger reaches. The frame
    // itself knows: no CPU buffer, not planar, or no planes at all.
    jest.mocked(readFrameStats).mockReturnValueOnce(null);
    render();

    act(() =>
      cameraProps?.onSessionConfigSelected?.({
        isBinned: true,
        selectedFPS: 30,
        nativePixelFormat: 'yuv',
      }),
    );
    act(() =>
      frameOptions?.onFrame({
        isValid: true,
        hasPixelBuffer: false,
        isPlanar: true,
        dispose: jest.fn(),
      }),
    );

    expect(screen.getByText(/no cpu buffer/)).toBeTruthy();
  });
});
