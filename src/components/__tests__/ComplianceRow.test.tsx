import { screen } from '@testing-library/react-native';

import { ComplianceRow } from '../ComplianceRow';
import { renderScreen } from '../../test-utils';

describe('a size the document states in millimetres', () => {
  const size = {
    key: 'resolution' as const,
    label: 'Photo size',
    measured: [827, 1063] as [number, number],
    measured_display: '35 × 45 mm',
    requirement_display: '35 × 45 mm',
    detail: '827×1063 px',
    verdict: 'pass' as const,
  };

  it('leads with the units the document uses', () => {
    // A person holding a 35x45 mm requirement has no use for "827x1063 px" as
    // the headline: it is the same fact in a unit the document never mentions.
    renderScreen(<ComplianceRow check={size} />);

    expect(screen.getByText('35 × 45 mm')).toBeTruthy();
  });

  it('keeps the pixels visible underneath, because they are still true', () => {
    renderScreen(<ComplianceRow check={size} />);

    expect(screen.getByText('827×1063 px')).toBeTruthy();
  });

  it('shows no second line for a check that has no detail', () => {
    renderScreen(<ComplianceRow check={{ ...size, detail: undefined }} />);

    expect(screen.queryByText('827×1063 px')).toBeNull();
  });
});
