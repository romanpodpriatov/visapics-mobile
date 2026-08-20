import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { Paywall } from '../Paywall';
import { fetchIapProducts, purchase } from '../../iap';
import { configFixture, renderScreen } from '../../test-utils';

jest.mock('../../iap', () => ({
  ...jest.requireActual('../../iap/products'),
  purchase: jest.fn(),
  fetchIapProducts: jest.fn(),
}));

/** What StoreKit hands back for a Polish storefront. */
const zlotyProducts = [
  { id: 'org.visapics.app.photo.single', displayPrice: '17,99 zł' },
  { id: 'org.visapics.app.credits.family', displayPrice: '64,99 zł' },
  { id: 'org.visapics.app.credits.travel', displayPrice: '109,99 zł' },
];

const seeds = (products: unknown = zlotyProducts): [string[], unknown][] => [
  [['config'], configFixture],
  [['iap-products'], products],
];

const open = (onPurchased = jest.fn(), onRestore = jest.fn()) =>
  renderScreen(
    <Paywall
      visible
      onClose={jest.fn()}
      onPurchased={onPurchased}
      onRestore={onRestore}
    />,
    seeds(),
  );

describe('Paywall', () => {
  beforeEach(() => {
    jest.mocked(purchase).mockReset();
    jest.mocked(fetchIapProducts).mockReset().mockResolvedValue([]);
  });

  it('shows the price the store formatted, not one of ours', () => {
    // The reference's $3.99 is a US display value. A person in Poland sees
    // zloty, and the store decides the number.
    open();

    expect(screen.getByText('17,99 zł')).toBeTruthy();
    expect(screen.getByText('109,99 zł')).toBeTruthy();
    expect(screen.queryByText(/\$/)).toBeNull();
  });

  it('shows no price at all until the store has answered', () => {
    renderScreen(
      <Paywall visible onClose={jest.fn()} onPurchased={jest.fn()} onRestore={jest.fn()} />,
      [[['config'], configFixture]],
    );

    expect(screen.getByText('Prices are loading from the App Store')).toBeTruthy();
    expect(screen.queryByText(/Buy /)).toBeNull();
  });

  it('buys the option that is selected', async () => {
    jest
      .mocked(purchase)
      .mockResolvedValue({ cancelled: false, creditsAdded: 10, creditsRemaining: 10 });
    const onPurchased = jest.fn();
    open(onPurchased);

    fireEvent.press(screen.getByLabelText('Travel pack · 10'));
    fireEvent.press(screen.getByText('Buy 109,99 zł'));

    await waitFor(() => expect(purchase).toHaveBeenCalledWith('org.visapics.app.credits.travel'));
    await waitFor(() => expect(onPurchased).toHaveBeenCalledWith(10));
  });

  it('says nothing at all when the purchase was cancelled', async () => {
    jest.mocked(purchase).mockResolvedValue({ cancelled: true });
    const onPurchased = jest.fn();
    open(onPurchased);

    fireEvent.press(screen.getByText('Buy 17,99 zł'));

    await waitFor(() => expect(purchase).toHaveBeenCalled());
    expect(onPurchased).not.toHaveBeenCalled();
    expect(screen.queryByText(/did not go through/)).toBeNull();
  });

  it('says nothing was charged when the purchase failed', async () => {
    jest.mocked(purchase).mockRejectedValue(new Error('storekit exploded'));
    open();

    fireEvent.press(screen.getByText('Buy 17,99 zł'));

    expect(await screen.findByText(/nothing was charged/)).toBeTruthy();
  });

  it('offers Restore Purchases, which 3.1.1 requires to be visible', () => {
    const onRestore = jest.fn();
    open(jest.fn(), onRestore);

    fireEvent.press(screen.getByText('Restore purchases'));

    expect(onRestore).toHaveBeenCalled();
  });

  it('carries the terms, where the price comes from, and how refunds work', () => {
    open();

    expect(screen.getByText(/One-time purchase, no subscription/)).toBeTruthy();
    expect(screen.getByText(/local currency by the App Store/)).toBeTruthy();
    expect(screen.getByText(/refunds are requested through Apple/)).toBeTruthy();
  });

  it('points at no other way to pay', () => {
    // Guideline 3.1.3: no link out to buy, no mention of the website's prices.
    open();

    expect(screen.queryByText(/visapics\.org/i)).toBeNull();
    expect(screen.queryByText(/cheaper|website|web/i)).toBeNull();
  });
});
