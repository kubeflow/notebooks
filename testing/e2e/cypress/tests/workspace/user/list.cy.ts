import { workspace } from '../../../models/workspace';
import { workspacesPage } from '../../../pages/workspaces';

describe('Workspace: user lists Workspaces', () => {
  it('shows an existing Workspace in the list', () => {
    const ws = workspace.create();

    workspacesPage.visit();

    workspacesPage.findRow(ws.name).should('be.visible');
  });
});
