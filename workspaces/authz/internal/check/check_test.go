/*
Copyright 2026.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package check

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"testing"

	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

type fakeAuthenticator struct {
	identity *Identity
	err      error
}

func (f *fakeAuthenticator) Authenticate(context.Context, *Request) (*Identity, error) {
	return f.identity, f.err
}

func (f *fakeAuthenticator) Challenge(*Request) Decision {
	return Decision{Status: http.StatusFound, ResponseHeaders: http.Header{"Location": []string{"/login"}}}
}

type fakeAuthorizer struct {
	decision   authorizer.Decision
	err        error
	attributes authorizer.Attributes
}

func (f *fakeAuthorizer) Authorize(_ context.Context, a authorizer.Attributes) (authorizer.Decision, string, error) {
	f.attributes = a
	return f.decision, "", f.err
}

func newChecker(authn Authenticator, authz authorizer.Authorizer) *Checker {
	return &Checker{
		Authenticator: authn,
		Authorizer:    authz,
		UserIDHeader:  "kubeflow-userid",
		GroupsHeader:  "kubeflow-groups",
	}
}

func testIdentity() *Identity {
	return &Identity{
		User:  &user.DefaultInfo{Name: "ana@example.com", Groups: []string{"team-a", "team-b"}},
		Token: "id-token",
	}
}

func TestCheckAllowsAuthenticatedRequestToBackend(t *testing.T) {
	authz := &fakeAuthorizer{decision: authorizer.DecisionAllow}
	checker := newChecker(&fakeAuthenticator{identity: testIdentity()}, authz)

	decision, err := checker.Check(context.Background(), &Request{
		Method: http.MethodGet,
		Path:   "/workspaces/api/v1/workspaces",
	})
	if err != nil {
		t.Fatalf("Check returned unexpected error: %v", err)
	}
	if !decision.Allow {
		t.Fatalf("Check denied an authenticated request to the backend")
	}
	if authz.attributes != nil {
		t.Errorf("Check ran a SubjectAccessReview for a backend path; the backend does its own checks")
	}
}

// TestCheckOverwritesClientSuppliedIdentityHeaders is the control that replaces
// the Istio AuthorizationPolicy: upstream services must never see an identity
// header that the client chose.
func TestCheckOverwritesClientSuppliedIdentityHeaders(t *testing.T) {
	checker := newChecker(&fakeAuthenticator{identity: testIdentity()}, &fakeAuthorizer{decision: authorizer.DecisionAllow})

	decision, err := checker.Check(context.Background(), &Request{
		Method: http.MethodGet,
		Path:   "/workspaces/api/v1/workspaces",
		Headers: http.Header{
			"Kubeflow-Userid": []string{"admin@example.com"},
			"Kubeflow-Groups": []string{"system:masters"},
		},
	})
	if err != nil {
		t.Fatalf("Check returned unexpected error: %v", err)
	}

	if got := decision.UpstreamHeaders.Values("kubeflow-userid"); !slices.Equal(got, []string{"ana@example.com"}) {
		t.Errorf("upstream kubeflow-userid = %v, want [ana@example.com]", got)
	}
	if got := decision.UpstreamHeaders.Values("kubeflow-groups"); !slices.Equal(got, []string{"team-a", "team-b"}) {
		t.Errorf("upstream kubeflow-groups = %v, want [team-a team-b]", got)
	}
	if got := decision.UpstreamHeaders.Get("Authorization"); got != "Bearer id-token" {
		t.Errorf("upstream Authorization = %q, want %q", got, "Bearer id-token")
	}
}

// TestCheckAlwaysSetsGroupsHeader guards the case where the user has no groups:
// the header must still be set so that it overwrites a client-supplied value.
func TestCheckAlwaysSetsGroupsHeader(t *testing.T) {
	identity := &Identity{User: &user.DefaultInfo{Name: "ana@example.com"}, Token: "id-token"}
	checker := newChecker(&fakeAuthenticator{identity: identity}, &fakeAuthorizer{decision: authorizer.DecisionAllow})

	decision, err := checker.Check(context.Background(), &Request{Path: "/workspaces/"})
	if err != nil {
		t.Fatalf("Check returned unexpected error: %v", err)
	}
	if _, ok := decision.UpstreamHeaders["Kubeflow-Groups"]; !ok {
		t.Errorf("upstream headers %v do not set the groups header for a user with no groups", decision.UpstreamHeaders)
	}
}

func TestCheckAuthorizesWorkspaceConnectPath(t *testing.T) {
	authz := &fakeAuthorizer{decision: authorizer.DecisionAllow}
	checker := newChecker(&fakeAuthenticator{identity: testIdentity()}, authz)

	decision, err := checker.Check(context.Background(), &Request{
		Method: http.MethodGet,
		Path:   "/workspace/connect/my-ns/my-ws/jupyterlab/api/kernels",
	})
	if err != nil {
		t.Fatalf("Check returned unexpected error: %v", err)
	}
	if !decision.Allow {
		t.Fatalf("Check denied a request the authorizer allowed")
	}

	got := authz.attributes
	if got == nil {
		t.Fatal("Check did not run a SubjectAccessReview for a workspace connect path")
	}
	if got.GetUser().GetName() != "ana@example.com" {
		t.Errorf("SubjectAccessReview user = %q, want ana@example.com", got.GetUser().GetName())
	}
	if got.GetVerb() != "get" || got.GetAPIGroup() != "kubeflow.org" || got.GetResource() != "workspaces" {
		t.Errorf("SubjectAccessReview checked %s %s/%s, want get kubeflow.org/workspaces",
			got.GetVerb(), got.GetAPIGroup(), got.GetResource())
	}
	if got.GetNamespace() != "my-ns" || got.GetName() != "my-ws" {
		t.Errorf("SubjectAccessReview scoped to %s/%s, want my-ns/my-ws", got.GetNamespace(), got.GetName())
	}
}

func TestCheckDeniesUnauthorizedWorkspaceConnect(t *testing.T) {
	checker := newChecker(&fakeAuthenticator{identity: testIdentity()}, &fakeAuthorizer{decision: authorizer.DecisionDeny})

	decision, err := checker.Check(context.Background(), &Request{
		Path: "/workspace/connect/other-ns/other-ws/jupyterlab/",
	})
	if err != nil {
		t.Fatalf("Check returned unexpected error: %v", err)
	}
	if decision.Allow {
		t.Fatal("Check allowed a request the authorizer denied")
	}
	if decision.Status != http.StatusForbidden {
		t.Errorf("denial status = %d, want %d", decision.Status, http.StatusForbidden)
	}
}

func TestCheckChallengesWhenCredentialsAreMissing(t *testing.T) {
	checker := newChecker(&fakeAuthenticator{err: ErrNoCredentials}, &fakeAuthorizer{decision: authorizer.DecisionAllow})

	decision, err := checker.Check(context.Background(), &Request{Path: "/workspaces/"})
	if err != nil {
		t.Fatalf("Check returned unexpected error: %v", err)
	}
	if decision.Allow {
		t.Fatal("Check allowed a request with no credentials")
	}
	if decision.Status != http.StatusFound {
		t.Errorf("challenge status = %d, want %d", decision.Status, http.StatusFound)
	}
}

// TestCheckFailsClosedOnInfrastructureErrors ensures that a failure to reach the
// identity provider or the Kubernetes API is reported as an error, which the
// transports turn into a 5xx, rather than being mistaken for a denial or an
// allow.
func TestCheckFailsClosedOnInfrastructureErrors(t *testing.T) {
	tests := []struct {
		name    string
		checker *Checker
	}{
		{
			name:    "authenticator error",
			checker: newChecker(&fakeAuthenticator{err: errors.New("issuer unreachable")}, &fakeAuthorizer{decision: authorizer.DecisionAllow}),
		},
		{
			name:    "authorizer error",
			checker: newChecker(&fakeAuthenticator{identity: testIdentity()}, &fakeAuthorizer{err: errors.New("api server unreachable")}),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			decision, err := tt.checker.Check(context.Background(), &Request{
				Path: "/workspace/connect/my-ns/my-ws/jupyterlab/",
			})
			if err == nil {
				t.Fatalf("Check returned decision %+v and no error, want an error", decision)
			}
			if decision.Allow {
				t.Error("Check allowed a request despite an infrastructure error")
			}
		})
	}
}

func TestCheckRejectsMalformedConnectPath(t *testing.T) {
	authz := &fakeAuthorizer{decision: authorizer.DecisionAllow}
	checker := newChecker(&fakeAuthenticator{identity: testIdentity()}, authz)

	decision, err := checker.Check(context.Background(), &Request{
		Path: "/workspace/connect/../../etc/passwd/",
	})
	if err != nil {
		t.Fatalf("Check returned unexpected error: %v", err)
	}
	if decision.Allow {
		t.Fatal("Check allowed a malformed workspace connect path")
	}
	if authz.attributes != nil {
		t.Error("Check ran a SubjectAccessReview for a malformed path")
	}
}
