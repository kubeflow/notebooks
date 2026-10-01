import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RestrictedIconWithPopover } from '~/app/components/RestrictedIconWithPopover';

describe('RestrictedIconWithPopover', () => {
  const defaultProps = {
    popoverId: 'restricted-test-card',
    activePopoverId: null,
    pinnedPopoverId: null,
    onActiveChange: jest.fn(),
    onPinnedChange: jest.fn(),
    message: 'This option is restricted for your role.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders trigger button with accessibility attributes', () => {
    render(<RestrictedIconWithPopover {...defaultProps} />);

    const button = screen.getByRole('button', { name: 'View restricted option information' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('tabIndex', '0');
    expect(screen.getByTestId('restricted-icon')).toBeInTheDocument();
  });

  it('triggers onActiveChange with popoverId on mouse enter', () => {
    render(<RestrictedIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.mouseEnter(button);

    expect(defaultProps.onActiveChange).toHaveBeenCalledWith(defaultProps.popoverId);
  });

  it('clears active popover after delay on mouse leave', () => {
    render(<RestrictedIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.mouseLeave(button);

    expect(defaultProps.onActiveChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(defaultProps.onActiveChange).toHaveBeenCalledWith(null);
  });

  it('pins popover on click and clears active popover', () => {
    render(<RestrictedIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.click(button);

    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(defaultProps.popoverId);
    expect(defaultProps.onActiveChange).toHaveBeenCalledWith(null);
  });

  it('unpins popover when clicked while already pinned', () => {
    render(
      <RestrictedIconWithPopover {...defaultProps} pinnedPopoverId={defaultProps.popoverId} />,
    );

    const button = screen.getByTestId('restricted-icon');
    fireEvent.click(button);

    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(null);
  });

  it('supports keyboard Enter and Space keys to toggle pinned state', () => {
    const { rerender } = render(<RestrictedIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(defaultProps.popoverId);

    rerender(
      <RestrictedIconWithPopover {...defaultProps} pinnedPopoverId={defaultProps.popoverId} />,
    );

    fireEvent.keyDown(button, { key: ' ' });
    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(null);
  });

  it('renders custom message in popover when visible', () => {
    act(() => {
      render(
        <RestrictedIconWithPopover {...defaultProps} activePopoverId={defaultProps.popoverId} />,
      );
    });

    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.getByText('This option is restricted for your role.')).toBeInTheDocument();
  });

  it('renders fallback message when no message is provided', () => {
    act(() => {
      render(
        <RestrictedIconWithPopover
          {...defaultProps}
          message={undefined}
          activePopoverId={defaultProps.popoverId}
        />,
      );
    });

    expect(screen.getByText('This option is restricted.')).toBeInTheDocument();
  });
});
