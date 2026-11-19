# Kubeflow Notebooks E2E Tests

Self-contained Cypress end-to-end test suite for the Workspaces UI, backed by direct
Kubernetes API calls for fixtures, assertions, and cleanup.

## Architecture

The suite is organized into four layers, each with a single responsibility:

| Layer | Path | Responsibility |
| --- | --- | --- |
| **Tests** | `cypress/tests/` | Specs: arrange, act, assert. No direct k8s/HTTP calls — only page objects and models. |
| **Pages** | `cypress/pages/` | UI locators and actions for one screen/page (e.g. the create-workspace wizard). No assertions beyond trivial element presence. |
| **Models** | `cypress/models/` | One file per CRD (`workspace.ts`, `workspaceKind.ts`). Encapsulates the CRD's group/version/plural and exposes typed, product-level operations (`get`, `delete`, `waitForReady`, `waitForDeleted`). Specs never reference `group`/`version`/`plural` directly. |
| **Support** | `cypress/support/` | Low-level plumbing, split by *where it runs*: `support/browser/` (login simulation, custom Cypress commands, test-data helpers — imported by specs/pages, runs in-browser) vs. `support/plugin/` (the Kubernetes client, task registration, filesystem/path helpers — runs only in Cypress's Node.js process via `setupNodeEvents`). `environment.ts` and `e2e.ts` stay at the top level since both the browser and the Node process need them. |

### Core convention: UI drives the behavior under test, models drive everything else

If a spec is verifying a UI workflow (e.g. "a user creates a Workspace through the
wizard"), that workflow **must** go through the UI. For anything that is just a
*precondition* or *cleanup* for a test — not the behavior being verified — use the
model layer's direct Kubernetes calls instead of re-driving the UI. This keeps specs
fast, isolated from unrelated UI flows, and focused on the one behavior they name.

### Environment profile

`cypress/support/environment.ts` is the single source of truth for the test
namespace, simulated identities, and baseline fixtures (the WorkspaceKind and PVC
provisioned by `setupE2e()` before any spec runs). Every value is overridable via
environment variable. Don't hardcode a namespace, identity, or fixture name anywhere
else — read it from `environment`.

### Environment assumption: standalone frontend

This suite's page objects (e.g. `pages/workspaces.ts`) target the `standalone`
frontend build (`workspaces/frontend/src/app/standalone/`), not the Kubeflow Central
Dashboard-embedded build — the DOM structure differs between the two, and the
dashboard chrome lives in a separate, external repository. CI enforces this via
`DEPLOYMENT_MODE=standalone` (set by `make deploy-frontend`). If you run this suite
against a Tilt-managed environment instead, start Tilt with `ENABLE_DASHBOARD=false`
so the deployed frontend matches what these tests assume.

### Login

`support/browser/auth.ts` exports `loginAsAdmin()`/`loginAsUser()`, which intercept outgoing
API calls and inject the simulated `kubeflow-userid` header. A spec never calls these
itself: `support/e2e.ts` registers a global `beforeEach` that derives the actor from
the spec's own file path (the `actor` segment of the `(CRD, actor, page-area)`
convention below) and logs in as that actor automatically. This is only possible
*because* the folder convention is enforced — don't bypass it, or login stops working
for that spec.

## Adding a new test

**Step 1: Decide where the spec file goes.** Specs are organized by
`tests/<crd>/<actor>/<page-area>.cy.ts`, where `page-area` mirrors the corresponding
frontend page folder (e.g. `workspaces/frontend/src/app/pages/Workspaces/Details/`
maps to `tests/workspace/user/details.cy.ts`). Concretely:

- **Only start a new file** when the actor changes (user vs. admin) for the same
  CRD, or it's a different CRD/page-area entirely.
- **Otherwise, add a new `it()`** to the existing file for that `(CRD, actor,
  page-area)` — it automatically gets the same implicit login (see "Login" above).

**Step 2: Check whether you need new page objects or model methods.** If you're
exercising a page that doesn't have a page object yet, add one under `cypress/pages/`.
If your flow needs a CRD operation the model doesn't expose yet (e.g. a direct
`create()` to set up a precondition), add it to the relevant `cypress/models/*.ts`
file rather than reaching for `cy.k8sGet`/`cy.k8sDelete` directly in the spec.

**Step 3: Use `uniqueName()` for any resource name your test picks.** Import from
`cypress/support/browser/uniqueName.ts` for any resource name typed into the UI (e.g. a
Workspace name), so parallel or retried runs can't collide. This doesn't apply to
resources whose name comes from an uploaded fixture file.

### Template

```ts
import { uniqueName } from '../../../support/browser/uniqueName';
import { environment } from '../../../support/environment';
import { somePage } from '../../../pages/somePage';
import { workspace } from '../../../models/workspace';

describe('Workspace: user <does something>', () => {
  const workspaceName = uniqueName('test-workspace');

  afterEach(() => {
    workspace.delete(workspaceName);
  });

  it('<does the thing>', () => {
    // Arrange any preconditions via the model layer (not the UI).

    // Act: drive the UI for the behavior under test.
    somePage.visit();
    // ...

    // Assert: UI state, then confirm via the model layer.
    workspace.waitForReady(workspaceName).then((ws) => {
      expect(ws.status?.state).to.equal('Running');
    });
  });
});
```

## Running locally

See `testing/Makefile` (`make e2e` for the full pipeline, or `make local-e2e` to run
against an already-deployed kind cluster) — both resolve to a single call to
`scripts/run-e2e.sh`. If `CYPRESS_BASE_URL` isn't already set, `run-e2e.sh`
port-forwards the kind/Istio ingress gateway to produce one. To run against a
different environment (e.g. Tilt), set `CYPRESS_BASE_URL` yourself before calling
`run-e2e.sh` — the kind-specific port-forward is skipped entirely.
