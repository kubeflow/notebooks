import { workspace, WorkspaceState } from '../../../models/workspace';
import { pvc } from '../../../models/pvc';
import { workspaceFormPage } from '../../../pages/workspaceForm';
import { workspacesPage } from '../../../pages/workspaces';
import { environment } from '../../../support/browser/environment';
import { uniqueName } from '../../../support/browser/uniqueName';

describe('Workspace: user creates a Workspace', () => {
  it('creates a Workspace through the wizard', () => {
    const { baseline } = environment;
    const home = pvc.create();
    const name = uniqueName('ws');
    // The UI creates it, so register it for cleanup ourselves (before the UI step).
    workspace.track(name);

    workspacesPage.visit();
    workspacesPage.clickCreate();

    workspaceFormPage.selectKind(baseline.workspaceKind);
    workspaceFormPage.clickNext();
    workspaceFormPage.selectImage(baseline.imageConfig);
    workspaceFormPage.clickNext();
    workspaceFormPage.selectPodConfig(baseline.podConfig);
    workspaceFormPage.clickNext();
    workspaceFormPage.typeDisplayName(name);
    workspaceFormPage.setResourceName(name);
    workspaceFormPage.attachHomeVolume(home.name);
    workspaceFormPage.clickNext();
    workspaceFormPage.clickCreate();

    workspacesPage.findRow(name).should('exist');
    workspace.waitForState(name, WorkspaceState.Running).then((ws) => {
      expect(ws.spec.kind).to.equal(baseline.workspaceKind);
      expect(ws.spec.podTemplate.options).to.deep.equal({
        imageConfig: baseline.imageConfig,
        podConfig: baseline.podConfig,
      });
      expect(ws.spec.podTemplate.volumes.home).to.equal(home.name);
    });
  });
});
