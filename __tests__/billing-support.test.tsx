import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';

import Billing from '../app/billing';
import Support from '../app/support';
import { restorePurchases } from '../src/iap';
import { configFixture, renderScreen } from '../src/test-utils';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('../src/iap', () => ({
  ...jest.requireActual('../src/iap/products'),
  restorePurchases: jest.fn(async () => ({ restored: 0 })),
  purchase: jest.fn(),
  fetchIapProducts: jest.fn(async () => []),
}));

const seeds: [string[], unknown][] = [
  [['config'], configFixture],
  [
    ['credits'],
    {
      credits_remaining: 3,
      grants: [
        {
          id: 1,
          bundle_type: 'family',
          bundle_name: 'Family pack',
          total_credits: 5,
          remaining_credits: 3,
          source: 'apple_iap',
          environment: 'sandbox',
          purchased_at: '2026-08-19T12:00:00',
          expires_at: null,
          revoked: false,
        },
      ],
    },
  ],
];

describe('billing', () => {
  beforeEach(() => jest.mocked(restorePurchases).mockClear().mockResolvedValue({ restored: 0 }));
  afterEach(() => jest.restoreAllMocks());

  it('shows the balance and where it came from', () => {
    renderScreen(<Billing />, seeds);

    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Family pack')).toBeTruthy();
    expect(screen.getByText(/App Store/)).toBeTruthy();
  });

  it('offers Restore Purchases without buying anything', async () => {
    renderScreen(<Billing />, seeds);

    fireEvent.press(screen.getByText('Restore purchases'));

    await waitFor(() => expect(restorePurchases).toHaveBeenCalled());
    expect(await screen.findByText(/Nothing to restore/)).toBeTruthy();
  });

  it('has no saved cards and no other way to pay', () => {
    // No Stripe in this binary, so a card list would be a payment surface
    // Apple would ask about — and one that does not work.
    renderScreen(<Billing />, seeds);

    expect(screen.queryByText(/card/i)).toBeNull();
    expect(screen.queryByText(/visapics\.org/i)).toBeNull();
  });

  it('opens the paywall to buy, and nothing else', () => {
    renderScreen(<Billing />, seeds);

    fireEvent.press(screen.getByText('Buy credits'));

    expect(screen.getByText('Pay once. Retake free.')).toBeTruthy();
  });
});

describe('support', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends refunds to Apple, who is holding the money', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen(<Support />, seeds);

    fireEvent.press(screen.getByText('Request a refund'));

    expect(open).toHaveBeenCalledWith('https://reportaproblem.apple.com');
  });

  it('reaches a person by mail rather than a form nobody reads', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen(<Support />, seeds);

    fireEvent.press(screen.getByText('Message support'));

    expect(open).toHaveBeenCalledWith('mailto:support@visapics.org');
  });

  it('opens the policies the server points at', () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen(<Support />, seeds);

    fireEvent.press(screen.getByText('Privacy policy'));
    expect(open).toHaveBeenCalledWith(configFixture.legal.privacy_url);

    fireEvent.press(screen.getByText('Terms of use'));
    expect(open).toHaveBeenCalledWith(configFixture.legal.terms_url);
  });

  it('prints the version of the build it is in, not a literal', () => {
    renderScreen(<Support />, seeds);
    expect(screen.getByText(/^Version \d+\.\d+\.\d+ \(\d+\)$/)).toBeTruthy();
  });
});
