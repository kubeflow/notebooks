import { formatResourceValue } from '~/shared/utilities/WorkspaceUtils';

describe('formatResourceValue', () => {
  it('preserves zero CPU values', () => {
    expect(formatResourceValue('0', 'cpu')).toBe('0 Cores');
  });

  it('continues to format existing CPU units', () => {
    expect(formatResourceValue('100m', 'cpu')).toBe('100 Millicores');
    expect(formatResourceValue('2', 'cpu')).toBe('2 Cores');
  });

  it('returns a placeholder when the value is missing', () => {
    expect(formatResourceValue(undefined, 'cpu')).toBe('-');
  });
});
