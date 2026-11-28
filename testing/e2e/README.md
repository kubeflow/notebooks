# Kubeflow Notebooks E2E Tests

Cypress end-to-end tests for the Workspaces UI, running against a real cluster. Test
data is created and cleaned up through the Kubernetes API, so each test sets up exactly
what it needs and leaves nothing behind.

For where these tests fit among the repo's other tests, and the principles behind
the framework, see [`testing/README.md`](../README.md).

- [Quick start](#quick-start)
- [Your first test](#your-first-test)
- [The tiers: from easy to anything](#the-tiers-from-easy-to-anything)
- [Recipes](#recipes)
- [Conventions](#conventions)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)

## Quick start

Run from `testing/`:

| I want to…                          | Command                                                       |
| ----------------------------------- | ------------------------------------------------------------- |
| Create a kind cluster, deploy, test | `make e2e`                                                    |
| Run every spec (already deployed)   | `make local-e2e`                                              |
| Run one spec                        | `make local-e2e SPEC=cypress/tests/workspace/user/list.cy.ts` |
| Open the interactive runner         | `make e2e-open`                                               |
| Run static checks (no cluster)      | `cd e2e && npm ci && npm run test:static`                     |

Against **Tilt** instead of kind (start Tilt with `ENABLE_DASHBOARD=false`; see
[Troubleshooting](#the-ui-looks-different-or-the-namespace-selector-is-missing)):

```sh
CYPRESS_BASE_URL=https://localhost:8443/workspaces E2E_ALLOWED_CONTEXTS=kind-tilt \
  bash testing/scripts/run-e2e.sh            # or: ... run-e2e.sh open
```

Requires Node 24 (npm 11.10+). Tests run in the Electron browser bundled with Cypress, so no
local Chrome is needed and the browser version is pinned by `package-lock.json`.
`run-e2e.sh [run|open] [cypress args…]` installs
dependencies and, unless `CYPRESS_BASE_URL` is set, port-forwards the kind ingress
gateway to `localhost:8443` (`GATEWAY_PORT` to change it).

## Your first test

Say you're testing that a user sees their Workspace in the list. Put it in
`cypress/tests/workspace/user/list.cy.ts`. The folder names matter: `user` is who
the test logs in as.

```ts
import { workspace } from '../../../models/workspace';
import { workspacesPage } from '../../../pages/workspaces';

describe('Workspace: user lists Workspaces', () => {
  it('shows an existing Workspace in the list', () => {
    const ws = workspace.create(); // a valid Workspace with a unique name

    workspacesPage.visit(); // opens the list in the test namespace

    workspacesPage.findRow(ws.name).should('be.visible');
  });
});
```

That's the whole test: no login, no namespace, no cleanup code. Before each test the
suite has already:

- applied the **baseline**: test namespace, RBAC for each actor, and a WorkspaceKind
  (`environment.baseline`) that `workspace.create()` uses by default;
- **logged in** as the actor in the spec's path.

After each test, everything `create()` made is **deleted**, even if the test failed.

Two rules carry most of the weight:

1. **The UI drives the behavior under test; models drive everything else.** If you're
   testing "create a Workspace through the wizard", use the wizard. If a Workspace is
   just a precondition, use `workspace.create()`. That keeps tests fast and focused.
2. **Create things in `it()` or a hook, never directly in the `describe` body.** The
   `describe` body runs only once, while Cypress collects the tests and before any
   of them start, so anything created there would be shared by every test and
   retry. Hooks are fine: they run when the tests run. Which one you use decides
   when cleanup happens ([Cleanup](#cleanup)). Lint catches the `describe` body case.

   ```ts
   describe('…', () => {
     const bad = workspace.create(); // ✗ describe body: runs once, at collection time
     let shared: Handle;
     let perTest: Handle;

     before(() => {
       shared = workspace.create(); // ✓ once per spec file; cleaned up after the file
     });
     beforeEach(() => {
       perTest = workspace.create(); // ✓ fresh for each test; cleaned up after the test
     });
     it('…', () => {
       const own = workspace.create(); // ✓ fresh for each test; cleaned up after the test
     });
   });
   ```

The four committed specs are the canonical examples to copy from:

| Spec                                     | Shows                                                         |
| ---------------------------------------- | ------------------------------------------------------------- |
| `tests/workspace/user/list.cy.ts`        | Precondition via `create()`, assert in the UI                 |
| `tests/workspace/user/create.cy.ts`      | The UI creates the object; `track()` it for cleanup           |
| `tests/workspaceKind/admin/create.cy.ts` | Upload a controller sample under a unique name                |
| `tests/workspaceKind/admin/delete.cy.ts` | `createFromSample()`, delete through the UI, verify it's gone |

## The tiers: from easy to anything

Each tier is built on the one below, and all are supported. Start at Tier 1 and drop
down **only for the part of the test that needs it**.

| Tier                 | API                                                                                                                             | Use when                                                | Cleanup                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------- |
| **1 – Defaults**     | `workspace.create()`, `pvc.create()`                                                                                            | You need "a valid X" and don't care about details       | automatic                             |
| **2 – Overrides**    | `workspace.create({ spec: … })`, `create(fn)`, `create(obj, { defaults: false })`                                               | You care about specific fields, or have a full manifest | automatic                             |
| **3 – Generic k8s**  | `cy.k8sApply(obj)`, `cy.k8sGet(ref)`, `cy.k8sList(q)`, `cy.k8sWaitFor(ref, cond)`, `cy.k8sDelete(ref)`, `cleanup.register(ref)` | Kinds without a model, one-off operations               | `k8sApply` registers it automatically |
| **4 – Custom tasks** | A task in `support/plugin/` wrapped in a command                                                                                | Anything Node-side: pod exec, logs, custom polling      | your task decides                     |

If you write the same Tier 3/4 code in a second spec, promote it into a model method
or command.

### Models (Tiers 1–2)

`cypress/models/` has one model per kind (`workspace`, `workspaceKind`, `pvc`,
`secret`). Every model, built with `defineModel()`, has:

| Method                                          | Does                                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `create(overrides?, options?)`                  | Applies defaults + overrides; returns a `Handle` **immediately**; cleans up after |
| `track(name)`                                   | Registers something the UI will create, so it's cleaned up too                    |
| `get(name)`                                     | Yields the object; fails if missing                                               |
| `waitFor(name, condition?)`                     | Polls until it exists (and matches `condition`); yields it                        |
| `waitForDeletion(name)` / `deleteAndWait(name)` | Waits until gone / deletes then waits                                             |
| `ref(name)`                                     | The `K8sRef` for Tier 3 commands                                                  |

Plus kind-specific helpers, e.g. `workspace.waitForState(name, WorkspaceState.Running)` and
`workspaceKind.createFromSample('jupyterlab')`.

A `Handle` is plain data, `{ name, namespace?, ref }`, known before the apply even
runs. You can pass `a.name` straight into the next `create()` without any `.then()`.

**Overrides** come in two forms:

- **Object**: deep-merged into the defaults. Nested objects merge key by key; **arrays
  and scalars replace**. Example: `workspace.create({ spec: { paused: true } })`.
- **Function**: `(defaults) => object`, for full control: delete keys, replace a nested
  object wholesale, or edit an array.

The name, namespace (`environment.namespace`) and managed label are filled in for you;
set `metadata.name`/`metadata.namespace` in an override to choose your own.

`create()` options: `{ defaults: false }` uses your object as the whole manifest;
`{ cleanup: false }` keeps it after the test (the next run's sweep still removes it);
`{ expectFailure: true }` yields the API error instead of a handle (see
[recipe](#webhook-rejects-an-invalid-spec)).

### Cleanup

Everything registered (by `create()`, `track()`, `cy.k8sApply` or
`cleanup.register()`) is deleted:

- **after each test**, if registered in the test or a `beforeEach`;
- **after the spec file**, if registered in a `before` hook, for expensive setup
  shared by several tests. (A `before` hook is not the "`describe` body" that rule 2
  forbids: it runs when the tests run.)

Deletion runs in **reverse registration order**, waiting for each step to finish, so
create dependencies first (which you do anyway): a Workspace is gone before its PVC or
WorkspaceKind is deleted. The WorkspaceKind webhook rejects deleting a kind that is
still in use, so this ordering matters. Objects already deleted by the test are fine.

Cleanup errors fail a passing test (it leaked something) but are only logged on a
failing one, so they never hide the real failure. On startup, the suite also sweeps
leftovers labelled `e2e.kubeflow.org/managed=true` from interrupted runs. That
assumes **one e2e run per cluster at a time**.

### Pages

`cypress/pages/` has one page object per frontend page, exported as a singleton:

- `visit()` navigates. Namespaced pages select `environment.namespace` unless you pass
  `{ namespace }`.
- `find<Thing>()` returns a Chainable. Finders are public, so tests can do unusual
  interactions without a new action.
- Actions are verbs: `click*`, `select*`, `type*`, `set*`, or a whole flow like
  `deleteWorkspaceKind(name)`.

Select by `data-testid`. If the element doesn't have one, add it in
`workspaces/frontend`. Role and label queries (`cy.findByRole`) are fine too.

## Recipes

> Recipes marked _(not CI-exercised)_ show the intended pattern but have no committed
> spec yet. If you add one, drop the marker.

### A precondition object (Tier 1)

See `tests/workspace/user/list.cy.ts` above.

### The UI creates the object (`track`)

From `tests/workspace/user/create.cy.ts`:

```ts
it('creates a Workspace through the wizard', () => {
  const home = pvc.create(); // the wizard requires a home volume
  const name = uniqueName('ws');
  workspace.track(name); // cleaned up even if the test fails midway

  workspacesPage.visit();
  workspacesPage.clickCreate();
  workspaceFormPage.selectKind(environment.baseline.workspaceKind);
  // …image, pod config, properties: setResourceName(name), attachHomeVolume(home.name)…
  workspaceFormPage.clickCreate();

  workspace.waitForState(name, WorkspaceState.Running);
});
```

### Delete through the UI

From `tests/workspaceKind/admin/delete.cy.ts`. Cleanup is then a no-op:

```ts
const kind = workspaceKind.createFromSample('jupyterlab');
workspaceKindsPage.visit();
workspaceKindsPage.deleteWorkspaceKind(kind.name);
workspaceKind.waitForDeletion(kind.name);
```

### Several objects that reference each other _(not CI-exercised)_

```ts
it('two workspaces share a read-only data volume', () => {
  const data = pvc.create();
  const mountData = {
    podTemplate: {
      volumes: { data: [{ pvcName: data.name, mountPath: '/data', readOnly: true }] },
    },
  };
  const a = workspace.create({ spec: mountData });
  const b = workspace.create({ spec: mountData });

  workspace.waitForState(a.name, WorkspaceState.Running);
  workspace.waitForState(b.name, WorkspaceState.Running);
  // …
}); // cleanup: b and a together, then data
```

### A Workspace on a test-owned WorkspaceKind _(not CI-exercised)_

```ts
const kind = workspaceKind.createFromSample('jupyterlab');
const ws = workspace.create({ spec: { kind: kind.name } });
workspace.waitForState(ws.name, WorkspaceState.Running);
// cleanup: ws (waits until gone), then kind
```

### Expensive setup shared by several tests _(not CI-exercised)_

```ts
describe('Workspace list filtering (user)', () => {
  let running: Handle;
  let paused: Handle;

  before(() => {
    running = workspace.create();
    paused = workspace.create({ spec: { paused: true } });
    workspace.waitForState(running.name, WorkspaceState.Running);
    workspace.waitForState(paused.name, WorkspaceState.Paused);
  });

  it('filters by Running', () => {
    /* … */
  });
  it('filters by Paused', () => {
    /* … */
  });
}); // cleaned up once, after the spec file
```

Note that `create()` is called inside `before()`, not directly in the `describe` body.

### Webhook rejects an invalid spec _(not CI-exercised)_

```ts
it('rejects a Workspace referencing a missing kind', () => {
  workspace
    .create({ spec: { kind: 'does-not-exist' } }, { expectFailure: true })
    .its('message')
    .should('contain', 'does-not-exist');
});
```

`expectFailure` yields `{ code, reason, message }` and **fails the test if the apply
succeeds**, so a negative test can't pass by accident. `cy.k8sApply(obj, {
expectFailure: true })` does the same for any kind.

### Replace a nested object (function override) _(not CI-exercised)_

A deep-merge would keep the sample's `icon.url` next to the new `configMap`, which the
schema rejects, so replace `icon` wholesale:

```ts
const kind = workspaceKind.createFromSample('jupyterlab', (wk) => {
  wk.spec.spawner.icon = {
    configMap: {
      name: cm,
      namespace: environment.namespace,
      key: 'icon.svg',
      mediaType: 'image/svg+xml',
    },
  };
  return wk;
});
```

### A kind without a model (Tier 3) and multiple users _(not CI-exercised)_

```ts
it("user can't see another namespace's workspaces", () => {
  const ns = uniqueName('ns');
  cy.k8sApply({ ...KINDS.namespace, metadata: { name: ns } }); // auto-cleaned
  workspace.create({ metadata: { namespace: ns } });

  loginAs('user'); // or loginAs({ identity: 'someone@e2e.test' }); call before visit()
  workspacesPage.visit({ namespace: ns });
  // …assert access is denied…
}); // cleanup: workspace, then Namespace
```

`loginAs()` switches the simulated user for the rest of the test. An arbitrary
identity has no permissions until you bind some, e.g. `cy.k8sApply` a RoleBinding.

### Add a custom task (Tier 4)

1. Write the Node-side function in `cypress/support/plugin/` and register it with
   `on('task', { myTask })` (see `k8sClient.ts` for examples); wire it up in
   `plugin/index.ts`.
2. Put argument and result types in `support/shared/`, so browser code can use them.
3. Call it with `cy.task<Result>('myTask', args)`, or wrap it in a model method or
   command once a second spec needs it.

### Add a page object

Copy the shape of `pages/workspaceKinds.ts`: a class named after the frontend page
folder, `visit()`, public `find*()` methods, verb actions, and a singleton export
(`export const fooPage = new FooPage()`).

### Add a model

```ts
import type { V1ConfigMap, V1ObjectMeta } from '@kubernetes/client-node';
import type { K8sObject } from '../support/shared/k8s';
import { KINDS } from '../support/shared/kinds';

// Core kinds reuse client-node's type; narrow `metadata` to what the model guarantees.
export type ConfigMap = K8sObject &
  V1ConfigMap & {
    metadata: V1ObjectMeta & { name: string; namespace: string };
  };

export const configMap = defineModel<ConfigMap>({
  ...KINDS.configMap, // add an entry to KINDS for a new type
  namespaced: true,
  namePrefix: 'cm',
  defaults: ({ name, namespace }) => ({
    metadata: { name, namespace: namespace as string },
    data: {},
  }),
});
```

For a custom resource, write an `interface Foo extends K8sObject` with only the fields
tests use (see `models/workspace.ts`). Keep defaults minimal and valid. To add helpers, spread the model:
`export const configMap = { ...base, myHelper() { … } }` (see `models/workspace.ts`).
If the kind can be leaked by interrupted runs, add it to `SWEEP_KINDS` in
`support/plugin/baseline.ts`.

### Add an actor

1. Add it to `ACTORS` in `support/shared/actors.ts`.
2. Give it an identity in `support/shared/environment.ts` (and an `E2E_*` variable).
3. Give it RBAC in `support/plugin/baseline.ts`.
4. Create `cypress/tests/<area>/<newActor>/`.

## Conventions

Each one is enforced by `npm run lint` (CI's `e2e-static` job) or at startup, because
breaking it causes a real bug. When you genuinely need an exception, disable the rule
for that line **with a reason**:
`// eslint-disable-next-line no-restricted-syntax -- <why>`.

| Convention                                                                                                                | Why                                                               | Enforced by                            |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| Specs live at `cypress/tests/<area>/<actor>/<name>.cy.ts`, `actor` ∈ `ACTORS`, camelCase or kebab-case names              | The actor folder decides who the spec logs in as                  | `scripts/check-spec-paths.ts`, startup |
| No `uniqueName()`, `create()`, `createFromSample()`, `track()` directly in a `describe` body                              | Runs once per file: tests and retries would share names           | ESLint `no-restricted-syntax`          |
| No PatternFly class (`pf-v6-…`) or `#id` selectors                                                                        | Break on PatternFly upgrades or generated ids                     | ESLint `no-restricted-syntax`          |
| Browser code never imports `support/plugin/`, `fs`, `path`, `@kubernetes/client-node` (types are fine), or uses `process` | Node-only code silently breaks (or ignores config) in the browser | ESLint `no-restricted-imports/globals` |
| Kube context must match `E2E_ALLOWED_CONTEXTS`                                                                            | Never run setup/cleanup against the wrong cluster                 | startup                                |

Not enforced, but expected:

- `area` is the product area (`workspace`, `workspaceKind`, …); `name` is the page or
  flow (`list`, `create`, `details`). Add an `it()` to an existing file when area,
  actor and page match; otherwise start a new file.
- Read the namespace, identities and baseline from `environment`; never hardcode them.
- Use `uniqueName(prefix)` for any name you choose.

## Configuration

Every value is a variable, read in Node and published to the browser as `environment`
(`cypress/support/shared/environment.ts`):

| Variable                      | Default                             | Meaning                                                                                          |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `CYPRESS_BASE_URL`            | `https://localhost:8443/workspaces` | Frontend URL                                                                                     |
| `E2E_NAMESPACE`               | `e2e-test`                          | Namespace for namespaced test objects                                                            |
| `E2E_ADMIN_USER`              | `admin@e2e.test`                    | Identity of the `admin` actor                                                                    |
| `E2E_USER`                    | `user@e2e.test`                     | Identity of the `user` actor                                                                     |
| `E2E_ALLOWED_CONTEXTS`        | `kind-local-e2e`                    | Comma-separated kube contexts allowed (`*` wildcard). `make` derives it from `KIND_CLUSTER_NAME` |
| `E2E_TEARDOWN`                | `false`                             | `true`: delete the baseline after the run                                                        |
| `E2E_BASELINE_WORKSPACE_KIND` | `jupyterlab`                        | Baseline WorkspaceKind (and its controller sample)                                               |
| `E2E_BASELINE_IMAGE_CONFIG`   | `jupyter-scipy:v1.11.1`             | Default `imageConfig` (validated against the baseline)                                           |
| `E2E_BASELINE_POD_CONFIG`     | `tiny_cpu`                          | Default `podConfig` (validated against the baseline)                                             |

The baseline is applied with server-side apply once per Cypress process, so editing
`support/plugin/baseline.ts` takes effect on an existing cluster. It's left in place
between runs for speed.

## Architecture

```
testing/e2e/
  cypress.config.ts         # Cypress settings; delegates to support/plugin/index.ts
  eslint.config.mjs         # recommended rules + the conventions above
  scripts/check-spec-paths.ts
  cypress/
    tests/<area>/<actor>/<name>.cy.ts
    pages/                  # page objects
    models/                 # defineModel() per kind
    support/
      e2e.ts                # global hooks: baseline, login, cleanup
      shared/               # context-agnostic: types, kinds, labels, environment resolution, actors, overrides
      browser/              # runs in the browser: environment, auth, cleanup, defineModel, cy.k8s*
      plugin/               # runs in Node: k8s client and tasks, baseline, samples
```

Cypress runs code in two places: specs, pages, models and `support/browser/` are
bundled into the **browser**; `support/plugin/` runs in **Node** and is reached only
through `cy.task()`. `support/shared/` is pure code both sides import. Mixing them up
compiles but fails at runtime (e.g. `process.env` is `{}` in the browser), hence the
import rule.

The support file and each spec are bundled **separately**, so a module imported by
both runs twice with separate variables. Mutable browser-side state (cleanup
registry, current identity) therefore lives in `sharedState()` on the window; use it
for any new framework state, never a module-level `let`.

This suite targets the **standalone** frontend (`DEPLOYMENT_MODE=standalone`, set by
`make deploy-frontend`), whose page chrome differs from the Central Dashboard build.
It shares no code with `workspaces/frontend`, only naming conventions for page
objects.

Future work: Node unit tests (`node --test`) for the pure modules in
`support/shared/` (override merging, cleanup ordering, environment, spec paths) as
the framework grows.

## Troubleshooting

#### `Refusing to run e2e setup against kube context "…"`

The current context isn't in `E2E_ALLOWED_CONTEXTS`. Switch context, or allow it,
e.g. `E2E_ALLOWED_CONTEXTS=kind-tilt` for Tilt.

#### `localhost:8443 is already in use`

Something (often Tilt) is already serving there. Set `CYPRESS_BASE_URL` to use it, or
`GATEWAY_PORT` to port-forward elsewhere.

#### `Baseline WorkspaceKind "…" has no imageConfig "…"` (or podConfig)

`E2E_BASELINE_IMAGE_CONFIG`/`E2E_BASELINE_POD_CONFIG` don't exist in the baseline
sample (maybe the sample changed). Update the defaults in
`support/shared/environment.ts`.

#### A test timed out waiting for a Workspace

The error shows the last observed value (e.g. `status.state` was `Pending`). Check
the pod: `kubectl -n e2e-test get pods,events`. A passing test after a retry is
reported as `⚠ Passed on retry` in the run log; treat it as flaky.

#### The UI looks different, or the namespace selector is missing

You're probably running against the Central Dashboard build. Start Tilt with
`ENABLE_DASHBOARD=false`.

#### Leftover objects after an interrupted run

They're swept on the next run. To remove them now:
`kubectl delete workspaces,pvc,secrets -A -l e2e.kubeflow.org/managed=true` (and
`workspacekinds` likewise).
