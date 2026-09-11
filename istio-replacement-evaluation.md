# Replacing Istio in Kubeflow Notebooks: an evaluation

| Authors | [Antonio Ojea](mailto:aojea@google.com) |
| :---- | :---- |
| **Status** | Findings, 2026-09 |
| **Scope** | `notebooks-v2`, the `gateway_api` branch ([kubeflow/notebooks#1301](https://github.com/kubeflow/notebooks/pull/1301)) and a live GKE deployment |
| **Related** | [design-gateway-api.md](design-gateway-api.md), [user-guide-gke-envoy-gateway.md](user-guide-gke-envoy-gateway.md), [GEP-1494](https://gateway-api.sigs.k8s.io/geps/gep-1494/) |

## Summary

Kubeflow runs its web applications and its notebooks behind Istio, and it uses Istio for far more than routing: the mesh is where users are authenticated, where their identity is turned into a header every application trusts, and where the rule "only the owner of a namespace may reach its notebooks" is enforced. The [design document](design-gateway-api.md) proposes doing the same with Gateway API and plain Kubernetes primitives, and most of it was implemented and validated on a real cluster.

Doing it *completely* — a drop-in, portable replacement for everything Istio does for Kubeflow, built only on the Gateway API standard — is not achievable today. This document explains why in concrete terms, records what a live deployment on GKE taught us, and lays out every route we evaluated with its verdict, so that the decision can be revisited when the standard or the implementations move.

The short version:

- Istio's authentication story rests on four properties Gateway API does not have: a single data plane it fully controls, policy attached to the **proxy** rather than to routes, identity anchored in **mTLS** between gateway and workload, and enforcement **at the destination**. Every implementation's "custom policy" CRD exists to paper over one of those, which is exactly the lock-in a portable deployment tries to avoid.
- The standard `ExternalAuth` filter (GEP-1494, experimental) exists and one shipping implementation supports it, but the specification leaves unsaid the two things a login flow needs — what the client receives on denial, and how the original request path reaches the authorization server — and the implementations answer differently.
- Two real defects appeared the moment the implementation-specific safety net was removed: the API accepted a client-forged identity header, and nobody sent an anonymous browser to the login page. Both are consequences of moving identity out of the mesh without moving it *into* the application.
- The robust options all put identity verification where the code can see it: the backend validating the token the proxy already forwards, a per-pod sidecar, or a managed identity-aware proxy that signs its assertions (GKE IAP). Each is a bigger departure from "Kubeflow with `s/istio/gateway/`" than the routing port suggested.

## 1. What Istio does for Kubeflow

Kubeflow's authentication is not an application feature; it is mesh configuration. On the ingress gateway, istiod compiles Kubeflow's manifests into Envoy's HTTP filter chain, in an order Istio dictates:

```
listener ─▶ jwt_authn ─▶ ext_authz ─▶ rbac ─▶ router ─▶ upstream
            RequestAuthentication   AuthorizationPolicy   AuthorizationPolicy   VirtualService
                                    (action: CUSTOM,      (ALLOW / DENY)
                                     provider oauth2-proxy)
```

1. **`ext_authz` → oauth2-proxy.** An anonymous browser gets a `302` to the identity provider; an authenticated one gets `200` plus `Authorization: Bearer <id_token>`, which Envoy *replaces* on the upstream request (`headersToUpstreamOnAllow`). A client cannot smuggle its own token past this point.
2. **`jwt_authn` (`RequestAuthentication`)** validates that token against Dex's JWKS and *writes* `kubeflow-userid` and `kubeflow-groups` from its claims (`outputClaimToHeaders`). Whatever the client sent under those names is overwritten.
3. **`rbac` (`AuthorizationPolicy`, `requestPrincipals: ["*"]`)** denies any request that did not carry a validated token, so nothing leaves the gateway unless step 2 ran.

That is half of the guarantee: every request that traverses the ingress gateway carries an identity header derived on the gateway from a validated token. The other half is at the destination:

- `PeerAuthentication` STRICT: every workload's sidecar accepts only mTLS. A plaintext connection from a pod outside the mesh fails the handshake.
- Each mesh workload holds a certificate whose SAN is its SPIFFE identity (`spiffe://cluster.local/ns/istio-system/sa/istio-ingressgateway-service-account`), issued by istiod against the pod's ServiceAccount.
- The Profile controller writes, into every user namespace, an `AuthorizationPolicy` enforced by the **notebook pod's own sidecar**:

  ```yaml
  from: [{ source: { principals: ["cluster.local/ns/istio-system/sa/istio-ingressgateway-service-account"] } }]
  when: [{ key: request.headers[kubeflow-userid], values: ["owner@example.com"] }]
  ```

  `source.principal` is the peer certificate on *this* connection. A request from any other principal is denied before the header is even read.

The combination is what makes a plain header trustworthy: **the only connections a workload accepts are provably from the gateway, and everything from the gateway had its header rewritten from a validated token.** Neither half alone suffices. Both halves are enforced in sidecars; the application receives plaintext on `localhost` with the header already in place and contains no evidence of either. Deploy the same code without the mesh and nothing warns you — which is precisely what happened, see [§4](#4-what-a-live-deployment-taught-us).

Four properties make this possible, and all four are things Istio can assume because it never had to be portable:

| Property | What it enables |
| :---- | :---- |
| One data plane (Envoy), with Istio's CRDs a thin projection of its filters | `ext_authz`, `jwt_authn` and `rbac` exposed in full, in a fixed order |
| Policy attached to the **proxy** by selector | One `AuthorizationPolicy` on the ingress gateway covers every route; components stay auth-agnostic |
| Identity anchored in **mTLS** (`source.principal`) | A header can be trusted because its setter is cryptographically identified |
| A sidecar on every pod | Enforcement **at the destination**, owned by whoever owns the namespace |

## 2. What Gateway API offers today

Gateway API must mean the same thing on Envoy, nginx, HAProxy, Traefik and cloud load balancers, so it standardizes the intersection. For authentication that intersection is [GEP-1494](https://gateway-api.sigs.k8s.io/geps/gep-1494/) phase 1: an `ExternalAuth` HTTPRoute **filter**, Experimental, modelled on Envoy's `ext_authz` *request* side.

| Istio property | Gateway API today | Consequence |
| :---- | :---- | :---- |
| Proxy-scoped policy | None. Gateway-level defaulting is GEP-1494 "phase 2", undefined | The filter goes into **every HTTPRoute rule** that needs it, including the ones each component ships |
| Ordered filter chain | Filter ordering explicitly "underspecified" | Auth-before-rewrite cannot be relied upon across implementations |
| JWT validation → header | No JWT filter | Identity derivation happens in the auth server or in the application |
| `source.principal` | No caller identity; edge-only | Substitutes: the edge overwriting headers on *every* route, plus `NetworkPolicy` so nothing but the gateway can reach a workload |
| Destination-side enforcement | None | The edge runs the check on the destination's behalf |
| Cross-namespace references implicit | `ReferenceGrant`, `from.namespace` with no wildcard | One entry per tenant namespace whose routes reference the auth service; a missing entry fails the route closed |

Two things a login flow needs are missing from the text of the GEP itself:

- **What the client receives on denial.** The API says only that a non-`200` from an HTTP auth server "is considered an authorization failure". Envoy forwards the auth server's status and headers (a `302 Location:` becomes a redirect); nginx's `auth_request` module can only render `401`/`403` and treats anything else as a `500`. The GEP lists "redirect users to a login page when they lack authentication" as a user story, and does not deliver it.
- **How the original request reaches the auth server.** `HTTPAuthConfig.Path` "sets the prefix that paths from the client request will have added", and "`Path`" is also listed among headers that "must always be sent". Envoy-based implementations append the path to the prefix; NGINX Gateway Fabric calls the prefix verbatim and sends the original URI in a `Path` header. An auth server written for one breaks on the other.

## 3. Implementation survey

Observed on the versions named; the survey is a snapshot.

| Implementation | `ExternalAuth` filter | Denial | Original path | Own auth CRD |
| :---- | :---- | :---- | :---- | :---- |
| Envoy Gateway v1.9.1 | **No** — route `ResolvedRefs=False`, answers `500` | forwards auth server response (Envoy) | appended to prefix | `SecurityPolicy` (Gateway- or route-targeted `extAuth`, OIDC, JWT), `BackendTrafficPolicy` response overrides |
| NGINX Gateway Fabric v2.7.0 | **Yes**, experimental channel + `gwAPIExperimentalFeatures.enable=true` | nginx's own `401`/`403`; any `3xx` → `500` | `Path: $request_uri` header; prefix called verbatim; only `allowedHeaders` forwarded; response headers copied only if listed in `allowedResponseHeaders`; repeated headers joined with commas | `AuthenticationFilter`, `SnippetsFilter` |
| Istio (Gateway API mode) | No (uses its own) | forwards (Envoy) | appended | `AuthorizationPolicy`, `RequestAuthentication` |
| GKE Gateway (`gke-l7-*`) | **No** | n/a | n/a | `GCPBackendPolicy` (IAP, Cloud Armor), `HealthCheckPolicy` |
| cloud-provider-kind (dev/e2e) | Yes | forwards (Envoy) | appended | none |

Two other observations that bear on portability:

- **Static addresses.** `Gateway.spec.addresses` maps to `Service.spec.externalIPs` on Envoy Gateway and NGF; GKE denies that field. The portable path is a two-step: create the Gateway, read `status.addresses`, promote the allocated IP to a reservation — at the price of not knowing the hostname until after the Gateway exists. Envoy Gateway's `EnvoyProxy.envoyService.loadBalancerIP` is the implementation-specific shortcut.
- **Implementation-specific CRDs are not incidental.** Every row's last column is an implementation supplying one of the four Istio properties: Gateway-scoped policy (EG `SecurityPolicy` on a Gateway), response rewriting for redirects (EG `BackendTrafficPolicy`), identity (GKE IAP). Removing them is what exposes the gaps in §4.

## 4. What a live deployment taught us

The branch was deployed on GKE (Dataplane V2, so `NetworkPolicy` is enforced) with Envoy Gateway, Dex and oauth2-proxy, following the [user guide](user-guide-gke-envoy-gateway.md). It worked end to end: `401`/`403`/`200` on the expected paths, `NetworkPolicy` dropping in-cluster bypass attempts, browser login into JupyterLab. Then the Envoy Gateway-specific objects were removed and NGINX Gateway Fabric installed, to see what "portable APIs only" would need. Findings, in the order they mattered:

**F1 — The Envoy Gateway deployment works, with three of its CRDs.** `SecurityPolicy` (the `ext_authz` check, attached once to the Gateway), two empty `SecurityPolicy` objects exempting `/oauth2` and `/dex`, one `ReferenceGrant`, and a `BackendTrafficPolicy` turning `401` into a redirect to the login flow. Everything else was standard.

**F2 — A route with no filter is a public notebook.** With the Gateway-wide policy gone and the controller still running with `EXTERNAL_AUTH_URL` empty (as the Envoy Gateway setup required), the workspace route attached to the new Gateway with no check at all: JupyterLab answered `200` to anonymous requests from the internet. In Istio the gateway-level policy makes this impossible by construction; with route-level filters, *every* path to a pod must carry one, and the controller's route generation must fail closed when it cannot.

**F3 — The API trusted a forged identity header.** The backend authenticates by trusting `kubeflow-userid` when no bearer token or session cookie is present — correct inside Istio, where the gateway rewrites the header. With no filter on the backend's route,

```
curl -H 'kubeflow-userid: user@example.com' https://<host>/workspaces/api/v1/workspaces/team-a   → 200, the workspace list
```

The Gateway-wide `SecurityPolicy` had been the only thing overwriting that header. This is the mesh's "half one" (§1) evaporating silently: the application has no way to distinguish a header the edge set from one the client typed.

**F4 — Nobody owns the login redirect.** An anonymous browser loads the SPA (static assets), whose API calls answer `401`, and stops. In Istio, oauth2-proxy at the gateway answers `302` before any application is reached. With route-level filters the redirect belongs either to the auth server (works where the data plane forwards a `302`: Envoy yes, nginx no) or to the SPA (a frontend change). The `BackendTrafficPolicy` of F1 had been hiding this.

**F5 — Auth checks carry the original method.** Both Envoy's `ext_authz` and nginx's `auth_request` send the subrequest with the original request's method. The backend's check endpoint was registered for `GET` only, so any `POST`/`PUT` — JupyterLab saving a notebook — would have been denied with `405` on either data plane. A bug in the branch, fixed.

**F6 — The original path arrives two different ways** (§2). The backend's check now accepts the path appended to the URL or in the `Path` header, at every HTTP method.

**F7 — Session cookies are not forwarded by default.** GEP-1494's mandatory header set is `Host`, `Method`, `Path`, `Content-Length`, `Authorization`. A cookie-based session needs `allowedHeaders: [Cookie]`, and the identity the check returns reaches the pod only if listed in `allowedResponseHeaders` on nginx. The controller's filter emission lacked both.

**F8 — One `ReferenceGrant` entry per tenant namespace.** The Envoy Gateway policy needed a single grant (gateway namespace → backend). Standard filters on routes in every tenant namespace need the backend's namespace to list each tenant explicitly. Nothing in the branch created those entries; the e2e environment had them hardcoded for the two namespaces it uses. This is a job for the controller, which is the component creating the references.

**F9 — The controller's activity probe is a client too.** The per-workspace `NetworkPolicy` blocked the controller's own Jupyter probe; culling stalled. Found only because GKE enforces `NetworkPolicy` and kind does not. Fixed with a second allowed peer.

**F10 — The frontend's mode is compiled in.** The image is built for the Central Dashboard by default and shows an empty shell without it. A build argument was added; the published image alone does not work standalone.

F2 and F3 were both live on a public IP for a short time during the switch and were mitigated by detaching the routes. They are the empirical content of this document: the Envoy Gateway deployment was not secure *because of the portable parts*; it was secure because one implementation-specific policy did what Istio's gateway-level policy does.

## 5. Routes evaluated

Each route is described with what it solves, what it costs, and the verdict reached. They are not mutually exclusive; several combine.

### R1 — Envoy Gateway with its `SecurityPolicy` (validated)

The [user guide](user-guide-gke-envoy-gateway.md). One `ext_authz` policy on the Gateway, exemptions for the login endpoints, a response override for the redirect.

- Solves: everything, end to end, today. Gateway-scoped policy restores "half one" of the Istio guarantee for all routes at once; the redirect is one object.
- Costs: three Envoy Gateway CRDs in the deployment (`SecurityPolicy`, `BackendTrafficPolicy`, `EnvoyProxy` for the static IP). Routes carry no standard filter, so the deployment is only as portable as those objects.
- Verdict: **the working reference deployment.** Rejected as the *target* because the objects that make it secure are the ones that lock it to one implementation.

### R2 — Standard `ExternalAuth` filter with NGINX Gateway Fabric (partially executed)

Replace Envoy Gateway with the one implementation shipping the filter; the controller emits the filter on workspace routes; two-step static IP.

- Solves: no implementation CRDs; the controller's existing filter emission is used as designed.
- Costs: F2, F3, F4 immediately (the filter must also be on the frontend and backend routes; the redirect is impossible on nginx); F6–F8 needed code (done for F5–F7; F8 designed, not built). nginx renders its own error pages; a backend `400` becomes a `500`.
- Verdict: **feasible for the check, not for the login experience.** Stopped before completion once the architectural questions below surfaced.

### R3 — Login redirect by cookie-presence routing

HTTPRoute cannot match "header absent", but rule precedence can: a frontend rule matching `Cookie ~ _oauth2_proxy=` wins for logged-in browsers; a fallback rule forwards anonymous ones to oauth2-proxy's `/oauth2/start` via `URLRewrite` and `RequestHeaderModifier` (a `RequestRedirect` cannot carry a query string).

- Solves: a redirect with core filters only, on any implementation.
- Costs: a kustomize patch on the frontend's shipped route; regex header matching (Extended); a present-but-expired cookie still lands on the error page; it encodes the session cookie's name in routing.
- Verdict: **rejected as a workaround for a missing responsibility** — it worked around the architecture rather than fixing it.

### R4 — "Edge identity": `s/istio/gateway/`

Every route (frontend, backend, workspaces) carries an `ExternalAuth` filter; oauth2-proxy is the auth server, emitting `kubeflow-userid`/`kubeflow-groups` itself (its `injectResponseHeaders`, in place of Istio's `RequestAuthentication`); the edge copies them upstream with overwrite semantics; workspace routes point their filter at the backend's `/authz` for the `SubjectAccessReview` the Profile controller's policy used to provide; applications trust the header as they do in Kubeflow.

- Solves: F3 the way Kubeflow solves it; minimal drift for the application code; one enforcement model.
- Costs: filters inside each component's shipped HTTPRoute, referencing a deployment's oauth2-proxy (no gateway-level policy to put them on); `ReferenceGrant`s in two directions; the redirect still depends on the implementation forwarding oauth2-proxy's `302` (nginx cannot — `--api-route=^/` demotes it to `401` everywhere); oauth2-proxy's `/oauth2/auth` answers `202`, which Envoy's `ext_authz` rejects, so the check must hit oauth2-proxy's proxy path with a `static://200` upstream; the trust anchor degrades from mTLS to "the edge overwrote the header on every route" plus `NetworkPolicy`.
- Verdict: **the faithful translation, and it is exactly as brittle as the original without the mesh's cryptographic anchor.** The application still carries no evidence of who set the header.

### R5 — "Backend identity"

The edge only guards what cannot guard itself (workspace pods); the backend authenticates its own API callers (session cookie via oauth2-proxy, bearer token via `TokenReview`) and stops trusting identity headers in this configuration; the SPA follows the API's `401` to the login URL the backend advertises.

- Solves: F3 structurally (no header trust), F4 in the ordinary SPA way; no dependence on denial semantics; identical on nginx and Envoy.
- Costs: a small frontend change; a flag on the backend, default preserving Kubeflow behaviour; a deep link to a workspace with an expired session lands on a `401` page rather than the login form.
- Verdict: **viable and the only route that fully works on today's implementations**, at the price of diverging from Kubeflow's "trust the header" contract.

### R6 — Verify, don't trust

Orthogonal hardening for R4 or R5: oauth2-proxy already forwards the ID token upstream (`--set-authorization-header`, and Kubeflow's Istio configuration forwards `Authorization` on allow). The backend validates that JWT itself — issuer, audience, signature against the IdP's JWKS — the work Istio's `RequestAuthentication` does, moved into the process. `kubeflow-userid` stays as the contract for pods and other Kubeflow apps, but the backend's security no longer rests on the edge overwriting a header.

- Solves: F3 with cryptographic evidence that travels with the request; works identically under Istio and under any Gateway implementation.
- Costs: a second bearer authenticator (`TokenReview` for cluster tokens, OIDC verification for ID tokens) and its configuration.
- Verdict: **recommended in every model.** It is the one change that makes the Istio → Gateway move safe rather than merely consistent.

### R7 — GKE Gateway with Identity-Aware Proxy, upstream untouched

Use Google's load balancer as the Gateway implementation and IAP as the authenticator. IAP handles login (`302` for browsers, `401` for XHR/`POST`), gates entry with IAM, strips client `x-goog-*` headers, and adds `x-goog-iap-jwt-assertion`: an ES256 JWT (`iss https://cloud.google.com/iap`, `aud` the LB backend service, `email`, `sub`) that the application **verifies** against Google's JWKS — Google's own documentation calls this the defence against IAP being disabled, misconfigured firewalls, and access from within the project. Since IAP is per backend Service (`GCPBackendPolicy`) and the GKE Gateway has no `ExternalAuth` filter, a small adapter of our own sits between the LB and upstream:

- **W1 — companion operator + sidecar.** Per-Workspace `HTTPRoute`, `GCPBackendPolicy`, `HealthCheckPolicy`; a mutating webhook injects an auth sidecar into workspace pods that verifies the JWT, runs the `SubjectAccessReview`, sets `kubeflow-userid`, and proxies to Jupyter. Istio's destination-side model without a mesh.
- **W2 — one auth-and-routing proxy.** `/workspaces/api/` and `/workspace/connect/` route to a single proxy that verifies the JWT, sets the identity headers, runs the `SubjectAccessReview` for connect paths, resolves Workspace → WorkspaceKind port → Service (honouring `httpProxy.removePathPrefix` and `requestHeaders`), and proxies, WebSockets included. No per-workspace objects; one `NetworkPolicy` per tenant namespace; IAP on two Services. The upstream controller runs with routing off; the upstream backend keeps trusting headers because the proxy is its only caller (sidecar in its pod, or `NetworkPolicy`).

- Solves: the identity anchor problem outright (signed assertion, verified in code), login, TLS, static IP, header stripping — with **no changes to the upstream project**. Everything GKE-specific lives in the deployment.
- Costs: GKE-only (`GatewayClass`, `GCPBackendPolicy`, IAM, Google or Identity Platform identities); a data-path component we own (W2) or an operator plus webhook (W1); re-implementing the connect-path routing semantics the controller already has; IAP's WebSocket support and per-Service granularity need confirming; the GKE Gateway controller manages the standard CRDs, so it cannot share a cluster with an experimental-channel install.
- Verdict: **the most robust identity model available on GKE, and the natural shape for a GKE product**: an adapter around an unmodified upstream. It uses none of this branch's runtime code.

### R8 — Other shapes considered and set aside

- **Backend as the single front door** for all traffic on every platform: W2 without IAP. Attractive for the network, but the API process becomes a WebSocket proxy for every notebook; kept as the GKE-specific W2 only.
- **A dedicated authorization service**: built and dropped earlier (see the design document's alternatives); the split into oauth2-proxy plus the backend's `/authz` remains the right factoring.
- **Gateway → backend mTLS with a client certificate** (`Gateway.spec.tls.backend.clientCertificateRef`, experimental; NGF supports it): the true equivalent of `source.principal`, with the added benefit that the *application* holds the evidence since TLS terminates in the process. Set aside for operational cost; worth revisiting if the field graduates.
- **Cloud Service Mesh / managed Istio**: solves nothing the user objected to — it is the same implicit, mesh-held guarantee, managed.

## 6. Why a complete replacement is not feasible today

"Complete" means: a deployment using only Gateway API and core Kubernetes that gives Kubeflow's applications the same guarantee Istio gives them, with no changes to those applications and no implementation-specific objects. That requires four primitives, none of which the standard has:

1. **Gateway-scoped authentication policy** — so a platform owner attaches the check once and components stay auth-agnostic. GEP-1494 phase 2; not started.
2. **Specified denial semantics** — so the auth server's `302` reaches the browser on every implementation. Not in GEP-1494; nginx-based implementations cannot do it without rendering `Location` themselves.
3. **A verifiable identity primitive at the edge** — a JWT filter writing claims to headers, or a signed assertion the application can check. Not in Gateway API; IAP is the managed exception.
4. **Destination-side enforcement, or an authenticated caller identity** — `source.principal`. Not in Gateway API; `NetworkPolicy` is the label-based approximation, and backend client certificates are experimental.

Every implementation fills those with CRDs; that is what their auth CRDs *are*. So the choice is not "portable or Istio" but one of three:

- **Accept one implementation's CRDs** (R1). Works today, locks the security half of the deployment to that implementation.
- **Move identity into the application** (R5 + R6, and for pods either the edge check or W1's sidecar). Portable and robust, and a deliberate departure from Kubeflow's trust-the-header contract: the backend verifies tokens, the frontend knows where login is, the controller creates `ReferenceGrant`s and fails routes closed.
- **Use a managed identity-aware proxy and adapt around upstream** (R7). Robust, platform-specific, and leaves the project untouched.

What *is* portable and worth keeping regardless: the controller's Gateway API routing, the per-workspace `NetworkPolicy` with the controller as a second peer, the backend's `/authz` speaking the `ExternalAuth` contract at every method and both path conventions, `TokenReview`, and RBAC-only tenancy. Those are the parts of Istio's job that were routing and reachability, and they translate cleanly. Identity does not.

## 7. Recommendations

1. Keep the Istio deployment as the default and the reference for the Kubeflow distribution; nothing here weakens it.
2. Ship the Envoy Gateway walk-through as the documented non-Istio deployment, naming the three implementation-specific objects for what they are: the security half of the deployment.
3. Land the portable pieces that are correct on every implementation: filter header lists, `/authz` for all methods and both path conventions, controller-managed `ReferenceGrant`, fail-closed route generation.
4. Add token verification to the backend (R6) independent of any routing decision.
5. For a GKE product, design the adapter of R7 (W2 preferred) as a separate deliverable that consumes upstream releases unmodified; confirm IAP WebSocket support and per-Service granularity first.
6. Upstream asks, each of which would remove a row from §6: GEP-1494 to specify the denial response and the `Path` convention; NGINX Gateway Fabric to honour `Location` from the auth server (`auth_request_set` + `error_page 401` is how ingress-nginx does it); Envoy Gateway and GKE Gateway to implement the standard filter.

## Appendix: NGINX Gateway Fabric `ExternalAuth` rendering (v2.7.0)

For the record, since the semantics drove several findings. An `ExternalAuth` filter renders an internal location roughly as:

```nginx
location = /_ngf_external_auth_<hash> {
    internal;
    proxy_pass              http://<upstream><HTTPAuthConfig.Path>;   # prefix called verbatim
    proxy_pass_request_headers off;
    proxy_pass_request_body    off;                                     # unless forwardBody
    proxy_set_header Host          $gw_api_compliant_host;
    proxy_set_header Path          $request_uri;                        # original URI, with query
    proxy_set_header Method        $request_method;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header <h>           $http_<h>;                           # each allowedHeaders entry
}
location /route {
    auth_request /_ngf_external_auth_<hash>;
    auth_request_set $ext_auth_<h> $upstream_http_<h>;                  # each allowedResponseHeaders entry
    proxy_set_header <h> $ext_auth_<h>;                                 # empty value strips the header
}
```

`auth_request` allows on `2xx`, returns nginx's own page on `401`/`403`, and fails with `500` on anything else — including a `302`. Repeated response headers arrive joined with commas. The subrequest keeps the original request's method.
