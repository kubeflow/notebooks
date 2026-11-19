import { workspaceKindsPage } from '../../../pages/workspaceKinds';
import { createWorkspaceKindPage } from '../../../pages/createWorkspaceKind';
import { workspaceKind } from '../../../models/workspaceKind';

// The WorkspaceKind name below comes from the uploaded sample YAML's `metadata.name`,
// not from anything the test can parameterize, so it isn't run through uniqueName().
const WORKSPACEKIND_NAME = 'rstudio';

describe('WorkspaceKind: admin creates a WorkspaceKind', () => {
  afterEach(() => {
    workspaceKind.delete(WORKSPACEKIND_NAME);
  });

  it('creates a WorkspaceKind via YAML upload', () => {
    // Navigate to workspace kinds list
    workspaceKindsPage.visit();
    workspaceKindsPage.findTable().should('exist');

    // Click create and upload the YAML fixture
    workspaceKindsPage.clickCreate();
    cy.task<string>(
      'readControllerSampleYaml',
      `${WORKSPACEKIND_NAME}_v1beta1_workspacekind.yaml`,
    ).then((content) => {
      createWorkspaceKindPage.uploadYaml(content);
    });
    createWorkspaceKindPage.clickSubmit();

    // Assert: redirected to list, new kind is visible
    cy.url().should('include', '/workspacekinds');
    workspaceKindsPage.assertKindExists('RStudio');

    // Assert: WorkspaceKind CR exists in the cluster (waiting avoids a race with API propagation)
    workspaceKind.waitForExists(WORKSPACEKIND_NAME).then((wk) => {
      expect(wk.metadata.name).to.equal(WORKSPACEKIND_NAME);
      const spawner = wk.spec.spawner;
      expect(spawner.displayName).to.equal('RStudio');
      expect(spawner.description).to.equal('A Workspace which runs RStudio in a Pod');
    });
  });
});
