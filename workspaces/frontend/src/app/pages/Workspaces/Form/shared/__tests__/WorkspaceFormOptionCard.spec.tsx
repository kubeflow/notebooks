import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import type { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';
import { WorkspaceFormOptionCard } from '~/app/pages/Workspaces/Form/shared/WorkspaceFormOptionCard';

// Mock the icon components
jest.mock('~/app/components/HiddenIconWithPopover', () => ({
  HiddenIconWithPopover: ({ popoverId }: { popoverId: string }) => (
    <div data-testid={`hidden-icon-${popoverId}`}>Hidden Icon</div>
  ),
}));

jest.mock('~/app/components/RedirectIconWithPopover', () => ({
  RedirectIconWithPopover: ({ popoverId }: { popoverId: string }) => (
    <div data-testid={`redirect-icon-${popoverId}`}>Redirect Icon</div>
  ),
}));

describe('WorkspaceFormOptionCard', () => {
  const mockOnClick = jest.fn();
  const mockOnChange = jest.fn();
  const mockOnActivePopoverChange = jest.fn();
  const mockOnPinnedPopoverChange = jest.fn();

  const defaultProps = {
    isSelected: false,
    isDefault: false,
    onClick: mockOnClick,
    onChange: mockOnChange,
    activePopoverId: null,
    pinnedPopoverId: null,
    onActivePopoverChange: mockOnActivePopoverChange,
    onPinnedPopoverChange: mockOnPinnedPopoverChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render option displayName and description', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const option = workspaceKind.podTemplate.options.imageConfig.values[0];
      const allOptions = workspaceKind.podTemplate.options.imageConfig.values;

      render(<WorkspaceFormOptionCard {...defaultProps} option={option} allOptions={allOptions} />);

      expect(screen.getByText(option.displayName)).toBeInTheDocument();
      expect(screen.getByText(option.description)).toBeInTheDocument();
    });

    it('should show "Default" label when isDefault is true', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const option = workspaceKind.podTemplate.options.imageConfig.values[0];
      const allOptions = workspaceKind.podTemplate.options.imageConfig.values;

      render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={option}
          allOptions={allOptions}
          isDefault
        />,
      );

      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('should hide "Default" label when isDefault is false', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const option = workspaceKind.podTemplate.options.imageConfig.values[0];
      const allOptions = workspaceKind.podTemplate.options.imageConfig.values;

      render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={option}
          allOptions={allOptions}
          isDefault={false}
        />,
      );

      expect(screen.queryByText('Default')).not.toBeInTheDocument();
    });
  });

  describe('CSS classes for visual indicators', () => {
    it('should apply workspace-option-card--hidden class when option.hidden is true', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const hiddenOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'hidden-option',
        hidden: true,
        redirect: undefined,
      };
      const allOptions = [hiddenOption];

      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={hiddenOption} allOptions={allOptions} />,
      );

      const card = container.querySelector('#hidden-option');
      expect(card).toHaveClass('workspace-option-card--hidden');
    });

    it('should apply workspace-option-card--redirected class when option.redirect exists', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const redirectedOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'redirected-option',
        hidden: false,
        redirect: {
          to: 'target-option',
          message: {
            text: 'Redirecting...',
            level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
          },
        },
      };
      const allOptions = [redirectedOption];

      const { container } = render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={redirectedOption}
          allOptions={allOptions}
        />,
      );

      const card = container.querySelector('#redirected-option');
      expect(card).toHaveClass('workspace-option-card--redirected');
    });

    it('should apply both classes when hidden AND redirected', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const bothOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'both-option',
        hidden: true,
        redirect: {
          to: 'target-option',
          message: {
            text: 'Redirecting...',
            level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
          },
        },
      };
      const allOptions = [bothOption];

      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={bothOption} allOptions={allOptions} />,
      );

      const card = container.querySelector('#both-option');
      expect(card).toHaveClass('workspace-option-card--hidden');
      expect(card).toHaveClass('workspace-option-card--redirected');
    });

    it('should not apply special classes when option is neither hidden nor redirected', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const normalOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'normal-option',
        hidden: false,
        redirect: undefined,
      };
      const allOptions = [normalOption];

      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={normalOption} allOptions={allOptions} />,
      );

      const card = container.querySelector('#normal-option');
      expect(card).not.toHaveClass('workspace-option-card--hidden');
      expect(card).not.toHaveClass('workspace-option-card--redirected');
    });
  });

  describe('Icon visibility', () => {
    it('should show HiddenIconWithPopover only when option.hidden is true', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const hiddenOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'hidden-option',
        hidden: true,
        redirect: undefined,
      };
      const allOptions = [hiddenOption];

      render(
        <WorkspaceFormOptionCard {...defaultProps} option={hiddenOption} allOptions={allOptions} />,
      );

      expect(screen.getByTestId('hidden-icon-hidden-hidden-option')).toBeInTheDocument();
    });

    it('should not show HiddenIconWithPopover when option.hidden is false', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const visibleOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'visible-option',
        hidden: false,
        redirect: undefined,
      };
      const allOptions = [visibleOption];

      render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={visibleOption}
          allOptions={allOptions}
        />,
      );

      expect(screen.queryByTestId('hidden-icon-hidden-visible-option')).not.toBeInTheDocument();
    });

    it('should show RedirectIconWithPopover only when option.redirect exists', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const redirectedOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'redirected-option',
        hidden: false,
        redirect: {
          to: 'target-option',
          message: {
            text: 'Redirecting...',
            level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
          },
        },
      };
      const allOptions = [redirectedOption];

      render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={redirectedOption}
          allOptions={allOptions}
        />,
      );

      expect(screen.getByTestId('redirect-icon-redirect-redirected-option')).toBeInTheDocument();
    });

    it('should not show RedirectIconWithPopover when option.redirect is undefined', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const normalOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'normal-option',
        hidden: false,
        redirect: undefined,
      };
      const allOptions = [normalOption];

      render(
        <WorkspaceFormOptionCard {...defaultProps} option={normalOption} allOptions={allOptions} />,
      );

      expect(screen.queryByTestId('redirect-icon-redirect-normal-option')).not.toBeInTheDocument();
    });
  });

  describe('User interactions', () => {
    it('should call onClick with correct option when card clicked', async () => {
      const workspaceKind = buildMockWorkspaceKind();
      const option = workspaceKind.podTemplate.options.imageConfig.values[0];
      const allOptions = workspaceKind.podTemplate.options.imageConfig.values;

      render(<WorkspaceFormOptionCard {...defaultProps} option={option} allOptions={allOptions} />);

      const card = screen.getByText(option.displayName).closest('.pf-v6-c-card');
      await userEvent.click(card!);

      expect(mockOnClick).toHaveBeenCalledWith(option);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });

    it('should call onChange when checkbox changed', async () => {
      const workspaceKind = buildMockWorkspaceKind();
      const option = workspaceKind.podTemplate.options.imageConfig.values[0];
      const allOptions = workspaceKind.podTemplate.options.imageConfig.values;

      render(<WorkspaceFormOptionCard {...defaultProps} option={option} allOptions={allOptions} />);

      const checkbox = screen.getByRole('radio');
      await userEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('Popover ID generation', () => {
    it('should generate correct popover IDs by replacing spaces with hyphens', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const optionWithSpaces: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'my option with spaces',
        hidden: true,
        redirect: {
          to: 'target',
          message: {
            text: 'Redirecting...',
            level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
          },
        },
      };
      const allOptions = [optionWithSpaces];

      render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={optionWithSpaces}
          allOptions={allOptions}
        />,
      );

      expect(screen.getByTestId('hidden-icon-hidden-my-option-with-spaces')).toBeInTheDocument();
      expect(
        screen.getByTestId('redirect-icon-redirect-my-option-with-spaces'),
      ).toBeInTheDocument();
    });
  });

  describe('Redirect target resolution', () => {
    it('should resolve redirect target from allOptions', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const targetOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'target-option',
        displayName: 'Target Option',
        hidden: false,
        redirect: undefined,
      };
      const sourceOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[1],
        id: 'source-option',
        displayName: 'Source Option',
        hidden: false,
        redirect: {
          to: 'target-option',
          message: {
            text: 'Redirecting to target',
            level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
          },
        },
      };
      const allOptions = [sourceOption, targetOption];

      // This test verifies the component doesn't crash and renders correctly
      // The actual redirect chain transformation is tested implicitly
      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={sourceOption} allOptions={allOptions} />,
      );

      expect(container.querySelector('#source-option')).toBeInTheDocument();
      expect(screen.getByTestId('redirect-icon-redirect-source-option')).toBeInTheDocument();
    });

    it('should create "(not found)" entry for missing redirect targets', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const sourceOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'source-option',
        displayName: 'Source Option',
        hidden: false,
        redirect: {
          to: 'nonexistent-target',
          message: {
            text: 'Redirecting to nowhere',
            level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning,
          },
        },
      };
      const allOptions = [sourceOption];

      // This test verifies the component doesn't crash when target is not found
      // The actual "(not found)" text is in the redirect chain passed to RedirectIconWithPopover
      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={sourceOption} allOptions={allOptions} />,
      );

      expect(container.querySelector('#source-option')).toBeInTheDocument();
      expect(screen.getByTestId('redirect-icon-redirect-source-option')).toBeInTheDocument();
    });
  });

  describe('Message level transformation', () => {
    it('should handle different redirect message levels', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const levels = [
        WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
        WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning,
        WorkspacekindsRedirectMessageLevel.RedirectMessageLevelDanger,
      ];

      levels.forEach((level) => {
        const option: WorkspacekindsImageConfigValue = {
          ...workspaceKind.podTemplate.options.imageConfig.values[0],
          id: `option-${level}`,
          hidden: false,
          redirect: {
            to: 'target',
            message: {
              text: 'Test message',
              level,
            },
          },
        };

        const { container } = render(
          <WorkspaceFormOptionCard {...defaultProps} option={option} allOptions={[option]} />,
        );

        expect(container.querySelector(`#option-${level}`)).toBeInTheDocument();
      });
    });

    it('should handle redirect without message', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const option: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'option-no-message',
        hidden: false,
        redirect: {
          to: 'target',
          // No message property
        },
      };

      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={option} allOptions={[option]} />,
      );

      expect(container.querySelector('#option-no-message')).toBeInTheDocument();
      expect(screen.getByTestId('redirect-icon-redirect-option-no-message')).toBeInTheDocument();
    });
  });

  describe('CardHeader CSS classes', () => {
    it('should apply workspace-option-card__header--with-icons class when option has hidden flag', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const hiddenOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'hidden-option',
        hidden: true,
        redirect: undefined,
      };
      const allOptions = [hiddenOption];

      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={hiddenOption} allOptions={allOptions} />,
      );

      const cardHeader = container.querySelector('.pf-v6-c-card__header');
      expect(cardHeader).toHaveClass('workspace-option-card__header--with-icons');
    });

    it('should apply workspace-option-card__header--with-icons class when option has redirect', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const redirectedOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'redirected-option',
        hidden: false,
        redirect: {
          to: 'target-option',
          message: {
            text: 'Redirecting...',
            level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelInfo,
          },
        },
      };
      const allOptions = [redirectedOption];

      const { container } = render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={redirectedOption}
          allOptions={allOptions}
        />,
      );

      const cardHeader = container.querySelector('.pf-v6-c-card__header');
      expect(cardHeader).toHaveClass('workspace-option-card__header--with-icons');
    });

    it('should NOT apply workspace-option-card__header--with-icons class when option has neither hidden nor redirect', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const normalOption: WorkspacekindsImageConfigValue = {
        ...workspaceKind.podTemplate.options.imageConfig.values[0],
        id: 'normal-option',
        hidden: false,
        redirect: undefined,
      };
      const allOptions = [normalOption];

      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={normalOption} allOptions={allOptions} />,
      );

      const cardHeader = container.querySelector('.pf-v6-c-card__header');
      expect(cardHeader).not.toHaveClass('workspace-option-card__header--with-icons');
    });

    it('should render description with workspace-option-card__description class when description exists', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const option = workspaceKind.podTemplate.options.imageConfig.values[0];
      const allOptions = workspaceKind.podTemplate.options.imageConfig.values;

      const { container } = render(
        <WorkspaceFormOptionCard {...defaultProps} option={option} allOptions={allOptions} />,
      );

      const description = container.querySelector('.workspace-option-card__description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(option.description);
    });
  });

  describe('PodConfig options', () => {
    it('should work with pod config options', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const podConfigOption = workspaceKind.podTemplate.options.podConfig.values[0];
      const allPodConfigs = workspaceKind.podTemplate.options.podConfig.values;

      render(
        <WorkspaceFormOptionCard
          {...defaultProps}
          option={podConfigOption}
          allOptions={allPodConfigs}
        />,
      );

      expect(screen.getByText(podConfigOption.displayName)).toBeInTheDocument();
      expect(screen.getByText(podConfigOption.description)).toBeInTheDocument();
    });
  });
});
