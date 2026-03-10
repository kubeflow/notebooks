import { mockModArchResponse } from 'mod-arch-core';
import { workspaces } from '~/__tests__/cypress/cypress/pages/workspaces/workspaces';
import {
  buildMockNamespace,
  buildMockWorkspace,
  buildMockWorkspaceKindInfo,
  buildMockPodTemplate,
  buildPodTemplateOptions,
  buildMockImageConfig,
  buildMockPodConfig,
  buildMockOptionInfo,
  buildImageRedirectChain,
  buildPodRedirectChain,
} from '~/shared/mock/mockBuilder';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import { V1Beta1WorkspaceState } from '~/generated/data-contracts';

const DEFAULT_NAMESPACE = 'default';

describe('Workspace Redirects', () => {
  describe('Redirect Icon Display', () => {
    it('should display redirect icon for image with redirect chain', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Workspace with Image Redirect',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: {
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
                description: 'JupyterLab, with SciPy Packages',
                labels: [
                  { key: 'pythonVersion', value: '3.11' },
                  { key: 'jupyterlabVersion', value: '1.8.0' },
                ],
              }),
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '2.1.0',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.assertImageRedirectIconExists(0);
    });

    it('should display redirect icon for pod config with redirect chain', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Workspace with Pod Config Redirect',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            podConfig: {
              current: buildMockOptionInfo({
                id: 'small_cpu',
                displayName: 'Small CPU',
                description: 'Pod with 0.5 CPU, 512 Mb RAM',
                labels: [
                  { key: 'cpu', value: '500m' },
                  { key: 'memory', value: '512Mi' },
                ],
              }),
              redirectChain: buildPodRedirectChain({
                startConfig: 'smallCpu',
                endConfig: 'largeCpu',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.assertPodConfigRedirectIconExists(0);
    });

    it('should not display redirect icons when no redirect chain exists', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Workspace without Redirects',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: buildMockImageConfig({
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_210',
                displayName: 'jupyter-scipy:v2.1.0',
              }),
            }),
            podConfig: buildMockPodConfig({
              current: buildMockOptionInfo({
                id: 'large_cpu',
                displayName: 'Large CPU',
              }),
            }),
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.assertImageRedirectIconNotExists(0);
      workspaces.assertPodConfigRedirectIconNotExists(0);
    });

    it('should display both redirect icons when both image and pod config have redirects', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Workspace with Both Redirects',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: {
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
                labels: [
                  { key: 'pythonVersion', value: '3.11' },
                  { key: 'jupyterlabVersion', value: '1.8.0' },
                ],
              }),
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '2.1.0',
              }),
            },
            podConfig: {
              current: buildMockOptionInfo({
                id: 'small_cpu',
                displayName: 'Small CPU',
                labels: [
                  { key: 'cpu', value: '500m' },
                  { key: 'memory', value: '512Mi' },
                ],
              }),
              redirectChain: buildPodRedirectChain({
                startConfig: 'smallCpu',
                endConfig: 'largeCpu',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.assertImageRedirectIconExists(0);
      workspaces.assertPodConfigRedirectIconExists(0);
    });
  });

  describe('Redirect Popover on Click', () => {
    it('should show popover on click on image redirect icon', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Test Workspace',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: {
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
              }),
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '1.9.0',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.clickImageRedirectIcon(0);
      workspaces.assertRedirectPopoverExists();
      workspaces.assertRedirectPopoverHeaderContains('Redirect Information');
    });

    it('should hide popover when icon is clicked again', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Test Workspace',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: {
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
              }),
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '1.9.0',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.clickImageRedirectIcon(0);
      workspaces.assertRedirectPopoverExists();

      workspaces.clickImageRedirectIcon(0);
      workspaces.assertRedirectPopoverNotExists();
    });
  });

  describe('Redirect Popover Content', () => {
    it('should display correct redirect chain information with multiple steps', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Multi-step Redirect Workspace',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: {
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
              }),
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '2.1.0',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.clickImageRedirectIcon(0);
      workspaces.assertRedirectPopoverExists();

      workspaces.assertRedirectPopoverBodyContains('jupyter-scipy:v1.8.0 → jupyter-scipy:v1.9.0');
      workspaces.assertRedirectPopoverBodyContains('jupyter-scipy:v1.9.0 → jupyter-scipy:v2.0.0');
      workspaces.assertRedirectPopoverBodyContains('jupyter-scipy:v2.0.0 → jupyter-scipy:v2.1.0');

      workspaces.assertRedirectPopoverHasDividers(2);
    });

    it('should display severity labels with correct colors', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Severity Labels Workspace',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: {
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
              }),
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '2.1.0',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.clickImageRedirectIcon(0);
      workspaces.assertRedirectPopoverExists();

      workspaces.assertRedirectPopoverHasLabel('Danger');
      workspaces.assertRedirectPopoverLabelColor('Danger', 'red');

      workspaces.assertRedirectPopoverHasLabel('Warning');
      workspaces.assertRedirectPopoverLabelColor('Warning', 'orange');

      workspaces.assertRedirectPopoverHasLabel('Info');
      workspaces.assertRedirectPopoverLabelColor('Info', 'blue');
    });

    it('should display redirect messages for each step', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Messages Workspace',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            imageConfig: {
              current: buildMockOptionInfo({
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
              }),
              redirectChain: buildImageRedirectChain({
                startVersion: '1.8.0',
                endVersion: '2.1.0',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.clickImageRedirectIcon(0);
      workspaces.assertRedirectPopoverExists();

      workspaces.assertRedirectPopoverBodyContains(
        'Your admin has upgraded the image from jupyter-scipy:v1.8.0 to jupyter-scipy:v1.9.0',
      );
      workspaces.assertRedirectPopoverBodyContains(
        'Your admin has upgraded the image from jupyter-scipy:v1.9.0 to jupyter-scipy:v2.0.0',
      );
      workspaces.assertRedirectPopoverBodyContains(
        'Your admin has upgraded the image from jupyter-scipy:v2.0.0 to jupyter-scipy:v2.1.0',
      );
    });

    it('should display pod config redirect chain correctly', () => {
      const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
      const mockWorkspaceKind = buildMockWorkspaceKindInfo({ name: 'jupyterlab' });

      const mockWorkspace = buildMockWorkspace({
        name: 'Pod Config Redirect Workspace',
        namespace: mockNamespace.name,
        workspaceKind: mockWorkspaceKind,
        state: V1Beta1WorkspaceState.WorkspaceStateRunning,
        podTemplate: buildMockPodTemplate({
          options: buildPodTemplateOptions({
            podConfig: {
              current: buildMockOptionInfo({
                id: 'small_cpu',
                displayName: 'Small CPU',
              }),
              redirectChain: buildPodRedirectChain({
                startConfig: 'smallCpu',
                endConfig: 'largeCpu',
              }),
            },
          }),
        }),
      });

      cy.interceptApi(
        'GET /api/:apiVersion/namespaces',
        { path: { apiVersion: NOTEBOOKS_API_VERSION } },
        mockModArchResponse([mockNamespace]),
      ).as('getNamespaces');

      cy.interceptApi(
        'GET /api/:apiVersion/workspaces/:namespace',
        { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
        mockModArchResponse([mockWorkspace]),
      ).as('getWorkspaces');

      workspaces.visit();
      cy.wait('@getNamespaces');
      navBar.selectNamespace(mockNamespace.name);
      cy.wait('@getWorkspaces');

      workspaces.clickPodConfigRedirectIcon(0);
      workspaces.assertRedirectPopoverExists();

      workspaces.assertRedirectPopoverBodyContains('Small CPU → Medium CPU');
      workspaces.assertRedirectPopoverBodyContains('Medium CPU → Large CPU');
      workspaces.assertRedirectPopoverBodyContains(
        'Your admin has upgraded the pod configuration from Small CPU to Medium CPU',
      );
      workspaces.assertRedirectPopoverBodyContains(
        'Your admin has upgraded the pod configuration from Medium CPU to Large CPU',
      );

      workspaces.assertRedirectPopoverHasDividers(1);
    });
  });
});
