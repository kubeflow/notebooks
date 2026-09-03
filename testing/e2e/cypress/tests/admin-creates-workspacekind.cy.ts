import { loginAsAdmin } from '../support/auth';
import { workspaceKindsPage } from '../pages/workspaceKinds';
import { createWorkspaceKindPage } from '../pages/createWorkspaceKind';

const CONTROLLER_SAMPLES =
  '../../workspaces/controller/manifests/kustomize/samples';
const WORKSPACEKIND_NAME = 'rstudio';
const K8S_PARAMS = {
  group: 'kubeflow.org',
  version: 'v1beta1',
  plural: 'workspacekinds',
  name: WORKSPACEKIND_NAME,
};

describe('Admin creates a WorkspaceKind', () => {
  beforeEach(() => {
    loginAsAdmin();
  });

  afterEach(() => {
    cy.k8sDelete(K8S_PARAMS);
  });

  it('creates a WorkspaceKind via YAML upload', () => {
    // Navigate to workspace kinds list
    workspaceKindsPage.visit();
    workspaceKindsPage.findTable().should('exist');

    // Click create and upload the YAML fixture
    workspaceKindsPage.clickCreate();
    createWorkspaceKindPage.uploadYamlFile(
      `${CONTROLLER_SAMPLES}/rstudio_v1beta1_workspacekind.yaml`,
    );
    createWorkspaceKindPage.clickSubmit();

    // Assert: redirected to list, new kind is visible
    cy.url().should('include', '/workspacekinds');
    workspaceKindsPage.assertKindExists('RStudio');

    // Assert: WorkspaceKind CR exists in the cluster
    cy.k8sGet(K8S_PARAMS).then((wk) => {
      expect(wk.metadata.name).to.equal(WORKSPACEKIND_NAME);
      const spawner = wk.spec.spawner as Record<string, unknown>;
      expect(spawner.displayName).to.equal('RStudio');
      expect(spawner.description).to.equal(
        'A Workspace which runs RStudio in a Pod',
      );
    });
  });
});
