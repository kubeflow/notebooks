import '@testing-library/jest-dom';
import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceFormPropertiesSelection } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection';
import { WorkspaceFormMode, WorkspaceFormProperties } from '~/app/types';

jest.mock('~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes', () => ({
  WorkspaceFormPropertiesVolumes: () => <div data-testid="mock-volumes" />,
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
  ) => {
    const onSelect = jest.fn();
    render(
      <WorkspaceFormPropertiesSelection
        mode={mode}
        selectedProperties={properties}
        onSelect={onSelect}
      />,
    );
    return { onSelect };
  };

  it('auto-generates workspace name from display name', () => {
    const { onSelect } = renderComponent();

    const displayNameInput = screen.getByTestId('display-name');
    fireEvent.change(displayNameInput, { target: { value: 'My Workspace' } });

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'My Workspace',
        workspaceName: 'my-workspace',
      }),
    );
  });

  it('locks workspace name after manual edit', () => {
    let currentProperties: WorkspaceFormProperties = {
      ...baseProperties,
      displayName: 'My Workspace',
      workspaceName: 'my-workspace',
    };

    const onSelect = jest.fn((next: WorkspaceFormProperties) => {
      currentProperties = next;
    });

    const { rerender } = render(
      <WorkspaceFormPropertiesSelection
        mode="create"
        selectedProperties={currentProperties}
        onSelect={onSelect}
      />,
    );

    const workspaceNameInput = screen.getByTestId('workspace-name');
    fireEvent.change(workspaceNameInput, { target: { value: 'custom-name' } });

    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspaceName: 'custom-name' }),
    );

    rerender(
      <WorkspaceFormPropertiesSelection
        mode="create"
        selectedProperties={currentProperties}
        onSelect={onSelect}
      />,
    );

    const displayNameInput = screen.getByTestId('display-name');
    fireEvent.change(displayNameInput, { target: { value: 'Totally Different Name' } });

    expect(onSelect).toHaveBeenLastCalledWith(
      expect.objectContaining({
        displayName: 'Totally Different Name',
        workspaceName: 'custom-name',
      }),
    );
  });

  it('shows validation error for invalid display name characters', () => {
    renderComponent();
    const displayNameInput = screen.getByTestId('display-name');
    fireEvent.change(displayNameInput, { target: { value: 'Bad@Name!' } });

    expect(
      screen.getByText(/Only letters, numbers, spaces, and - _ \. are allowed\./i),
    ).toBeInTheDocument();
  });

  it('shows validation error for invalid manual workspace name', () => {
    renderComponent();
    const workspaceNameInput = screen.getByTestId('workspace-name');
    fireEvent.change(workspaceNameInput, { target: { value: 'Invalid_Name' } });

    expect(screen.getByText(/Must be lowercase alphanumeric/i)).toBeInTheDocument();
  });
});
