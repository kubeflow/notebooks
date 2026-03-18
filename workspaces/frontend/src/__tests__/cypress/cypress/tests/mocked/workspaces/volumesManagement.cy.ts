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
  buildMockStorageClass,
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

  // Create mock storage classes for create modal
  const mockStorageClasses = [
    buildMockStorageClass({
      name: 'standard',
      displayName: 'Standard',
      description: 'Default storage class',
      canUse: true,
    }),
    buildMockStorageClass({
      name: 'ssd',
      displayName: 'SSD',
      description: 'High-performance SSD storage',
      canUse: true,
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

    cy.interceptApi(
      'GET /api/:apiVersion/workspaces/:namespace/:workspaceName',
      {
        path: {
          apiVersion: NOTEBOOKS_API_VERSION,
          namespace: mockNamespace.name,
          workspaceName: mockWorkspaceListItem.name,
        },
      },
      mockModArchResponse(mockWorkspaceUpdate),
    ).as('getWorkspace');

    cy.interceptApi(
      'GET /api/:apiVersion/workspacekinds/:kind',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: mockWorkspaceKindInfo.name } },
      mockModArchResponse(mockWorkspaceKindFull),
    ).as('getWorkspaceKind');

    cy.interceptApi(
      'GET /api/:apiVersion/persistentvolumeclaims/:namespace',
      { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
      mockModArchResponse(mockPVCs),
    ).as('listPVCs');

    cy.intercept('GET', `/api/${NOTEBOOKS_API_VERSION}/storageclasses`, {
      data: mockStorageClasses,
    }).as('listStorageClasses');

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

    // Expand the Data Volumes section
    cy.contains('button', 'Data Volumes').click();
    cy.wait('@listPVCs');
  });

  describe('Empty State', () => {
    it('should display empty state when no volumes are attached', () => {
      volumesManagement.assertEmptyStateVisible();
    });

    it('should display attach and create buttons in empty state', () => {
      volumesManagement.findAttachExistingPVCButton().should('be.visible');
      volumesManagement.findCreateVolumeButton().should('be.visible');
    });
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
    });

    it('should display storage class dropdown with available classes', () => {
      volumesManagement.clickCreateVolume();
      cy.wait('@listStorageClasses');
      volumesCreateModal.assertModalVisible();

      volumesCreateModal.findStorageClassSelect().should('be.visible');
    });

    it('should have ReadWriteOnce selected as default access mode', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertModalVisible();

      volumesCreateModal.assertAccessModeChecked('ReadWriteOnce');
    });

    it('should create a volume and display it in the table', () => {
      cy.intercept(
        'POST',
        `/api/${NOTEBOOKS_API_VERSION}/persistentvolumeclaims/${mockNamespace.name}`,
        {
          data: {
            name: 'new-volume',
            accessModes: ['ReadWriteOnce'],
            requests: { storage: '1Gi' },
            storageClassName: 'standard',
          },
        },
      ).as('createPVC');

      volumesManagement.clickCreateVolume();
      cy.wait('@listStorageClasses');
      volumesCreateModal.assertModalVisible();

      volumesCreateModal.typePVCName('new-volume');
      volumesCreateModal.assertSubmitButtonEnabled();
      volumesCreateModal.clickSubmit();

      cy.wait('@createPVC');

      // Modal should close
      volumesCreateModal.assertModalNotExists();

      // Verify volume appears in table with auto-generated mount path
      volumesManagement.assertVolumeRowExists('new-volume');
      volumesManagement.assertVolumeMountPath('new-volume', '/data/new-volume');
      volumesManagement.assertVolumeReadOnly('new-volume', false);
    });

    it('should create a volume with read-only access', () => {
      cy.intercept(
        'POST',
        `/api/${NOTEBOOKS_API_VERSION}/persistentvolumeclaims/${mockNamespace.name}`,
        {
          data: {
            name: 'readonly-vol',
            accessModes: ['ReadWriteOnce'],
            requests: { storage: '1Gi' },
            storageClassName: 'standard',
          },
        },
      ).as('createPVC');

      volumesManagement.clickCreateVolume();
      cy.wait('@listStorageClasses');
      volumesCreateModal.typePVCName('readonly-vol');
      volumesCreateModal.toggleReadOnly();
      volumesCreateModal.clickSubmit();

      cy.wait('@createPVC');

      volumesManagement.assertVolumeRowExists('readonly-vol');
      volumesManagement.assertVolumeReadOnly('readonly-vol', true);
    });

    it('should allow selecting a different access mode', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertModalVisible();

      volumesCreateModal.selectAccessMode('ReadWriteMany');
      volumesCreateModal.assertAccessModeChecked('ReadWriteMany');
    });

    it('should allow selecting a different storage class', () => {
      volumesManagement.clickCreateVolume();
      cy.wait('@listStorageClasses');

      volumesCreateModal.selectStorageClass('ssd');
      volumesCreateModal.findStorageClassSelect().should('contain.text', 'SSD');
    });

    it('should disable submit button when volume name is empty', () => {
      volumesManagement.clickCreateVolume();
      cy.wait('@listStorageClasses');
      volumesCreateModal.assertSubmitButtonDisabled();
    });

    it('should close modal on cancel', () => {
      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertModalVisible();

      volumesCreateModal.clickCancel();
      volumesCreateModal.assertModalNotExists();
    });

    it('should reset form when reopened', () => {
      volumesManagement.clickCreateVolume();
      cy.wait('@listStorageClasses');

      volumesCreateModal.typePVCName('test-name');
      volumesCreateModal.clickCancel();

      volumesManagement.clickCreateVolume();
      volumesCreateModal.assertPVCNameValue('');
    });

    it('should show error when API call fails', () => {
      cy.intercept(
        'POST',
        `/api/${NOTEBOOKS_API_VERSION}/persistentvolumeclaims/${mockNamespace.name}`,
        { statusCode: 409, body: { message: 'PVC already exists' } },
      ).as('createPVCFail');

      volumesManagement.clickCreateVolume();
      cy.wait('@listStorageClasses');

      volumesCreateModal.typePVCName('existing-pvc');
      volumesCreateModal.clickSubmit();

      cy.wait('@createPVCFail');

      volumesCreateModal.assertErrorAlertVisible();
    });
  });

  describe('Edit Volume Modal', () => {
    beforeEach(() => {
      // Attach a volume first so we have something to edit
      volumesManagement.clickAttachExistingPVC();
      volumesAttachModal.selectPVC('data-pvc');
      volumesAttachModal.clickAttach();
      volumesManagement.assertVolumeRowExists('data-pvc');
    });

    it('should open edit modal without PVC configuration fields', () => {
      volumesManagement.clickEditAction('data-pvc');
      volumesCreateModal.assertModalVisible();
      volumesCreateModal.findPVCNameInput().should('not.exist');
      volumesCreateModal.findStorageClassSelect().should('not.exist');
    });

    it('should update read-only access via edit modal', () => {
      volumesManagement.assertVolumeReadOnly('data-pvc', false);

      volumesManagement.clickEditAction('data-pvc');
      volumesCreateModal.assertModalVisible();
      volumesCreateModal.toggleReadOnly();
      volumesCreateModal.clickSubmit();

      volumesCreateModal.assertModalNotExists();
      volumesManagement.assertVolumeReadOnly('data-pvc', true);
    });

    it('should close edit modal on cancel without changes', () => {
      volumesManagement.clickEditAction('data-pvc');
      volumesCreateModal.assertModalVisible();
      volumesCreateModal.toggleReadOnly();
      volumesCreateModal.clickCancel();

      volumesCreateModal.assertModalNotExists();
      volumesManagement.assertVolumeReadOnly('data-pvc', false);
    });
  });
});
