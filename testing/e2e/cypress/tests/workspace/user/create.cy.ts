import { uniqueName } from '../../../support/browser/uniqueName';
import { environment } from '../../../support/environment';
import { workspacesPage } from '../../../pages/workspaces';
import { createWorkspacePage } from '../../../pages/createWorkspace';
import { workspace } from '../../../models/workspace';

describe('Workspace: user creates a Workspace', () => {
  const workspaceName = uniqueName('test-workspace');

  afterEach(() => {
    workspace.delete(workspaceName);
  });

  it('creates a Workspace through the wizard', () => {
    // Navigate to workspaces and select the test namespace
    workspacesPage.visit();
    workspacesPage.selectNamespace(environment.namespace);

    // Click create workspace
    workspacesPage.clickCreate();

    // Step 1: Select workspace kind
    createWorkspacePage.selectKind(environment.baselineWorkspaceKind);
    createWorkspacePage.clickNext();

    // Step 2: Select image (first available)
    createWorkspacePage.selectFirstImage();
    createWorkspacePage.clickNext();

    // Step 3: Select pod config (first available)
    createWorkspacePage.selectFirstPodConfig();
    createWorkspacePage.clickNext();

    // Step 4: Fill properties
    createWorkspacePage.typeName(workspaceName);
    createWorkspacePage.setResourceName(workspaceName);
    createWorkspacePage.attachHomeVolume(environment.baselinePvc);
    createWorkspacePage.clickNext();

    // Step 5: Review and create
    createWorkspacePage.clickCreate();

    // Assert: redirected to workspaces list, new workspace is visible
    cy.url().should('not.include', '/create');
    workspacesPage.assertWorkspaceExists(workspaceName);

    // Assert: Workspace CR exists in the cluster (waiting avoids a race with API propagation)
    workspace.waitForReady(workspaceName).then((ws) => {
      expect(ws.metadata.name).to.equal(workspaceName);
      expect(ws.metadata.namespace).to.equal(environment.namespace);
      expect(ws.spec.kind).to.equal(environment.baselineWorkspaceKind);
    });
  });
});
