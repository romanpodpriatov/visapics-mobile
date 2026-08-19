/**
 * Behaviour, not markup. These assert the things that break silently and are
 * expensive when they do: a disabled control that still fires, a switch with
 * no accessibility state, a sheet that cannot be dismissed.
 *
 * Queries come from render()'s return value rather than the `screen` singleton:
 * this version of the library resolves its own dist and src copies separately,
 * so `screen` reports that render was never called.
 */
import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { Button } from '../Button';
import { Sheet } from '../Sheet';
import { Toggle } from '../Toggle';
import { hitSlopTo44, theme } from '../../theme';

describe('Button', () => {
  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Unlock & download" onPress={onPress} />);
    fireEvent.press(getByText('Unlock & download'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('can carry an icon after the label as well as before it', () => {
    const { getByTestId } = render(
      <Button
        label="How it works"
        onPress={jest.fn()}
        trailingIcon={<View testID="arrow" />}
      />,
    );
    expect(getByTestId('arrow')).toBeTruthy();
  });

  it('does not fire while disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<Button label="Continue" onPress={onPress} disabled />);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not fire while busy', () => {
    // A double-tap during a purchase is the expensive version of this.
    const onPress = jest.fn();
    const { getByRole } = render(<Button label="Buy" onPress={onPress} busy />);
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('reports busy to assistive technology', () => {
    const { getByRole } = render(<Button label="Buy" onPress={jest.fn()} busy />);
    expect(getByRole('button').props.accessibilityState).toMatchObject({ busy: true });
  });

  it('falls back to the visible label for the accessible name', () => {
    const { getByRole } = render(<Button label="Retake" onPress={jest.fn()} />);
    expect(getByRole('button').props.accessibilityLabel).toBe('Retake');
  });
});

describe('Toggle', () => {
  it('reports its state as a switch', () => {
    const { getByRole } = render(
      <Toggle value onChange={jest.fn()} label="Remove background" />,
    );
    expect(getByRole('switch').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('inverts the value on press', () => {
    const onChange = jest.fn();
    const { getByRole } = render(
      <Toggle value={false} onChange={onChange} label="AI quality enhance" />,
    );
    fireEvent.press(getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('makes the whole row the target, not the 20pt track', () => {
    const { getByRole } = render(
      <Toggle value={false} onChange={jest.fn()} label="Remove background" />,
    );
    const style = getByRole('switch').props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.minHeight).toBe(theme.minTouchTarget);
  });
});

describe('Sheet', () => {
  it('renders nothing while closed', () => {
    const { queryByLabelText } = render(
      <Sheet visible={false} onClose={jest.fn()}>
        <></>
      </Sheet>,
    );
    expect(queryByLabelText('Close')).toBeNull();
  });

  it('closes when the backdrop is tapped', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <Sheet visible onClose={onClose}>
        <></>
      </Sheet>,
    );
    fireEvent.press(getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('offers no backdrop dismiss when the answer is required', () => {
    const { queryByLabelText } = render(
      <Sheet visible onClose={jest.fn()} dismissible={false}>
        <></>
      </Sheet>,
    );
    expect(queryByLabelText('Close')).toBeNull();
  });
});

describe('hitSlopTo44', () => {
  it('pads a control drawn below the minimum', () => {
    // The reference draws back buttons at 34pt.
    expect(hitSlopTo44(34)).toEqual({ top: 5, bottom: 5, left: 5, right: 5 });
  });

  it('leaves a large enough control alone', () => {
    expect(hitSlopTo44(52)).toBeUndefined();
    expect(hitSlopTo44(44)).toBeUndefined();
  });
});
