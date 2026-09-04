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
	"testing"
)

func TestPoliciesForPathAuthnOnly(t *testing.T) {
	paths := []string{
		"/",
		"/workspaces",
		"/workspaces/",
		"/workspaces/api/v1/workspaces/my-ns",
		"/static/main.js",
		// Similar to, but not under, the connect prefix.
		"/workspace/connect",
		"/workspace/connectx/ns/name/jupyterlab/",
		"/prefix/workspace/connect/ns/name/jupyterlab/",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			policies, err := PoliciesForPath(path)
			if err != nil {
				t.Fatalf("PoliciesForPath(%q) returned unexpected error: %v", path, err)
			}
			if len(policies) != 0 {
				t.Errorf("PoliciesForPath(%q) = %+v, want no policies", path, policies)
			}
		})
	}
}

func TestPoliciesForPathConnectPaths(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		wantNamespace string
		wantName      string
	}{
		{"port segment only", "/workspace/connect/my-ns/my-ws/jupyterlab/", "my-ns", "my-ws"},
		{"trailing sub path", "/workspace/connect/my-ns/my-ws/jupyterlab/api/kernels", "my-ns", "my-ws"},
		{"no trailing slash after port", "/workspace/connect/my-ns/my-ws/jupyterlab", "my-ns", "my-ws"},
		{"dotted names", "/workspace/connect/team.a/ws.1/rstudio/", "team.a", "ws.1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			policies, err := PoliciesForPath(tt.path)
			if err != nil {
				t.Fatalf("PoliciesForPath(%q) returned unexpected error: %v", tt.path, err)
			}
			if len(policies) != 1 {
				t.Fatalf("PoliciesForPath(%q) = %+v, want exactly one policy", tt.path, policies)
			}

			attrs := policies[0].AttributesFor(nil)
			if attrs.GetVerb() != "get" || attrs.GetAPIGroup() != "kubeflow.org" || attrs.GetResource() != "workspaces" {
				t.Errorf("policy checks %s %s/%s, want get kubeflow.org/workspaces",
					attrs.GetVerb(), attrs.GetAPIGroup(), attrs.GetResource())
			}
			if attrs.GetNamespace() != tt.wantNamespace || attrs.GetName() != tt.wantName {
				t.Errorf("policy scoped to %s/%s, want %s/%s",
					attrs.GetNamespace(), attrs.GetName(), tt.wantNamespace, tt.wantName)
			}
		})
	}
}

// TestPoliciesForPathRejectsMalformed covers inputs that must never resolve to a
// namespace and name, because doing so would let a caller aim the
// SubjectAccessReview at a different workspace than the one it reaches.
func TestPoliciesForPathRejectsMalformed(t *testing.T) {
	paths := []string{
		// Too few segments.
		"/workspace/connect/",
		"/workspace/connect/my-ns",
		"/workspace/connect/my-ns/",
		"/workspace/connect/my-ns/my-ws",
		"/workspace/connect/my-ns/my-ws/",
		// Empty segments.
		"/workspace/connect//my-ws/jupyterlab/",
		"/workspace/connect/my-ns//jupyterlab/",
		// Path traversal.
		"/workspace/connect/../../my-ws/jupyterlab/",
		"/workspace/connect/my-ns/../other-ns/jupyterlab/",
		"/workspace/connect/./my-ws/jupyterlab/",
		// Percent-encoded separators and traversal.
		"/workspace/connect/my-ns%2f..%2fother/my-ws/jupyterlab/",
		"/workspace/connect/%2e%2e/my-ws/jupyterlab/",
		// Invalid Kubernetes object names.
		"/workspace/connect/MyNamespace/my-ws/jupyterlab/",
		"/workspace/connect/my ns/my-ws/jupyterlab/",
		"/workspace/connect/my-ns/my_ws/jupyterlab/",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			policies, err := PoliciesForPath(path)
			if !errors.Is(err, ErrMalformedConnectPath) {
				t.Fatalf("PoliciesForPath(%q) = (%+v, %v), want ErrMalformedConnectPath", path, policies, err)
			}
		})
	}
}
