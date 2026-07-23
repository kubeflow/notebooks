import { OptionsRedirectMessageLevel } from '~/generated/data-contracts';
import {
  resolveRedirectChain,
  OptionValue,
} from '~/app/pages/Workspaces/Form/utils/resolveRedirectChain';

const makeOption = (id: string, overrides: Partial<OptionValue> = {}): OptionValue =>
  ({
    id,
    displayName: `Display ${id}`,
    description: `Description ${id}`,
    hidden: false,
    labels: [{ key: 'env', value: 'test' }],
    redirect: undefined,
    ...overrides,
  }) as OptionValue;

describe('resolveRedirectChain', () => {
  it('returns empty chain when option has no redirect', () => {
    const option = makeOption('A');
    const result = resolveRedirectChain(option, [option]);

    expect(result.chain).toEqual([]);
    expect(result.finalTarget).toBeUndefined();
    expect(result.cycleDetected).toBe(false);
  });

  it('resolves a single-hop redirect', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    const optB = makeOption('B');

    const result = resolveRedirectChain(optA, [optA, optB]);

    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].source.id).toBe('A');
    expect(result.chain[0].target.id).toBe('B');
    expect(result.finalTarget).toBe(optB);
    expect(result.cycleDetected).toBe(false);
  });

  it('resolves a multi-hop redirect chain', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    const optB = makeOption('B', { redirect: { to: 'C' } });
    const optC = makeOption('C');

    const result = resolveRedirectChain(optA, [optA, optB, optC]);

    expect(result.chain).toHaveLength(2);
    expect(result.chain[0].source.id).toBe('A');
    expect(result.chain[0].target.id).toBe('B');
    expect(result.chain[1].source.id).toBe('B');
    expect(result.chain[1].target.id).toBe('C');
    expect(result.finalTarget).toBe(optC);
  });

  it('detects cycles and returns undefined finalTarget', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    const optB = makeOption('B', { redirect: { to: 'A' } });

    const result = resolveRedirectChain(optA, [optA, optB]);

    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].source.id).toBe('A');
    expect(result.chain[0].target.id).toBe('B');
    expect(result.finalTarget).toBeUndefined();
    expect(result.cycleDetected).toBe(true);
  });

  it('handles missing target gracefully', () => {
    const optA = makeOption('A', { redirect: { to: 'missing' } });

    const result = resolveRedirectChain(optA, [optA]);

    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].source.id).toBe('A');
    expect(result.chain[0].target.id).toBe('missing');
    expect(result.chain[0].target.displayName).toBe('missing (not found)');
    expect(result.finalTarget).toBeUndefined();
  });

  it('handles multi-hop with missing intermediate target', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    // B is missing from allOptions
    const optC = makeOption('C');

    const result = resolveRedirectChain(optA, [optA, optC]);

    expect(result.chain).toHaveLength(1);
    expect(result.chain[0].target.displayName).toBe('B (not found)');
    expect(result.finalTarget).toBeUndefined();
  });

  it('preserves redirect message with level and text', () => {
    const optA = makeOption('A', {
      redirect: {
        to: 'B',
        message: {
          level: OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
          text: 'Option A is deprecated',
        },
      },
    });
    const optB = makeOption('B');

    const result = resolveRedirectChain(optA, [optA, optB]);

    expect(result.chain[0].message).toEqual({
      level: 'Warning',
      text: 'Option A is deprecated',
    });
  });

  it('handles redirect without message', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    const optB = makeOption('B');

    const result = resolveRedirectChain(optA, [optA, optB]);

    expect(result.chain[0].message).toBeUndefined();
  });

  it('preserves labels on source and target', () => {
    const optA = makeOption('A', {
      redirect: { to: 'B' },
      labels: [{ key: 'k1', value: 'v1' }],
    });
    const optB = makeOption('B', {
      labels: [{ key: 'k2', value: 'v2' }],
    });

    const result = resolveRedirectChain(optA, [optA, optB]);

    expect(result.chain[0].source.labels).toEqual([{ key: 'k1', value: 'v1' }]);
    expect(result.chain[0].target.labels).toEqual([{ key: 'k2', value: 'v2' }]);
  });

  it('handles options with no labels', () => {
    const optA = makeOption('A', {
      redirect: { to: 'B' },
      labels: undefined,
    });
    const optB = makeOption('B', { labels: undefined });

    const result = resolveRedirectChain(optA, [optA, optB]);

    expect(result.chain[0].source.labels).toEqual([]);
    expect(result.chain[0].target.labels).toEqual([]);
  });

  it('does not mutate input arrays', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    const optB = makeOption('B');
    const allOptions = [optA, optB];
    const originalOptions = JSON.parse(JSON.stringify(allOptions));

    resolveRedirectChain(optA, allOptions);

    expect(allOptions).toEqual(originalOptions);
  });

  it('handles self-redirect as a cycle', () => {
    const optA = makeOption('A', { redirect: { to: 'A' } });

    const result = resolveRedirectChain(optA, [optA]);

    expect(result.chain).toHaveLength(0);
    expect(result.finalTarget).toBeUndefined();
    expect(result.cycleDetected).toBe(true);
  });

  it('detects a cycle that forms mid-chain after valid hops', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    const optB = makeOption('B', { redirect: { to: 'C' } });
    const optC = makeOption('C', { redirect: { to: 'B' } });

    const result = resolveRedirectChain(optA, [optA, optB, optC]);

    expect(result.chain).toHaveLength(2);
    expect(result.chain[0].source.id).toBe('A');
    expect(result.chain[0].target.id).toBe('B');
    expect(result.chain[1].source.id).toBe('B');
    expect(result.chain[1].target.id).toBe('C');
    expect(result.finalTarget).toBeUndefined();
    expect(result.cycleDetected).toBe(true);
  });

  it('handles three-node cycle with undefined finalTarget', () => {
    const optA = makeOption('A', { redirect: { to: 'B' } });
    const optB = makeOption('B', { redirect: { to: 'C' } });
    const optC = makeOption('C', { redirect: { to: 'A' } });

    const result = resolveRedirectChain(optA, [optA, optB, optC]);

    expect(result.chain).toHaveLength(2);
    expect(result.chain[0].source.id).toBe('A');
    expect(result.chain[0].target.id).toBe('B');
    expect(result.chain[1].source.id).toBe('B');
    expect(result.chain[1].target.id).toBe('C');
    expect(result.finalTarget).toBeUndefined();
    expect(result.cycleDetected).toBe(true);
  });
});
