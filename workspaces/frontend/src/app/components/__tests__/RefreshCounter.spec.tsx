import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RefreshCounter } from '~/app/components/RefreshCounter';

describe('RefreshCounter', () => {
  const getCountdownText = () => screen.getByTestId('workspace-refresh-countdown').textContent;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  it('counts down each second and refreshes when it reaches zero', () => {
    const onRefresh = jest.fn();
    render(<RefreshCounter interval={5000} onRefresh={onRefresh} />);

    expect(getCountdownText()).toBe('Refreshing in 5 seconds...');

    act(() => jest.advanceTimersByTime(1000));
    expect(getCountdownText()).toBe('Refreshing in 4 seconds...');

    act(() => jest.advanceTimersByTime(3000));
    expect(getCountdownText()).toBe('Refreshing in 1 seconds...');
    expect(onRefresh).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(1000));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(getCountdownText()).toBe('Refreshing in 5 seconds...');
  });

  it('refreshes immediately when clicking the button and resets the countdown', () => {
    const onRefresh = jest.fn();
    render(<RefreshCounter interval={3000} onRefresh={onRefresh} />);

    act(() => jest.advanceTimersByTime(2000));
    expect(getCountdownText()).toBe('Refreshing in 1 seconds...');

    fireEvent.click(screen.getByTestId('workspace-refresh-now'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(getCountdownText()).toBe('Refreshing in 3 seconds...');

    act(() => jest.advanceTimersByTime(1000));
    expect(getCountdownText()).toBe('Refreshing in 2 seconds...');
  });
});
