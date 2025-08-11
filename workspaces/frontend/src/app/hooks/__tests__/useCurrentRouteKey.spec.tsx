import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import { AppRouteKey, AppRoutePaths } from '~/app/routes';

describe('useCurrentRouteKey', () => {
  const wrapper: React.FC<React.PropsWithChildren<{ initialEntries: string[] }>> = ({
    children,
    initialEntries,
  }) => <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;

  const fillParams = (pattern: string) => pattern.replace(/:([^/]+)/g, 'test');
  const cases: ReadonlyArray<readonly [string, AppRouteKey]> = (
    Object.entries(AppRoutePaths) as [AppRouteKey, string][]
  ).map(([key, pattern]) => [fillParams(pattern), key]);

  it.each(cases)('matches route keys by path: %s', (path, expected) => {
    const { result } = renderHook(() => useCurrentRouteKey(), {
      wrapper: (props) => wrapper({ ...props, initialEntries: [path] }),
    });
    expect(result.current).toBe(expected);
  });

  it('returns undefined for unknown paths', () => {
    const { result } = renderHook(() => useCurrentRouteKey(), {
      wrapper: (props) => wrapper({ ...props, initialEntries: ['/unknown'] }),
    });
    expect(result.current).toBeUndefined();
  });
});
