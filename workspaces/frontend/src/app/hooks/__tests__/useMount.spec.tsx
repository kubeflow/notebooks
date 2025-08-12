import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import useMount from '~/app/hooks/useMount';

describe('useMount', () => {
  it('invokes callback on mount', () => {
    const cb = jest.fn();
    renderHook(() => useMount(cb));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
