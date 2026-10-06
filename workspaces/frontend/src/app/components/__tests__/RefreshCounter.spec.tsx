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

  it('calls onManualRefresh only for an explicit button click, never for the automatic countdown tick', () => {
    const onRefresh = jest.fn();
    const onManualRefresh = jest.fn();
    render(
      <RefreshCounter interval={3000} onRefresh={onRefresh} onManualRefresh={onManualRefresh} />,
    );

    act(() => jest.advanceTimersByTime(3000));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onManualRefresh).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('workspace-refresh-now'));
    expect(onRefresh).toHaveBeenCalledTimes(2);
    expect(onManualRefresh).toHaveBeenCalledTimes(1);

    act(() => jest.advanceTimersByTime(3000));
    expect(onRefresh).toHaveBeenCalledTimes(3);
    expect(onManualRefresh).toHaveBeenCalledTimes(1);
  });

  it('does not throw when the button is clicked and onManualRefresh is not provided', () => {
    const onRefresh = jest.fn();
    render(<RefreshCounter interval={3000} onRefresh={onRefresh} />);

    expect(() => fireEvent.click(screen.getByTestId('workspace-refresh-now'))).not.toThrow();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
