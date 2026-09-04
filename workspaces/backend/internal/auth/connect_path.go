/*
Copyright 2024.

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

package auth

import (
	"errors"
	"strings"

	"k8s.io/apimachinery/pkg/util/validation"
)

// WorkspaceConnectPathPrefix is the prefix under which the controller exposes
// workspace ports. It MUST stay in sync with workspaceConnectPathTemplate in
// workspaces/controller/internal/controller/workspace_controller.go.
const WorkspaceConnectPathPrefix = "/workspace/connect/"

// ErrMalformedConnectPath is returned when a path targets the workspace connect
// prefix but cannot be parsed into a valid namespace and workspace name.
var ErrMalformedConnectPath = errors.New("malformed workspace connect path")

// PoliciesForPath returns the ResourcePolicies a caller must satisfy for a
// request path, as evaluated by the external authorization endpoint.
//
// Requests under WorkspaceConnectPathPrefix are proxied straight to a workspace
// pod, which has no authentication of its own: they require "get" on the target
// Workspace. Every other path is served by a component that performs its own
// checks, so a valid identity is sufficient and no policy is returned.
func PoliciesForPath(path string) ([]*ResourcePolicy, error) {
	if !strings.HasPrefix(path, WorkspaceConnectPathPrefix) {
		return nil, nil
	}

	namespace, name, err := parseConnectPath(path)
	if err != nil {
		return nil, err
	}

	return []*ResourcePolicy{
		NewResourcePolicy(VerbGet, Workspaces, ResourcePolicyResourceMeta{
			Namespace: namespace,
			Name:      name,
		}),
	}, nil
}

// parseConnectPath extracts the namespace and workspace name from a workspace
// connect path of the form "/workspace/connect/{namespace}/{name}/{portId}/...".
//
// Both segments are validated as Kubernetes object names, which rejects path
// traversal ("..", "."), empty segments, and percent-encoded separators without
// needing to normalize the path first. This matters because resolving a
// malformed path would aim the SubjectAccessReview at a different workspace
// than the one the request reaches.
func parseConnectPath(path string) (namespace, name string, err error) {
	rest := strings.TrimPrefix(path, WorkspaceConnectPathPrefix)

	// A connect path always has a port segment after the name, so requiring
	// three segments also rejects a bare "/workspace/connect/ns/name".
	segments := strings.SplitN(rest, "/", 4)
	if len(segments) < 3 {
		return "", "", ErrMalformedConnectPath
	}
	namespace, name = segments[0], segments[1]

	if errs := validation.IsDNS1123Subdomain(namespace); len(errs) > 0 {
		return "", "", ErrMalformedConnectPath
	}
	if errs := validation.IsDNS1123Subdomain(name); len(errs) > 0 {
		return "", "", ErrMalformedConnectPath
	}
	if segments[2] == "" {
		return "", "", ErrMalformedConnectPath
	}

	return namespace, name, nil
}
