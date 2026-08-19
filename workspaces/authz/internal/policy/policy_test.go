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

package policy

import (
	"errors"
	"testing"
)

func TestForAuthnOnlyPaths(t *testing.T) {
	paths := []string{
		"/",
		"/workspaces",
		"/workspaces/",
		"/workspaces/api/v1/workspaces/my-ns",
		"/workspaces/api/v1/healthcheck",
		"/static/main.js",
		// Similar to, but not under, the connect prefix.
		"/workspace/connect",
		"/workspace/connectx/ns/name/jupyterlab/",
		"/prefix/workspace/connect/ns/name/jupyterlab/",
	}

	for _, path := range paths {
		t.Run(path, func(t *testing.T) {
			req, err := For(path)
			if err != nil {
				t.Fatalf("For(%q) returned unexpected error: %v", path, err)
			}
			if !req.AuthnOnly() {
				t.Errorf("For(%q) = %+v, want an authentication-only requirement", path, req)
			}
		})
	}
}

func TestForConnectPaths(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		wantNamespace string
		wantName      string
	}{
		{
			name:          "port segment only",
			path:          "/workspace/connect/my-ns/my-ws/jupyterlab/",
			wantNamespace: "my-ns",
			wantName:      "my-ws",
		},
		{
			name:          "trailing sub path",
			path:          "/workspace/connect/my-ns/my-ws/jupyterlab/api/kernels",
			wantNamespace: "my-ns",
			wantName:      "my-ws",
		},
		{
			name:          "no trailing slash after port",
			path:          "/workspace/connect/my-ns/my-ws/jupyterlab",
			wantNamespace: "my-ns",
			wantName:      "my-ws",
		},
		{
			name:          "dotted names",
			path:          "/workspace/connect/team.a/ws.1/rstudio/",
			wantNamespace: "team.a",
			wantName:      "ws.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, err := For(tt.path)
			if err != nil {
				t.Fatalf("For(%q) returned unexpected error: %v", tt.path, err)
			}
			if req.AuthnOnly() {
				t.Fatalf("For(%q) returned an authentication-only requirement, want a workspace check", tt.path)
			}
			if req.Verb != "get" || req.Group != "kubeflow.org" || req.Resource != "workspaces" {
				t.Errorf("For(%q) = %+v, want get kubeflow.org/workspaces", tt.path, req)
			}
			if req.Namespace != tt.wantNamespace || req.Name != tt.wantName {
				t.Errorf("For(%q) scoped to %q/%q, want %q/%q",
					tt.path, req.Namespace, req.Name, tt.wantNamespace, tt.wantName)
			}
		})
	}
}

// TestForRejectsMalformedConnectPaths covers inputs that must never be resolved
// to a namespace and name, because doing so would let a caller aim the
// SubjectAccessReview at a different workspace than the one it reaches.
func TestForRejectsMalformedConnectPaths(t *testing.T) {
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
			req, err := For(path)
			if !errors.Is(err, ErrMalformedPath) {
				t.Fatalf("For(%q) = (%+v, %v), want ErrMalformedPath", path, req, err)
			}
		})
	}
}
