import { fireEvent, screen } from '@testing-library/react-native';

import Onboarding from '../app/onboarding';
import { useOnboardingStore } from '../src/store/onboarding';
import { configFixture, renderScreen } from '../src/test-utils';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const withConfig: [string[], unknown][] = [[['config'], configFixture]];

describe('onboarding', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    useOnboardingStore.setState({ onboarded: false, hydrated: true });
  });

  it('can be skipped from the first slide', () => {
    renderScreen(<Onboarding />, withConfig);

    fireEvent.press(screen.getByText('Skip'));

    expect(useOnboardingStore.getState().onboarded).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/photos');
  });

  it('offers Skip on every slide', () => {
    renderScreen(<Onboarding />, withConfig);

    fireEvent.press(screen.getByText('How it works'));
    expect(screen.getByText('Skip')).toBeTruthy();

    fireEvent.press(screen.getByText('Continue'));
    expect(screen.getByText('Skip')).toBeTruthy();
  });

  it('walks the three slides and then opens the app', () => {
    renderScreen(<Onboarding />, withConfig);

    fireEvent.press(screen.getByText('How it works'));
    fireEvent.press(screen.getByText('Continue'));
    fireEvent.press(screen.getByText('Make my photo'));

    expect(useOnboardingStore.getState().onboarded).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/photos');
  });

  it('takes the coverage counts from the server', () => {
    renderScreen(<Onboarding />, withConfig);

    fireEvent.press(screen.getByText('How it works'));
    fireEvent.press(screen.getByText('Continue'));

    expect(screen.getByText('164 countries. 951 document specs.')).toBeTruthy();
    expect(screen.getByText('951 of 951 specs verified · 100%')).toBeTruthy();
  });

  it('states no count at all until the server has reported one', () => {
    // The reference's "954 document specs" and "952 of 954 · 99.8%" are
    // inventions. A wrong number in a shipped binary needs a resubmission to
    // correct, so the slide says less rather than guessing.
    renderScreen(<Onboarding />);

    fireEvent.press(screen.getByText('How it works'));
    fireEvent.press(screen.getByText('Continue'));

    expect(screen.queryByText(/document specs\./)).toBeNull();
    expect(screen.queryByText(/specs verified/)).toBeNull();
    expect(screen.getByText('Make my photo')).toBeTruthy();
  });
});
