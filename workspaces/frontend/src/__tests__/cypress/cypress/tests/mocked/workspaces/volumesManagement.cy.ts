import { mockModArchResponse } from 'mod-arch-core';
import { editWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/editWorkspace';
import {
  volumesManagement,
  volumesAttachModal,
  volumesCreateModal,
} from '~/__tests__/cypress/cypress/pages/workspaces/volumesManagement';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import {
  buildMockNamespace,
  buildMockPVC,
  buildMockWorkspace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindInfo,
  buildMockWorkspaceUpdateFromWorkspace,
} from '~/shared/mock/mockBuilder';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import {
  V1Beta1WorkspaceState,
  V1PersistentVolumeAccessMode,
  V1PersistentVolumeMode,
  V1PodPhase,
} from '~/generated/data-contracts';

describe('Volumes Management - Attach and Create', () => {
  const mockNamespace = buildMockNamespace({ name: 'default' });
  const mockWorkspaceKindInfo = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });
  const mockWorkspaceKindFull = buildMockWorkspaceKind({ name: 'jupyterlab' });

  // Create a workspace with no volumes
  const mockWorkspaceListItem = buildMockWorkspace({
    name: 'test-workspace',
    namespace: mockNamespace.name,
    workspaceKind: mockWorkspaceKindInfo,
    state: V1Beta1WorkspaceState.WorkspaceStateRunning,
  });

  // Override to have empty volumes
  mockWorkspaceListItem.podTemplate.volumes.data = [];

  const mockWorkspaceUpdate = buildMockWorkspaceUpdateFromWorkspace({
    workspace: mockWorkspaceListItem,
  });

  // Create mock PVCs for attach modal
  const mockPVCs = [
    buildMockPVC({
      name: 'data-pvc',
      canMount: true,
      pods: [],
      workspaces: [],
      pvcSpec: {
        accessModes: [V1PersistentVolumeAccessMode.ReadWriteOnce],
        requests: { storage: '10Gi' },
        storageClassName: 'standard',
        volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
      },
    }),
    buildMockPVC({
      name: 'shared-pvc',
      canMount: true,
      pods: [],
      workspaces: [],
      pvcSpec: {
        accessModes: [V1PersistentVolumeAccessMode.ReadWriteMany],
        requests: { storage: '50Gi' },
        storageClassName: 'nfs',
        volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
      },
    }),
    buildMockPVC({
      name: 'in-use-pvc',
      canMount: true,
      pods: [{ name: 'other-pod', phase: V1PodPhase.PodRunning }],
      workspaces: [],
      pvcSpec: {
        accessModes: [V1PersistentVolumeAccessMode.ReadWriteOnce],
        requests: { storage: '20Gi' },
        storageClassName: 'standard',
        volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
      },
    }),
    buildMockPVC({
      name: 'unmountable-pvc',
      canMount: false,
      pods: [],
      workspaces: [],
      pvcSpec: {
        accessModes: [V1PersistentVolumeAccessMode.ReadWriteOnce],
        requests: { storage: '5Gi' },
        storageClassName: 'standard',
        volumeMode: V1PersistentVolumeMode.PersistentVolumeFilesystem,
      },
    }),
  ];

  beforeEach(() => {
    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    ).as('getNamespaces');

    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      mockModArchResponse([mockWorkspaceListItem]),
    ).as('getWorkspaces');

    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/workspaces/${mockNamespace.name}/${mockWorkspaceListItem.name}`,
      mockModArchResponse(mockWorkspaceUpdate),
    ).as('getWorkspace');

    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/workspacekinds/${mockWorkspaceKindInfo.name}`,
      mockModArchResponse(mockWorkspaceKindFull),
    ).as('getWorkspaceKind');

    cy.intercept(
      'GET',
      `/api/${NOTEBOOKS_API_VERSION}/persistentvolumeclaims/${mockNamespace.name}`,
      { data: mockPVCs },
    ).as('listPVCs');

    // Navigate to volumes section
    workspaces.visit();
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaces');
    workspaces.findAction({ action: 'edit', workspaceName: mockWorkspaceListItem.name }).click();
    cy.wait('@getWorkspace');
    cy.wait('@getWorkspaceKind');
    editWorkspace.clickNext(); // Skip workspace kind step
    editWorkspace.clickNext(); // Skip image step
    editWorkspace.clickNext(); // Skip pod config step, now on properties

    // Expand the Volumes section
    cy.contains('button', 'Volumes').click();
    cy.wait('@listPVCs');
  });

  describe('Attach Existing Volume Modal', () => {
    it('should open attach modal and display available PVCs', () => {
      volumesManagement.clickAttachExistingPVC();
      volumesAttachModal.assertModalVisible();

      // Open dropdown to verify PVCs are listed
      volumesAttachModal.openPVCDropdown();
      cy.contains('.pf-v6-c-menu__list-item', 'data-pvc').should('exist');
      cy.contains('.pf-v6-c-menu__list-item', 'shared-pvc').should('exist');
    });

    it('should auto-fill mount path when PVC is selected', () => {
      volumesManagement.clickAttachExistingPVC();
      volumesAttachModal.assertModalVisible();

      volumesAttachModal.selectPVC('data-pvc');
      volumesAttachModal.assertMountPathValue('/data/data-pvc');
    });

    it('should attach a PVC and display it in the table', () => {
      volumesManagement.clickAttachExistingPVC();
      volumesAttachModal.assertModalVisible();

      volumesAttachModal.selectPVC('data-pvc');
      volumesAttachModal.assertAttachButtonEnabled();
      volumesAttachModal.clickAttach();

      // Modal should close
      volumesAttachModal.assertModalNotExists();

      // Verify PVC appears in table
      volumesManagement.assertVolumeRowExists('data-pvc');
      volumesManagement.assertVolumeMountPath('data-pvc', '/data/data-pvc');
      volumesManagement.assertVolumeReadOnly('data-pvc', false);
    });

    it('should close modal on cancel', () => {
      volumesManagement.clickAttachExistingPVC();
      volumesAttachModal.assertModalVisible();

      volumesAttachModal.clickCancel();
      volumesAttachModal.assertModalNotExists();
    });

    it('should disable attach button when no PVC is selected', () => {
      volumesManagement.clickAttachExistingPVC();
      volumesAttachModal.assertAttachButtonDisabled();
    });
  });

  describe('Create Volume Modal', () => {
    it('should open create volume modal', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertModalVisible();
      volumesCreateModal.assertCreateMode();
    });

    it('should create a volume manually', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertModalVisible();

      volumesCreateModal.typePVCName('manual-pvc');
      volumesCreateModal.typeMountPath('/mnt/manual');
      volumesCreateModal.assertSubmitButtonEnabled();
      volumesCreateModal.clickSubmit();

      // Modal should close
      volumesCreateModal.assertModalNotExists();

      // Verify volume appears in table
      volumesManagement.assertVolumeRowExists('manual-pvc');
      volumesManagement.assertVolumeMountPath('manual-pvc', '/mnt/manual');
    });

    it('should create a volume with read-only access', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.typePVCName('readonly-pvc');
      volumesCreateModal.typeMountPath('/mnt/readonly');
      volumesCreateModal.toggleReadOnly();
      volumesCreateModal.clickSubmit();

      volumesManagement.assertVolumeRowExists('readonly-pvc');
      volumesManagement.assertVolumeReadOnly('readonly-pvc', true);
    });

    it('should disable submit button when fields are empty', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertSubmitButtonDisabled();

      volumesCreateModal.typePVCName('test');
      volumesCreateModal.assertSubmitButtonDisabled();

      volumesCreateModal.typeMountPath('/mnt/test');
      volumesCreateModal.assertSubmitButtonEnabled();
    });

    it('should close modal on cancel', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertModalVisible();

      volumesCreateModal.clickCancel();
      volumesCreateModal.assertModalNotExists();
    });
  });
});

// Note: Edit and Detach volume tests require additional mock setup for workspaces
// with pre-existing volumes. These will be covered in integration tests.
