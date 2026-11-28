import { workspaceKind } from '../../../models/workspaceKind';
import { workspaceKindFormPage } from '../../../pages/workspaceKindForm';
import { workspaceKindsPage } from '../../../pages/workspaceKinds';
import { uniqueName } from '../../../support/browser/uniqueName';

describe('WorkspaceKind: admin creates a WorkspaceKind', () => {
  it('creates a WorkspaceKind via YAML upload', () => {
    const sample = 'rstudio';
    const name = uniqueName(sample);
    // The UI creates it, so register it for cleanup ourselves (before the UI step).
    workspaceKind.track(name);

    workspaceKindsPage.visit();
    workspaceKindsPage.clickCreate();
    workspaceKind
      .loadSample(sample, { name })
      .then(({ yaml }) => workspaceKindFormPage.uploadYaml(yaml));
    workspaceKindFormPage.clickSubmit();

    workspaceKindsPage.findRow(name).should('be.visible');
    workspaceKind.waitForExists(name).then((wk) => {
      expect(wk.spec.spawner.displayName).to.equal('RStudio');
    });
  });
});
