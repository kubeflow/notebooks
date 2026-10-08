import { formatResourceValue, parseResourceValue } from '~/shared/utilities/WorkspaceUtils';

describe('parseResourceValue', () => {
  it('normalizes sub-core nanocore CPU values to millicores', () => {
    expect(parseResourceValue('2308487n', 'cpu')).toEqual([
      2.308487,
      {
        name: 'Millicores',
        unit: 'm',
        weight: 1_000_000,
      },
    ]);
  });

  it('normalizes nanocore CPU values at or above one core to cores', () => {
    expect(parseResourceValue('1499177218n', 'cpu')).toEqual([
      1.499177218,
      {
        name: 'Cores',
        unit: '',
        weight: 1_000_000_000,
      },
    ]);
  });
});

describe('formatResourceValue', () => {
  it('formats sub-core nanocore CPU values as millicores', () => {
    expect(formatResourceValue('2308487n', 'cpu')).toBe('2.308487 Millicores');
  });

  it('formats nanocore CPU values at or above one core as cores', () => {
    expect(formatResourceValue('1499177218n', 'cpu')).toBe('1.499177218 Cores');
  });

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
