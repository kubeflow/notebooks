import { workspaceKind } from '../../../models/workspaceKind';
import { workspaceKindsPage } from '../../../pages/workspaceKinds';

describe('WorkspaceKind: admin deletes a WorkspaceKind', () => {
  it('deletes an unused WorkspaceKind from the list', () => {
    const kind = workspaceKind.createFromSample('jupyterlab');

    workspaceKindsPage.visit();
    workspaceKindsPage.deleteWorkspaceKind(kind.name);

    workspaceKindsPage.findRow(kind.name).should('not.exist');
    workspaceKind.waitForDeletion(kind.name);
  });
});
