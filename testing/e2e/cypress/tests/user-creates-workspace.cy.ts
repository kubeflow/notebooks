import { loginAsUser } from '../support/auth';
import { workspacesPage } from '../pages/workspaces';
import { createWorkspacePage } from '../pages/createWorkspace';

const NAMESPACE = 'e2e-test';
const WORKSPACE_NAME = 'test-workspace';
const K8S_PARAMS = {
  group: 'kubeflow.org',
  version: 'v1beta1',
  plural: 'workspaces',
  namespace: NAMESPACE,
  name: WORKSPACE_NAME,
};

describe('User creates a Workspace', () => {
  beforeEach(() => {
    loginAsUser();
  });

  afterEach(() => {
    cy.k8sDelete(K8S_PARAMS);
  });

  it('creates a Workspace through the wizard', () => {
    // Navigate to workspaces and select the test namespace
    workspacesPage.visit();
    workspacesPage.selectNamespace(NAMESPACE);

    // Click create workspace
    workspacesPage.clickCreate();

    // Step 1: Select workspace kind
    createWorkspacePage.selectKind('jupyterlab');
    createWorkspacePage.clickNext();

    // Step 2: Select image (first available)
    createWorkspacePage.selectFirstImage();
    createWorkspacePage.clickNext();

    // Step 3: Select pod config (first available)
    createWorkspacePage.selectFirstPodConfig();
    createWorkspacePage.clickNext();

    // Step 4: Fill properties
    createWorkspacePage.typeName(WORKSPACE_NAME);
    createWorkspacePage.attachHomeVolume('home-volume');
    createWorkspacePage.clickNext();

    // Step 5: Review and create
    createWorkspacePage.clickCreate();

    // Assert: redirected to workspaces list, new workspace is visible
    cy.url().should('not.include', '/create');
    workspacesPage.assertWorkspaceExists(WORKSPACE_NAME);

    // Assert: Workspace CR exists in the cluster
    cy.k8sGet(K8S_PARAMS).then((ws) => {
      expect(ws.metadata.name).to.equal(WORKSPACE_NAME);
      expect(ws.metadata.namespace).to.equal(NAMESPACE);
      expect(ws.spec.kind).to.equal('jupyterlab');
    });
  });
});
