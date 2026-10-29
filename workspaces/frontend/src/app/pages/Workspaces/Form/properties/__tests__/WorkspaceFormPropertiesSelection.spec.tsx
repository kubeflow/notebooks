import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceFormPropertiesSelection } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesSelection';
import { WorkspaceFormMode, WorkspaceFormProperties } from '~/app/types';

jest.mock('~/app/hooks/usePVCs', () => ({
  __esModule: true,
  default: () => ({ pvcs: [], pvcLoadError: null }),
}));

jest.mock('~/app/hooks/useNotebookAPI', () => ({
  useNotebookAPI: () => ({ api: { pvc: { deletePvc: jest.fn() } }, apiAvailable: true }),
}));

jest.mock('~/app/hooks/useStorageClasses', () => ({
  __esModule: true,
  default: () => ({ storageClasses: [], storageClassLoadError: null }),
}));

jest.mock('~/app/hooks/useSecrets', () => ({
  __esModule: true,
  default: () => ({ secrets: [], refreshSecrets: jest.fn() }),
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

  it('keeps the home mount path locked in the edit volume modal when kind is not loaded yet', () => {
    const properties: WorkspaceFormProperties = {
      displayName: 'my-workspace',
      name: 'my-workspace',
      homeVolume: {
        pvcName: 'home-pvc',
        mountPath: '/home/jovyan',
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

    fireEvent.click(screen.getByTestId('volume-kebab-home-pvc'));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(screen.getByTestId('mount-path-input')).toBeDisabled();
    expect(screen.queryByTestId('mount-path-edit')).not.toBeInTheDocument();
  });
});

describe('WorkspaceFormPropertiesSelection expansion', () => {
  it.each<[WorkspaceFormMode, number, number]>([
    ['update', 0, 0],
    ['update', 1, 0],
    ['update', 0, 1],
    ['update', 1, 1],
    ['create', 0, 0],
  ])(
    'preserves defaults and manual toggles in %s mode (%i volumes, %i secrets)',
    (mode, volumes, secrets) => {
      const props: React.ComponentProps<typeof WorkspaceFormPropertiesSelection> = {
        mode,
        namespace: 'default',
        selectedProperties: {
          displayName: 'workspace',
          name: 'workspace',
          homeVolume: undefined,
          volumes: volumes ? [{ pvcName: 'data-pvc', mountPath: '/data', readOnly: false }] : [],
          secrets: secrets
            ? [{ secretName: 'secret', mountPath: '/secrets', defaultMode: 420 }]
            : [],
        },
        onSelect: jest.fn(),
        displayNameError: null,
        onDisplayNameChange: jest.fn(),
        resourceNameError: null,
        isResourceNameEditing: false,
        onStartResourceNameEdit: jest.fn(),
        onResourceNameChange: jest.fn(),
      };
      const { rerender } = render(<WorkspaceFormPropertiesSelection {...props} />);

      for (const [name, count] of [
        ['Data Volumes', volumes],
        ['Secrets', secrets],
      ] as const) {
        const toggle = screen.getByRole('button', { name });
        expect(toggle).toHaveAttribute('aria-expanded', String(count > 0));
        for (const expanded of [count === 0, count > 0]) {
          fireEvent.click(toggle);
          rerender(
            <WorkspaceFormPropertiesSelection
              {...props}
              selectedProperties={{ ...props.selectedProperties, displayName: 'renamed' }}
            />,
          );
          expect(toggle).toHaveAttribute('aria-expanded', String(expanded));
        }
      }
    },
  );
});
