import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceFormPropertiesSelection } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection';
import { WorkspaceFormMode, WorkspaceFormProperties } from '~/app/types';

jest.mock('~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes', () => ({
  WorkspaceFormPropertiesVolumes: () => <div data-testid="mock-volumes" />,
}));

jest.mock('~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSecrets', () => ({
  WorkspaceFormPropertiesSecrets: () => <div data-testid="mock-secrets" />,
}));

describe('WorkspaceFormPropertiesSelection', () => {
  const baseProperties: WorkspaceFormProperties = {
    workspaceName: '',
    displayName: '',
    homeVolume: undefined,
    volumes: [],
    secrets: [],
  };

  const renderComponent = (
    properties: WorkspaceFormProperties = baseProperties,
    mode: WorkspaceFormMode = 'create',
    workspaceNameError: string | null = null,
  ) => {
    const onSelect = jest.fn();
    const onWorkspaceNameChange = jest.fn();
    const onDisplayNameChange = jest.fn();
    render(
      <WorkspaceFormPropertiesSelection
        mode={mode}
        selectedProperties={properties}
        onSelect={onSelect}
        workspaceNameError={workspaceNameError}
        onWorkspaceNameChange={onWorkspaceNameChange}
        onDisplayNameChange={onDisplayNameChange}
      />,
    );
    return { onSelect, onWorkspaceNameChange, onDisplayNameChange };
  };

  it('auto-generates workspace name slug when display name is typed', () => {
    const { onDisplayNameChange } = renderComponent();

    const displayNameInput = screen.getByTestId('display-name');
    fireEvent.change(displayNameInput, { target: { value: 'My Workspace' } });

    // onDisplayNameChange is called with (displayName, generatedSlug)
    expect(onDisplayNameChange).toHaveBeenCalledWith('My Workspace', 'my-workspace');
  });

  it('locks workspace name after manual edit — subsequent display name changes do not overwrite slug', () => {
    let currentProperties: WorkspaceFormProperties = {
      ...baseProperties,
      displayName: 'My Workspace',
      workspaceName: 'my-workspace',
    };

    const onWorkspaceNameChange = jest.fn();
    const onDisplayNameChange = jest.fn();

    const { rerender } = render(
      <WorkspaceFormPropertiesSelection
        mode="create"
        selectedProperties={currentProperties}
        onSelect={jest.fn()}
        workspaceNameError={null}
        onWorkspaceNameChange={onWorkspaceNameChange}
        onDisplayNameChange={onDisplayNameChange}
      />,
    );

    // Manually edit workspace name — locks slug
    const workspaceNameInput = screen.getByTestId('workspace-name');
    fireEvent.change(workspaceNameInput, { target: { value: 'custom-name' } });
    expect(onWorkspaceNameChange).toHaveBeenCalledWith('custom-name');

    currentProperties = { ...currentProperties, workspaceName: 'custom-name' };

    rerender(
      <WorkspaceFormPropertiesSelection
        mode="create"
        selectedProperties={currentProperties}
        onSelect={jest.fn()}
        workspaceNameError={null}
        onWorkspaceNameChange={onWorkspaceNameChange}
        onDisplayNameChange={onDisplayNameChange}
      />,
    );

    // Now change display name — slug should NOT be regenerated (isSlugManuallyEdited=true)
    const displayNameInput = screen.getByTestId('display-name');
    fireEvent.change(displayNameInput, { target: { value: 'Totally Different Name' } });

    // onDisplayNameChange called without a workspaceName argument (no regen)
    expect(onDisplayNameChange).toHaveBeenLastCalledWith('Totally Different Name');
  });

  it('shows validation error for invalid display name characters', () => {
    // Pass a displayName that validateDisplayName() will flag
    renderComponent({
      ...baseProperties,
      displayName: 'Bad🚀Name',
    });

    // The component calls validateDisplayName(selectedProperties.displayName) inline
    // and shows the error via ThemeAwareFormGroupWrapper helperTextNode
    expect(
      screen.getByText(/Only letters, numbers, spaces, and allowed characters/i),
    ).toBeInTheDocument();
  });

  it('shows workspace name error passed via prop', () => {
    renderComponent(
      { ...baseProperties, workspaceName: 'Invalid_Name' },
      'create',
      'Only lowercase alphanumeric characters, "-" or "." are allowed',
    );

    expect(
      screen.getByText(/Only lowercase alphanumeric characters, "-" or "\." are allowed/i),
    ).toBeInTheDocument();
  });

  it('disables workspace name input in update mode', () => {
    renderComponent(
      { ...baseProperties, workspaceName: 'existing-name' },
      'update',
    );

    const workspaceNameInput = screen.getByTestId('workspace-name');
    expect(workspaceNameInput).toBeDisabled();
  });

  it('shows "Workspace name cannot be changed after creation" helper text in update mode', () => {
    renderComponent({ ...baseProperties, workspaceName: 'my-ws' }, 'update');
    expect(screen.getByTestId('workspace-name-cannot-be-changed-helper')).toBeInTheDocument();
  });
});
