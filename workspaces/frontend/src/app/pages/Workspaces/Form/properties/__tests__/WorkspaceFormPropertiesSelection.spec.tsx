import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceFormPropertiesSelection } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection';
import { WorkspaceFormProperties } from '~/app/types';

jest.mock('~/app/hooks/usePVCs', () => ({
  __esModule: true,
  default: () => ({ pvcs: [], pvcLoadError: null }),
}));

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({ api: { pvc: { deletePvc: jest.fn() } }, apiAvailable: true }),
}));

jest.mock('~/app/pages/Workspaces/Form/properties/volumes/VolumesCreateModal', () => ({
  VolumesCreateModal: () => null,
}));

jest.mock('~/app/pages/Workspaces/Form/properties/volumes/VolumesAttachModal', () => ({
  VolumesAttachModal: () => null,
}));

jest.mock('~/app/pages/Workspaces/Form/properties/secrets/SecretsCreateModal', () => ({
  SecretsCreateModal: () => null,
}));

jest.mock('~/app/pages/Workspaces/Form/properties/secrets/SecretsAttachModal', () => ({
  SecretsAttachModal: () => null,
}));

describe('WorkspaceFormPropertiesSelection mount paths', () => {
  it('locks the home mount path while keeping data volume paths editable', () => {
    const properties: WorkspaceFormProperties = {
      displayName: 'my-workspace',
      name: 'my-workspace',
      homeVolume: {
        pvcName: 'home-pvc',
        mountPath: '',
        readOnly: false,
        isAttached: true,
      },
      volumes: [
        {
          pvcName: 'data-pvc',
          mountPath: '/data',
          readOnly: false,
          isAttached: true,
        },
      ],
      secrets: [],
    };

    render(
      <WorkspaceFormPropertiesSelection
        mode="update"
        namespace="default"
        selectedProperties={properties}
        onSelect={jest.fn()}
        homeVolumeMountPath="/home/jovyan"
        displayNameError={null}
        onDisplayNameChange={jest.fn()}
        resourceNameError={null}
        isResourceNameEditing={false}
        onStartResourceNameEdit={jest.fn()}
        onResourceNameChange={jest.fn()}
      />,
    );

    expect(screen.getByText('/home/jovyan')).toBeInTheDocument();
    expect(screen.getByTestId('edit-mount-path-home-pvc')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Data Volumes' }));
    const dataMountPathEdit = screen.getByTestId('edit-mount-path-data-pvc');
    expect(dataMountPathEdit).toBeEnabled();

    fireEvent.click(dataMountPathEdit);
    expect(screen.getByTestId('edit-mount-path-input-data-pvc')).toBeInTheDocument();
  });

  it('keeps the home mount path locked and does not look blank when kind is not loaded yet', () => {
    const properties: WorkspaceFormProperties = {
      displayName: 'my-workspace',
      name: 'my-workspace',
      homeVolume: {
        pvcName: 'home-pvc',
        mountPath: '',
        readOnly: false,
        isAttached: true,
      },
      volumes: [],
      secrets: [],
    };

    render(
      <WorkspaceFormPropertiesSelection
        mode="update"
        namespace="default"
        selectedProperties={properties}
        onSelect={jest.fn()}
        homeVolumeMountPath={undefined}
        displayNameError={null}
        onDisplayNameChange={jest.fn()}
        resourceNameError={null}
        isResourceNameEditing={false}
        onStartResourceNameEdit={jest.fn()}
        onResourceNameChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('edit-mount-path-home-pvc')).toBeDisabled();
    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
