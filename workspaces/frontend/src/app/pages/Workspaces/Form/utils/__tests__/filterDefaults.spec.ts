import { computeDefaultFilterValues } from '~/app/pages/Workspaces/Form/utils/filterDefaults';

describe('computeDefaultFilterValues', () => {
  it('should return false for both filters when no defaultId provided', () => {
    const options = [
      { id: 'opt1', hidden: true, redirect: { to: 'opt2' } },
      { id: 'opt2', hidden: false, redirect: undefined },
    ];

    const result = computeDefaultFilterValues(options);

    expect(result).toEqual({
      showHidden: false,
      showRedirected: false,
    });
  });

  it('should return false for both filters when defaultId not found in options', () => {
    const options = [
      { id: 'opt1', hidden: true, redirect: { to: 'opt2' } },
      { id: 'opt2', hidden: false, redirect: undefined },
    ];

    const result = computeDefaultFilterValues(options, 'nonexistent');

    expect(result).toEqual({
      showHidden: false,
      showRedirected: false,
    });
  });

  it('should return showHidden=true when default option is hidden', () => {
    const options = [
      { id: 'opt1', hidden: true, redirect: undefined },
      { id: 'opt2', hidden: false, redirect: undefined },
    ];

    const result = computeDefaultFilterValues(options, 'opt1');

    expect(result).toEqual({
      showHidden: true,
      showRedirected: false,
    });
  });

  it('should return showRedirected=true when default option has redirect', () => {
    const options = [
      { id: 'opt1', hidden: false, redirect: { to: 'opt2' } },
      { id: 'opt2', hidden: false, redirect: undefined },
    ];

    const result = computeDefaultFilterValues(options, 'opt1');

    expect(result).toEqual({
      showHidden: false,
      showRedirected: true,
    });
  });

  it('should return both true when default is hidden AND redirected', () => {
    const options = [
      { id: 'opt1', hidden: true, redirect: { to: 'opt2' } },
      { id: 'opt2', hidden: false, redirect: undefined },
    ];

    const result = computeDefaultFilterValues(options, 'opt1');

    expect(result).toEqual({
      showHidden: true,
      showRedirected: true,
    });
  });

  it('should return both false when default is visible and not redirected', () => {
    const options = [
      { id: 'opt1', hidden: false, redirect: undefined },
      { id: 'opt2', hidden: true, redirect: { to: 'opt3' } },
    ];

    const result = computeDefaultFilterValues(options, 'opt1');

    expect(result).toEqual({
      showHidden: false,
      showRedirected: false,
    });
  });

  it('should handle empty options array', () => {
    const result = computeDefaultFilterValues([], 'anyId');

    expect(result).toEqual({
      showHidden: false,
      showRedirected: false,
    });
  });

  it('should not mutate the input array', () => {
    const options = [
      { id: 'opt1', hidden: true, redirect: { to: 'opt2' } },
      { id: 'opt2', hidden: false, redirect: undefined },
    ];
    const originalOptions = JSON.parse(JSON.stringify(options));

    computeDefaultFilterValues(options, 'opt1');

    expect(options).toEqual(originalOptions);
  });

  it('should handle redirect with null value as redirected', () => {
    const options = [
      { id: 'opt1', hidden: false, redirect: null as unknown },
      { id: 'opt2', hidden: false, redirect: undefined },
    ];

    const result = computeDefaultFilterValues(options, 'opt1');

    // redirect is not undefined, so it should be considered redirected
    expect(result.showRedirected).toBe(true);
  });

  it('should be case-sensitive when matching IDs', () => {
    const options = [
      { id: 'Opt1', hidden: true, redirect: undefined },
      { id: 'opt1', hidden: false, redirect: undefined },
    ];

    const result = computeDefaultFilterValues(options, 'opt1');

    expect(result).toEqual({
      showHidden: false,
      showRedirected: false,
    });
  });
});
