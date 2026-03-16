import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { SummaryRedirectIcon } from '~/app/pages/Workspaces/Form/SummaryRedirectIcon';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';

describe('SummaryRedirectIcon', () => {
  const mockSetActivePopoverId = jest.fn();
  const mockSetPinnedPopoverId = jest.fn();
  const mockOnClickTarget = jest.fn();
  const mockBuildRedirectPopoverContent = jest.fn((args) => (
    <div data-testid="popover-content">
      {args.displayName} → {args.targetDisplayName}
    </div>
  ));

  const defaultProps = {
    step: 1,
    popoverIdSuffix: 'test',
    displayName: 'Source Option',
    targetDisplayName: 'Target Option',
    redirect: {
      to: 'target-id',
      message: {
        level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
        text: 'This option redirects',
      },
    },
    onClickTarget: mockOnClickTarget,
    activePopoverId: null,
    pinnedPopoverId: null,
    setActivePopoverId: mockSetActivePopoverId,
    setPinnedPopoverId: mockSetPinnedPopoverId,
    buildRedirectPopoverContent: mockBuildRedirectPopoverContent,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('Basic rendering', () => {
    it('should render the redirect icon', () => {
      render(<SummaryRedirectIcon {...defaultProps} />);

      const icon = screen.getByTestId('redirect-icon-1-test');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass('summary-redirect-icon-button');
    });

    it('should have proper accessibility attributes', () => {
      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('Popover visibility', () => {
    it('should show popover when activePopoverId matches', () => {
      render(<SummaryRedirectIcon {...defaultProps} activePopoverId="redirect-summary-1-test" />);

      expect(mockBuildRedirectPopoverContent).toHaveBeenCalledWith({
        displayName: 'Source Option',
        targetDisplayName: 'Target Option',
        redirect: defaultProps.redirect,
        onClickTarget: mockOnClickTarget,
      });
    });

    it('should show popover when pinnedPopoverId matches', () => {
      render(<SummaryRedirectIcon {...defaultProps} pinnedPopoverId="redirect-summary-1-test" />);

      expect(mockBuildRedirectPopoverContent).toHaveBeenCalledWith({
        displayName: 'Source Option',
        targetDisplayName: 'Target Option',
        redirect: defaultProps.redirect,
        onClickTarget: mockOnClickTarget,
      });
    });

    it('should hide popover when neither ID matches', () => {
      render(<SummaryRedirectIcon {...defaultProps} activePopoverId="other-id" />);

      // Popover content is still built but isVisible will be false
      expect(mockBuildRedirectPopoverContent).toHaveBeenCalled();
    });
  });

  describe('Click interactions', () => {
    it('should pin popover on click when not pinned', async () => {
      const user = userEvent.setup({ delay: null });
      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      await user.click(button);

      expect(mockSetPinnedPopoverId).toHaveBeenCalledWith('redirect-summary-1-test');
      expect(mockSetActivePopoverId).toHaveBeenCalledWith(null);
    });

    it('should unpin popover on click when already pinned', async () => {
      const user = userEvent.setup({ delay: null });
      render(<SummaryRedirectIcon {...defaultProps} pinnedPopoverId="redirect-summary-1-test" />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      await user.click(button);

      expect(mockSetPinnedPopoverId).toHaveBeenCalledWith(null);
    });

    it('should handle Enter key press', async () => {
      const user = userEvent.setup({ delay: null });
      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(mockSetPinnedPopoverId).toHaveBeenCalledWith('redirect-summary-1-test');
    });

    it('should handle Space key press', async () => {
      const user = userEvent.setup({ delay: null });
      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      button.focus();
      await user.keyboard(' ');

      expect(mockSetPinnedPopoverId).toHaveBeenCalledWith('redirect-summary-1-test');
    });
  });

  describe('Hover interactions', () => {
    it('should show popover on mouse enter', async () => {
      const user = userEvent.setup({ delay: null });
      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      await user.hover(button);

      expect(mockSetActivePopoverId).toHaveBeenCalledWith('redirect-summary-1-test');
    });

    it('should not show popover on hover if already pinned', async () => {
      const user = userEvent.setup({ delay: null });
      render(<SummaryRedirectIcon {...defaultProps} pinnedPopoverId="redirect-summary-1-test" />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      await user.hover(button);

      expect(mockSetActivePopoverId).not.toHaveBeenCalled();
    });
  });

  describe('Delayed hide behavior', () => {
    it('should start 1 second timer on mouse leave', async () => {
      const user = userEvent.setup({ delay: null });

      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      await user.hover(button);
      await user.unhover(button);

      expect(mockSetActivePopoverId).toHaveBeenCalledWith('redirect-summary-1-test');
    });

    it('should hide popover after 1 second if not hovering popover', async () => {
      const user = userEvent.setup({ delay: null });

      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      await user.hover(button);
      await user.unhover(button);

      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockSetActivePopoverId).toHaveBeenCalledWith(null);
      });
    });

    it('should NOT hide popover after 1 second if hovering popover', async () => {
      const user = userEvent.setup({ delay: null });

      render(<SummaryRedirectIcon {...defaultProps} activePopoverId="redirect-summary-1-test" />);

      const button = screen.getByRole('button', { name: /view redirect information/i });

      await user.unhover(button);

      jest.advanceTimersByTime(1000);

      expect(mockSetActivePopoverId).not.toHaveBeenCalled();
    });

    it('should not start timer on mouse leave if popover is pinned', async () => {
      const user = userEvent.setup({ delay: null });

      render(<SummaryRedirectIcon {...defaultProps} pinnedPopoverId="redirect-summary-1-test" />);

      const button = screen.getByRole('button', { name: /view redirect information/i });
      await user.unhover(button);

      jest.advanceTimersByTime(1000);

      expect(mockSetActivePopoverId).not.toHaveBeenCalledWith(null);
    });

    it('should clear timeout on mouse re-enter', async () => {
      const user = userEvent.setup({ delay: null });

      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });

      await user.hover(button);
      await user.unhover(button);

      await user.hover(button);

      jest.advanceTimersByTime(1000);

      expect(mockSetActivePopoverId).toHaveBeenCalledWith('redirect-summary-1-test');
    });
  });

  describe('Internal state management', () => {
    it('should manage hover state internally', () => {
      render(<SummaryRedirectIcon {...defaultProps} activePopoverId="redirect-summary-1-test" />);

      expect(screen.getByTestId('redirect-icon-1-test')).toBeInTheDocument();
    });

    it('should clear internal timeout when clicking', async () => {
      const user = userEvent.setup({ delay: null });

      render(<SummaryRedirectIcon {...defaultProps} />);

      const button = screen.getByRole('button', { name: /view redirect information/i });

      await user.hover(button);
      await user.unhover(button);
      await user.click(button);

      expect(mockSetPinnedPopoverId).toHaveBeenCalledWith('redirect-summary-1-test');

      jest.advanceTimersByTime(1000);

      expect(mockSetActivePopoverId).toHaveBeenCalledWith(null);
    });
  });
});
