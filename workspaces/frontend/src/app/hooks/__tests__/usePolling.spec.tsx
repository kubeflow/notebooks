import { act } from 'react-dom/test-utils';
import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { usePolling } from '~/app/hooks/usePolling';

jest.useFakeTimers();

describe('usePolling', () => {
  it('should call the callback at the specified interval', () => {
    const callback = jest.fn();

    renderHook(() => usePolling(callback, 1000));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should clean up on unmount', () => {
    const callback = jest.fn();

    const { unmount } = renderHook(() => usePolling(callback, 500));

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(2);

    unmount();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
