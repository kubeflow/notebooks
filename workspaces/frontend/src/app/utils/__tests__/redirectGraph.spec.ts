import { traceRedirects } from '~/app/utils/redirectGraph';

const trace = (edges: Record<string, string | undefined>, startId = 'A') =>
  traceRedirects({
    startId,
    options: new Map(
      Object.entries(edges).map(([id, to]) => [
        id,
        { id, redirect: to === undefined ? undefined : { to } },
      ]),
    ),
  });

describe('redirect graph traversal', () => {
  it('returns the complete cycle after a non-cyclic prefix', () => {
    expect(trace({ A: 'B', B: 'C', C: 'B' }).cycle).toEqual(['B', 'C', 'B']);
  });
  it('identifies self redirects', () => {
    expect(trace({ A: 'A' }).cycle).toEqual(['A', 'A']);
  });
  it('identifies the source of a missing target', () => {
    expect(trace({ A: 'B', B: 'missing' }).missingTarget).toEqual({
      sourceId: 'B',
      targetId: 'missing',
    });
  });
  it('preserves valid chains', () => {
    expect(trace({ A: 'B', B: 'C', C: undefined })).toEqual({
      edges: [
        { sourceId: 'A', targetId: 'B' },
        { sourceId: 'B', targetId: 'C' },
      ],
    });
  });
});
