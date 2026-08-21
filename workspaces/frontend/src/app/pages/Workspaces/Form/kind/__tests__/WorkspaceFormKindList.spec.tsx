// cspell:ignore rstudio

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { WorkspaceFormKindList } from '~/app/pages/Workspaces/Form/kind/WorkspaceFormKindList';

// For this test, we're using mock WorkspaceKindImage, because image loading and API context are unrelated to the behavior we are testing.

jest.mock('~/app/components/WorkspaceKindImage', () => ({
  __esModule: true,
  default: ({ children }: { children: (src: string) => React.ReactNode }) =>
    children('mock-logo.svg'),
}));

describe('WorkspaceFormKindList', () => {
  it('renders workspace kinds sorted by display name', () => {
    const vscode = buildMockWorkspaceKind({
      name: 'codeserver',
      displayName: 'VS Code',
    });

    const jupyter = buildMockWorkspaceKind({
      name: 'jupyterlab',
      displayName: 'JupyterLab',
    });

    const rStudio = buildMockWorkspaceKind({
      name: 'rstudio',
      displayName: 'RStudio',
    });

    render(
      <WorkspaceFormKindList
        allWorkspaceKinds={[vscode, jupyter, rStudio]}
        selectedKind={undefined}
        onSelect={jest.fn()}
        isSelectionDisabled={false}
      />,
    );

    const cards = screen.getAllByTestId(/^kind-card-/);

    // We aren't testing .sort() itself. We're testing the user-visible guarantee.

    expect(cards.map((card) => card.getAttribute('data-testid'))).toEqual([
      'kind-card-jupyterlab',
      'kind-card-rstudio',
      'kind-card-codeserver',
    ]);
  });

  it('uses name as a tie-breaker when display names are equal', () => {
    const second = buildMockWorkspaceKind({
      name: 'jupyter-z',
      displayName: 'JupyterLab',
    });

    const first = buildMockWorkspaceKind({
      name: 'jupyter-a',
      displayName: 'JupyterLab',
    });

    render(
      <WorkspaceFormKindList
        allWorkspaceKinds={[second, first]}
        selectedKind={undefined}
        onSelect={jest.fn()}
        isSelectionDisabled={false}
      />,
    );

    const cards = screen.getAllByTestId(/^kind-card-/);

    expect(cards.map((card) => card.getAttribute('data-testid'))).toEqual([
      'kind-card-jupyter-a',
      'kind-card-jupyter-z',
    ]);
  });
});
