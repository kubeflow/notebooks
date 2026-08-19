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

// Package check contains the transport-independent authorization decision. Both
// the gRPC (Envoy ext_authz) and HTTP (forward-auth) servers call Checker.Check
// and translate the result into their own wire format.
package check

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/kubeflow/notebooks/workspaces/authz/internal/policy"
)

// Identity is the authenticated caller, plus the credential to hand upstream.
type Identity struct {
	User user.Info

	// Token is the bearer token that proves this identity to the Kubernetes API
	// server. Upstream services revalidate it with a TokenReview rather than
	// trusting a username header.
	Token string
}

// Authenticator resolves an identity from a request.
//
// It returns ErrNoCredentials when the request carries no usable credential, so
// that the caller can start a login flow instead of returning a bare 403.
type Authenticator interface {
	Authenticate(ctx context.Context, r *Request) (*Identity, error)

	// Challenge builds the response that prompts the client to authenticate,
	// such as a redirect to the identity provider.
	Challenge(r *Request) Decision
}

// ErrNoCredentials indicates the request carried no credential at all.
var ErrNoCredentials = errors.New("no credentials in request")

// Request is the subset of an HTTP request the decision depends on.
type Request struct {
	Method  string
	Path    string
	Host    string
	Scheme  string
	Headers http.Header
}

// Decision is the outcome of a check.
type Decision struct {
	// Allow reports whether the request may proceed to the upstream service.
	Allow bool

	// UpstreamHeaders are set on the request forwarded upstream when Allow is
	// true. Transports MUST apply the first value of each key with overwrite
	// semantics, so that a client-supplied header of the same name is always
	// replaced rather than appended to.
	UpstreamHeaders http.Header

	// Status, ResponseHeaders and Body form the response returned to the client
	// when Allow is false.
	Status          int
	ResponseHeaders http.Header
	Body            string
}

// Denied builds a Decision that rejects the request with the given status.
func Denied(status int, body string) Decision {
	return Decision{
		Allow:           false,
		Status:          status,
		ResponseHeaders: http.Header{"Content-Type": []string{"text/plain; charset=utf-8"}},
		Body:            body,
	}
}

// Checker authenticates a request and authorizes it against Kubernetes RBAC.
type Checker struct {
	Authenticator Authenticator
	Authorizer    authorizer.Authorizer

	// UserIDHeader and GroupsHeader name the identity headers set on allowed
	// requests for services that do not yet validate the bearer token.
	UserIDHeader string
	GroupsHeader string
}

// Check decides whether a request may proceed.
//
// Any error reaching the identity provider or the Kubernetes API surfaces as an
// error rather than a denial, so that the transports can fail closed with a 5xx
// and keep those failures distinguishable from genuine authorization denials.
func (c *Checker) Check(ctx context.Context, r *Request) (Decision, error) {
	requirement, err := policy.For(r.Path)
	if err != nil {
		return Denied(http.StatusBadRequest, "malformed request path"), nil
	}

	identity, err := c.Authenticator.Authenticate(ctx, r)
	switch {
	case errors.Is(err, ErrNoCredentials):
		return c.Authenticator.Challenge(r), nil
	case err != nil:
		return Decision{}, fmt.Errorf("authenticating request: %w", err)
	}

	if !requirement.AuthnOnly() {
		attributes := authorizer.AttributesRecord{
			User:            identity.User,
			Verb:            requirement.Verb,
			APIGroup:        requirement.Group,
			Resource:        requirement.Resource,
			Namespace:       requirement.Namespace,
			Name:            requirement.Name,
			ResourceRequest: true,
		}

		decision, reason, err := c.Authorizer.Authorize(ctx, attributes)
		if err != nil {
			return Decision{}, fmt.Errorf("authorizing %q for user %q: %w", r.Path, identity.User.GetName(), err)
		}
		if decision != authorizer.DecisionAllow {
			// The reason is intentionally not returned to the client, as it can
			// disclose whether a workspace exists.
			return Denied(http.StatusForbidden, "forbidden"), nil
		}
		_ = reason
	}

	return c.allow(identity), nil
}

func (c *Checker) allow(identity *Identity) Decision {
	upstream := http.Header{}
	if identity.Token != "" {
		upstream.Set("Authorization", "Bearer "+identity.Token)
	}

	// Both identity headers are always set, even when the value is empty, so
	// that a client-supplied value is overwritten rather than passed through to
	// services that still trust these headers.
	upstream.Set(c.UserIDHeader, identity.User.GetName())
	upstream.Set(c.GroupsHeader, "")
	for i, group := range identity.User.GetGroups() {
		if i == 0 {
			upstream.Set(c.GroupsHeader, group)
			continue
		}
		upstream.Add(c.GroupsHeader, group)
	}

	return Decision{
		Allow:           true,
		UpstreamHeaders: upstream,
	}
}
