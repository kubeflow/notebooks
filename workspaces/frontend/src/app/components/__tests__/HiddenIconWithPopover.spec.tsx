import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { HiddenIconWithPopover } from '~/app/components/HiddenIconWithPopover';

describe('HiddenIconWithPopover', () => {
  const defaultProps = {
    type: 'restricted' as const,
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
    render(<HiddenIconWithPopover {...defaultProps} />);

    const button = screen.getByRole('button', { name: 'View restricted option information' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('tabIndex', '0');
    expect(screen.getByTestId('restricted-icon')).toBeInTheDocument();
  });

  it('triggers onActiveChange with popoverId on mouse enter', () => {
    render(<HiddenIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.mouseEnter(button);

    expect(defaultProps.onActiveChange).toHaveBeenCalledWith(defaultProps.popoverId);
  });

  it('clears active popover after delay on mouse leave', () => {
    render(<HiddenIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.mouseLeave(button);

    expect(defaultProps.onActiveChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(defaultProps.onActiveChange).toHaveBeenCalledWith(null);
  });

  it('pins popover on click and clears active popover', () => {
    render(<HiddenIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.click(button);

    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(defaultProps.popoverId);
    expect(defaultProps.onActiveChange).toHaveBeenCalledWith(null);
  });

  it('unpins popover when clicked while already pinned', () => {
    render(<HiddenIconWithPopover {...defaultProps} pinnedPopoverId={defaultProps.popoverId} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.click(button);

    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(null);
  });

  it('supports keyboard Enter and Space keys to toggle pinned state', () => {
    const { rerender } = render(<HiddenIconWithPopover {...defaultProps} />);

    const button = screen.getByTestId('restricted-icon');
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(defaultProps.popoverId);

    rerender(<HiddenIconWithPopover {...defaultProps} pinnedPopoverId={defaultProps.popoverId} />);

    fireEvent.keyDown(button, { key: ' ' });
    expect(defaultProps.onPinnedChange).toHaveBeenCalledWith(null);
  });

  it('renders custom message in popover when visible', () => {
    act(() => {
      render(<HiddenIconWithPopover {...defaultProps} activePopoverId={defaultProps.popoverId} />);
    });

    expect(screen.getByText('Restricted')).toBeInTheDocument();
    expect(screen.getByText('This option is restricted for your role.')).toBeInTheDocument();
  });

  it('renders fallback message when no message is provided', () => {
    act(() => {
      render(
        <HiddenIconWithPopover
          {...defaultProps}
          message={undefined}
          activePopoverId={defaultProps.popoverId}
        />,
      );
    });

    expect(screen.getByText('This option is restricted.')).toBeInTheDocument();
  });

  describe('hidden type', () => {
    const hiddenProps = {
      ...defaultProps,
      type: 'hidden' as const,
      popoverId: 'hidden-test-card',
      message: undefined,
    };

    it('renders trigger with hidden accessibility attributes and test id', () => {
      render(<HiddenIconWithPopover {...hiddenProps} />);

      expect(
        screen.getByRole('button', { name: 'View hidden option information' }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('hidden-icon')).toBeInTheDocument();
      expect(screen.queryByTestId('restricted-icon')).not.toBeInTheDocument();
    });

    it('renders the hidden header and default message when visible', () => {
      act(() => {
        render(<HiddenIconWithPopover {...hiddenProps} activePopoverId={hiddenProps.popoverId} />);
      });

      expect(screen.getByText('Hidden Option')).toBeInTheDocument();
      expect(screen.getByText(/Your administrator has hidden this option/)).toBeInTheDocument();
    });

    it('pins popover on click', () => {
      render(<HiddenIconWithPopover {...hiddenProps} />);

      fireEvent.click(screen.getByTestId('hidden-icon'));

      expect(hiddenProps.onPinnedChange).toHaveBeenCalledWith(hiddenProps.popoverId);
    });
  });
});
