import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceFormKindList } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindList';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

jest.mock('~/shared/components/WithValidImage', () => ({
  __esModule: true,
  default: ({ children }: { children: (src: string) => React.ReactNode }) =>
    children('mocked-logo-src'),
}));

jest.mock('~/shared/components/ImageFallback', () => ({
  __esModule: true,
  default: () => null,
}));

describe('WorkspaceFormKindList', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const defaultProps = {
    selectedKind: undefined,
    onSelect: mockOnSelect,
    isSelectionDisabled: false,
  };

  describe('ruleEffects.uiHide filtering', () => {
    it('shows kinds with uiHide: false', () => {
      const kind = buildMockWorkspaceKind({
        name: 'visible-kind',
        displayName: 'Visible Kind',
        ruleEffects: { uiHide: false, aclDeny: false },
      });

      render(<WorkspaceFormKindList {...defaultProps} allWorkspaceKinds={[kind]} />);

      expect(screen.getByText('Visible Kind')).toBeInTheDocument();
    });

    it('hides kinds with uiHide set to true', () => {
      const kind = buildMockWorkspaceKind({
        name: 'hidden-kind',
        displayName: 'Hidden Kind',
        ruleEffects: { uiHide: true, aclDeny: false },
      });

      render(<WorkspaceFormKindList {...defaultProps} allWorkspaceKinds={[kind]} />);

      expect(screen.queryByText('Hidden Kind')).not.toBeInTheDocument();
    });

    it('shows kinds when ruleEffects is undefined', () => {
      const kind = buildMockWorkspaceKind({
        name: 'no-rule-effects-kind',
        displayName: 'No Rule Effects Kind',
        ruleEffects: undefined,
      });

      render(<WorkspaceFormKindList {...defaultProps} allWorkspaceKinds={[kind]} />);

      expect(screen.getByText('No Rule Effects Kind')).toBeInTheDocument();
    });

    it('shows visible kinds and hides uiHide kinds when both are present', () => {
      const visibleKind = buildMockWorkspaceKind({
        name: 'visible-kind',
        displayName: 'Visible Kind',
        ruleEffects: { uiHide: false, aclDeny: false },
      });
      const hiddenKind = buildMockWorkspaceKind({
        name: 'hidden-kind',
        displayName: 'Hidden Kind',
        ruleEffects: { uiHide: true, aclDeny: false },
      });

      render(
        <WorkspaceFormKindList {...defaultProps} allWorkspaceKinds={[visibleKind, hiddenKind]} />,
      );

      expect(screen.getByText('Visible Kind')).toBeInTheDocument();
      expect(screen.queryByText('Hidden Kind')).not.toBeInTheDocument();
    });

    it('shows empty state when all kinds are hidden by uiHide', () => {
      const hiddenKind1 = buildMockWorkspaceKind({
        name: 'hidden-kind-1',
        displayName: 'Hidden Kind 1',
        ruleEffects: { uiHide: true, aclDeny: false },
      });
      const hiddenKind2 = buildMockWorkspaceKind({
        name: 'hidden-kind-2',
        displayName: 'Hidden Kind 2',
        ruleEffects: { uiHide: true, aclDeny: false },
      });

      render(
        <WorkspaceFormKindList {...defaultProps} allWorkspaceKinds={[hiddenKind1, hiddenKind2]} />,
      );

      expect(screen.queryByText('Hidden Kind 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Hidden Kind 2')).not.toBeInTheDocument();
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });
  });
});
