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

// Package policy maps request paths to the Kubernetes permission required to
// serve them. It has no external dependencies so that the mapping can be
// reviewed and tested in isolation from the transports that use it.
package policy

import (
	"errors"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
)

// ConnectPathPrefix is the prefix under which the controller exposes workspace
// ports. It MUST stay in sync with workspaceConnectPathTemplate in
// workspaces/controller/internal/controller/workspace_controller.go.
const ConnectPathPrefix = "/workspace/connect/"

// ErrMalformedPath is returned when a path targets the workspace connect prefix
// but cannot be parsed into a valid namespace and workspace name.
var ErrMalformedPath = errors.New("malformed workspace connect path")

// Requirement describes the authorization check a request must pass.
type Requirement struct {
	// Verb, Group, Resource identify the Kubernetes permission to check.
	// Empty Resource means no resource-level check is required and
	// authentication alone is sufficient.
	Verb     string
	Group    string
	Resource string

	// Namespace and Name scope the check. Both are empty for cluster-scoped or
	// authentication-only requirements.
	Namespace string
	Name      string
}

// AuthnOnly reports whether the requirement is satisfied by a valid identity,
// without any further authorization check by this service.
func (r Requirement) AuthnOnly() bool {
	return r.Resource == ""
}

// For returns the Requirement that must be satisfied to serve the given path.
//
// Requests under ConnectPathPrefix are proxied straight to a workspace pod, so
// this service is the only thing standing between the client and the notebook:
// they require "get" on the target Workspace. Every other path is served by the
// backend or the frontend, which perform their own fine-grained checks, so they
// only require a valid identity.
func For(path string) (Requirement, error) {
	if !strings.HasPrefix(path, ConnectPathPrefix) {
		return Requirement{}, nil
	}

	namespace, name, err := parseConnectPath(path)
	if err != nil {
		return Requirement{}, err
	}

	return Requirement{
		Verb:      "get",
		Group:     "kubeflow.org",
		Resource:  "workspaces",
		Namespace: namespace,
		Name:      name,
	}, nil
}

// parseConnectPath extracts the namespace and workspace name from a workspace
// connect path of the form "/workspace/connect/{namespace}/{name}/{portId}/...".
//
// Both segments are validated as Kubernetes object names, which rejects path
// traversal ("..", "."), empty segments, and percent-encoded separators without
// needing to normalize the path first.
func parseConnectPath(path string) (namespace, name string, err error) {
	rest := strings.TrimPrefix(path, ConnectPathPrefix)

	// A connect path always has a port segment after the name, so requiring
	// three segments also rejects a bare "/workspace/connect/ns/name".
	segments := strings.SplitN(rest, "/", 4)
	if len(segments) < 3 {
		return "", "", ErrMalformedPath
	}
	namespace, name = segments[0], segments[1]

	if errs := validation.IsDNS1123Subdomain(namespace); len(errs) > 0 {
		return "", "", ErrMalformedPath
	}
	if errs := validation.IsDNS1123Subdomain(name); len(errs) > 0 {
		return "", "", ErrMalformedPath
	}
	if segments[2] == "" {
		return "", "", ErrMalformedPath
	}

	return namespace, name, nil
}
