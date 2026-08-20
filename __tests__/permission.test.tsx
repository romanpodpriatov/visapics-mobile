import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import Permission from '../app/permission';
import { pickFromLibrary } from '../src/photo/library';
import { validatePhoto } from '../src/photo/validate';
import { useConsentStore } from '../src/store/consent';
import { configFixture, renderScreen } from '../src/test-utils';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));

const mockRequestPermission = jest.fn(async () => true);
const mockCameraPermission = {
  status: 'not-determined' as string,
  hasPermission: false,
  canRequestPermission: true,
  requestPermission: mockRequestPermission,
};
jest.mock('react-native-vision-camera', () => ({
  useCameraPermission: () => mockCameraPermission,
}));

jest.mock('../src/photo/library', () => ({
  pickFromLibrary: jest.fn(),
  sampleAsset: jest.fn(),
}));

jest.mock('../src/photo/validate', () => ({
  validatePhoto: jest.fn(),
  prepareForUpload: jest.fn(),
}));

const seeds: [string[], unknown][] = [[['config'], configFixture]];

const setPermission = (over: Partial<typeof mockCameraPermission>) =>
  Object.assign(mockCameraPermission, over);

const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);

describe('camera permission', () => {
  beforeEach(() => {
    mockBack.mockClear();
    mockReplace.mockClear();
    mockPush.mockClear();
    jest.mocked(pickFromLibrary).mockReset();
    jest.mocked(validatePhoto).mockReset();
    mockRequestPermission.mockClear();
    openSettings.mockClear();
    setPermission({
      status: 'not-determined',
      hasPermission: false,
      canRequestPermission: true,
    });
    useConsentStore.setState({ accepted: false, hydrated: true });
  });

  it('explains what happens to the photo before the system is asked anything', () => {
    // 5.1.1(i): a system dialog before any explanation is a documented
    // rejection, and it is also the version people deny most.
    renderScreen(<Permission />, seeds);

    expect(screen.getByText('How your photo is handled')).toBeTruthy();
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('states the retention the server reports, not a number of its own', () => {
    renderScreen(<Permission />, seeds);
    // configFixture reports 168 hours.
    expect(screen.getByText(/Deleted after 7 days/)).toBeTruthy();
    expect(screen.queryByText(/Deleted after 24 hours/)).toBeNull();
  });

  it('leaves the flow when consent is declined, without asking the system', () => {
    renderScreen(<Permission />, seeds);

    fireEvent.press(screen.getByText('Not now'));

    expect(useConsentStore.getState().accepted).toBe(false);
    expect(mockRequestPermission).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows the purpose screen once consent is given', () => {
    renderScreen(<Permission />, seeds);

    fireEvent.press(screen.getByText('I understand — continue'));

    expect(useConsentStore.getState().accepted).toBe(true);
    expect(screen.getByText('Coaching needs to see the frame.')).toBeTruthy();
    // Still nothing asked of the system: that happens on the button below.
    expect(mockRequestPermission).not.toHaveBeenCalled();
  });

  it('asks the system only when the purpose button is pressed', () => {
    useConsentStore.setState({ accepted: true });
    renderScreen(<Permission />, seeds);

    fireEvent.press(screen.getByText('Allow camera access'));

    expect(mockRequestPermission).toHaveBeenCalled();
  });

  it('goes straight to the camera when both are already in place', () => {
    useConsentStore.setState({ accepted: true });
    setPermission({ hasPermission: true, status: 'authorized', canRequestPermission: false });

    renderScreen(<Permission />, seeds);

    expect(mockReplace).toHaveBeenCalledWith('/capture');
  });

  it('offers Settings and the library when access has been refused', () => {
    // An app that becomes useless when a permission is refused is a 5.1.1
    // rejection, so the refusal has to leave a working route to a photo.
    useConsentStore.setState({ accepted: true });
    setPermission({ hasPermission: false, status: 'denied', canRequestPermission: false });

    renderScreen(<Permission />, seeds);

    expect(screen.getByText(/still make a compliant photo from your library/)).toBeTruthy();

    fireEvent.press(screen.getByText('Open Settings'));
    expect(openSettings).toHaveBeenCalled();
  });

  it('does not offer to ask again when the system will not ask again', () => {
    useConsentStore.setState({ accepted: true });
    setPermission({ hasPermission: false, status: 'denied', canRequestPermission: false });

    renderScreen(<Permission />, seeds);

    expect(screen.queryByText('Allow camera access')).toBeNull();
  });

  it('really reaches the library when the camera is refused', async () => {
    // The whole decline path rests on this button doing something.
    useConsentStore.setState({ accepted: true });
    setPermission({ hasPermission: false, status: 'denied', canRequestPermission: false });
    jest.mocked(pickFromLibrary).mockResolvedValue({
      status: 'picked',
      asset: { uri: 'file:///holiday.jpg' },
    });
    jest.mocked(validatePhoto).mockResolvedValue({ ok: true, uri: 'file:///holiday.jpg' });

    renderScreen(<Permission />, seeds);
    fireEvent.press(screen.getByText('Use library'));

    await waitFor(() => expect(pickFromLibrary).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/processing',
      params: { photo: 'file:///holiday.jpg' },
    });
  });
});
