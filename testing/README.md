# Kubeflow Notebooks: Testing

This folder holds the **end-to-end (e2e) tests** for Kubeflow Workspaces. They check
the whole system (controller, backend and frontend) deployed together on a real
Kubernetes cluster, driven the way a user drives it: through the browser.

This page explains the ideas behind the suite. To run or write tests, go to
**[`e2e/README.md`](e2e/README.md)**.

- [Where e2e tests fit](#where-e2e-tests-fit)
- [Principles](#principles)
- [What's in this folder](#whats-in-this-folder)
- [How a run works](#how-a-run-works)
- [Changing the test environment](#changing-the-test-environment)

## Where e2e tests fit

Each layer of Workspaces has its own tests. **Test a behaviour at the lowest layer
that can catch the bug.** Lower layers are faster, more precise when they fail, and
cheaper to maintain.

| Layer                    | Location                            | Catches                                                         |
| ------------------------ | ----------------------------------- | --------------------------------------------------------------- |
| Controller unit/envtest  | `workspaces/controller/internal/**` | Reconcile logic, webhook validation                             |
| Controller e2e (Go)      | `workspaces/controller/test/e2e`    | Controller and CRDs on a real cluster, without UI or backend    |
| Backend (Go, envtest)    | `workspaces/backend/**`             | API handlers, request validation, mapping to Kubernetes objects |
| Frontend unit and mocked | `workspaces/frontend/src/__tests__` | Components and page flows against a **mocked** API              |
| **Full-stack e2e**       | **`testing/e2e`**                   | **User journeys across UI → backend → controller → cluster**    |

An e2e test is worth adding when the risk is in **how the pieces fit together**,
for example:

- The UI sends something the backend rejects.
- The backend's permissions don't match what the UI shows.
- A Workspace created in the UI never reaches `Running`.

Edge cases that one component can check on its own (every validation message,
every form permutation) belong in that component's tests. Here, prefer a few
journeys that matter over many that overlap.

## Principles

These are the decisions the framework is built on. If a change goes against one of
them, the change probably belongs somewhere else, or the principle should be
discussed openly.

1. **Real stack, no mocks.** The cluster, the API calls and the identity checks are
   all real. If a mock would make a test easier, the test probably belongs in a
   lower layer.

2. **Each test owns its data.** Tests create what they need through the Kubernetes
   API, with unique names, and the framework deletes it afterwards, even when the
   test fails. Only the truly global **baseline** is shared:
   - the test namespace,
   - RBAC for the test users,
   - one WorkspaceKind.

   Keep the baseline small. Shared state couples tests and makes failures
   order-dependent.

3. **Arrange via the API, act via the UI, assert on both.** Set up preconditions the
   fast, reliable way (API), and exercise the behaviour under test the way a user
   would (UI). Then confirm both what the user sees and what the cluster stores.

4. **Easy cases are easy; unusual cases are possible.** The common path, "give me a
   valid Workspace", is one obvious line. Unusual tests, like several resources,
   several users or expected failures, step down to lower-level APIs. Those APIs
   are just as supported and still clean up automatically. See
   [the tiers](e2e/README.md#the-tiers-from-easy-to-anything).

5. **Tests are written from a user's point of view.** Each spec runs as an **actor**
   (`user`, `admin`) that its folder determines. Specs find elements by role, label or
   `data-testid`, never by styling classes, so tests keep working when the UI is
   restyled.

6. **Fail fast and loud.** A wrong kube context, a misplaced spec or a broken
   baseline stops the run at startup with an error that says what to do. Misleading
   timeouts ten minutes into CI waste far more time.

7. **Enforce only what prevents real bugs.** Lint and path checks guard against
   mistakes that break things silently, such as running Node code in the browser,
   brittle selectors, or names shared across retries. They don't enforce style.
   Every rule has a documented escape for the rare case it gets in the way.

8. **Reproducible by default.** Every part of the toolchain is pinned:
   - the kind node image digest,
   - Istio, cert-manager,
   - Cypress and its bundled Electron browser (via `package-lock.json`).

   A failure should mean the code changed, not that the machine did. The suite
   doesn't depend on a locally installed browser.

9. **Same suite, any cluster.** The same tests run on kind (CI and local), Tilt or
   another dev cluster; only environment variables change. A guard refuses kube
   contexts that aren't explicitly allowed, so a test run can't touch a cluster it
   shouldn't.

10. **Independent of the code under test.** `testing/` shares no code with
    `workspaces/frontend`. Page objects describe the UI as a user sees it. They
    don't reuse the frontend's internals, so a frontend refactor can't accidentally
    make the e2e tests pass.

## What's in this folder

```
testing/
  Makefile                 # entry point: cluster setup, deploy, run (make help)
  kind-1-35.yaml           # kind cluster config (pinned node image)
  istio-cni.yaml           # Istio install profile (CNI mode)
  manifests/istio-gateway/ # ingress gateway + TLS cert that the UI is reached through
  scripts/
    setup-kind.sh          # create the kind cluster (no-op if it exists)
    setup-cert-manager.sh  # install cert-manager (webhook certificates)
    setup-istio.sh         # install Istio and the gateway
    cluster-readiness.sh   # verify every component is deployed and reachable
    run-e2e.sh             # port-forward the gateway and run Cypress
  e2e/                     # the Cypress suite: see e2e/README.md
```

`testing/` is self-contained. Anything the tests need from the rest of the repo
(images, manifests, WorkspaceKind samples) is built or read from its source
location, never copied in.

## How a run works

`make e2e` runs the whole pipeline in order. Each stage is also its own target, so
you can repeat just the step you need:

| Stage           | Target                      | What it does                                                                     |
| --------------- | --------------------------- | -------------------------------------------------------------------------------- |
| 1. Cluster      | `setup-kind`                | Creates the `local-e2e` kind cluster                                             |
| 2. Dependencies | `setup-deps`                | Installs cert-manager and Istio, including the ingress gateway                   |
| 3. Deploy       | `deploy-all`                | Builds the controller, backend and frontend images, loads them, deploys them     |
| 4. Readiness    | `cluster-readiness`         | Checks rollouts, the webhook TLS handshake, health endpoints and gateway routing |
| 5. Test         | `local-e2e` (or `e2e-open`) | Applies the test baseline, runs the specs, cleans up                             |

Once a cluster is deployed, the inner loop is just stage 5, e.g.
`make local-e2e SPEC=…`. After changing a component, redeploy only that one, e.g.
`make deploy-frontend`.

In CI (`.github/workflows/ws-e2e-test.yml`), a fast **static** job (typecheck,
lint, spec-path and formatting checks; no cluster) gates the **cluster** job,
which runs the same `make` stages and uploads videos and screenshots of failures.

## Changing the test environment

- **Version bumps** (kind node image, Istio, cert-manager): the same tools are also
  set up by `developing/` (Tilt) and the controller's Go e2e utilities, so check
  those too and keep the versions in sync (see the `NOTE:` in
  `scripts/setup-cert-manager.sh`).
- **Baseline changes** (namespace, RBAC, baseline WorkspaceKind) live in
  `e2e/cypress/support/plugin/baseline.ts`. Every object there has a comment saying
  why it is global. Add one only if _most_ specs need it. Otherwise, create it in
  the test.
- **New test infrastructure** (another dependency, another component to deploy)
  belongs in a `scripts/` step wired into the `Makefile`, so CI and local runs keep
  using the same path.
