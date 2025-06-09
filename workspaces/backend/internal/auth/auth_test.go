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
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authentication/user"
)

func TestNewRequestAuthenticator(t *testing.T) {
	const (
		userHeader   = "X-User"
		groupsHeader = "X-Groups"
		userPrefix   = "service-account:"
	)

	t.Run("should authenticate user without prefix", func(t *testing.T) {
		// Create an authenticator with an empty prefix
		authn, err := NewRequestAuthenticator(userHeader, "", groupsHeader)
		require.NoError(t, err)

		// Create a request with user and group headers
		req, _ := http.NewRequest("GET", "/", http.NoBody)
		req.Header.Set(userHeader, "test-user")
		req.Header.Set(groupsHeader, "group-a,group-b")

		// Authenticate the request
		resp, ok, err := authn.AuthenticateRequest(req)

		// Assert the results
		assert.NoError(t, err)
		assert.True(t, ok)
		require.NotNil(t, resp)
		assert.Equal(t, "test-user", resp.User.GetName())
		assert.ElementsMatch(t, []string{"group-a,group-b"}, resp.User.GetGroups())
	})

	t.Run("should authenticate user and trim prefix", func(t *testing.T) {
		// Create an authenticator with a prefix
		authn, err := NewRequestAuthenticator(userHeader, userPrefix, groupsHeader)
		require.NoError(t, err)

		// Create a request where the user header has the prefix
		req, _ := http.NewRequest("GET", "/", http.NoBody)
		req.Header.Set(userHeader, userPrefix+"test-user")
		req.Header.Set(groupsHeader, "group-c")

		// Authenticate the request
		resp, ok, err := authn.AuthenticateRequest(req)

		// Assert the results
		assert.NoError(t, err)
		assert.True(t, ok)
		require.NotNil(t, resp)
		// The key assertion: the prefix should be trimmed
		assert.Equal(t, "test-user", resp.User.GetName())
		assert.Equal(t, []string{"group-c"}, resp.User.GetGroups())
	})

	t.Run("should authenticate user when prefix is configured but not present", func(t *testing.T) {
		// Create an authenticator with a prefix
		authn, err := NewRequestAuthenticator(userHeader, userPrefix, groupsHeader)
		require.NoError(t, err)

		// Create a request where the user header does NOT have the prefix
		req, _ := http.NewRequest("GET", "/", http.NoBody)
		req.Header.Set(userHeader, "another-user")

		// Authenticate the request
		resp, ok, err := authn.AuthenticateRequest(req)

		// Assert the results
		assert.NoError(t, err)
		assert.True(t, ok)
		require.NotNil(t, resp)
		// The username should be unchanged
		assert.Equal(t, "another-user", resp.User.GetName())
	})

	t.Run("should handle unauthenticated request", func(t *testing.T) {
		// Create an authenticator
		authn, err := NewRequestAuthenticator(userHeader, userPrefix, groupsHeader)
		require.NoError(t, err)

		// Create a request WITHOUT the required user header
		req, _ := http.NewRequest("GET", "/", http.NoBody)
		req.Header.Set(groupsHeader, "some-group")

		// Authenticate the request
		resp, ok, err := authn.AuthenticateRequest(req)

		// Assert the results
		assert.NoError(t, err)
		// The key assertion: ok should be false for an unauthenticated request
		assert.False(t, ok)
		assert.Nil(t, resp)
	})
}

// mockObject is a helper struct that implements client.Object for testing.
// It allows us to create fake Kubernetes objects to pass to our functions.
type mockObject struct {
	metav1.ObjectMeta
	metav1.TypeMeta
}

// GetObjectKind is required to implement the runtime.Object interface.
func (m *mockObject) GetObjectKind() schema.ObjectKind { return &m.TypeMeta }

// DeepCopyObject is required to implement the runtime.Object interface.
func (m *mockObject) DeepCopyObject() runtime.Object {
	return &mockObject{
		ObjectMeta: *m.ObjectMeta.DeepCopy(),
		TypeMeta:   m.TypeMeta,
	}
}

func TestNewResourcePolicy(t *testing.T) {
	t.Run("should create policy for a namespaced resource", func(t *testing.T) {
		// Arrange: Create a mock namespaced object
		mock := &mockObject{}
		mock.SetName("my-deployment")
		mock.SetNamespace("my-namespace")
		mock.SetGroupVersionKind(schema.GroupVersionKind{
			Group:   "apps",
			Version: "v1",
			Kind:    "Deployment",
		})

		// Act: Create the policy
		policy := NewResourcePolicy(ResourceVerbGet, mock)

		// Assert: Verify the policy fields are correct
		require.NotNil(t, policy)
		assert.Equal(t, ResourceVerbGet, policy.Verb)
		assert.Equal(t, "apps", policy.Group)
		assert.Equal(t, "v1", policy.Version)
		assert.Equal(t, "Deployment", policy.Kind)
		assert.Equal(t, "my-namespace", policy.Namespace)
		assert.Equal(t, "my-deployment", policy.Name)
	})

	t.Run("should create policy for a cluster-scoped resource", func(t *testing.T) {
		// Arrange: Create a mock cluster-scoped object (no namespace)
		mock := &mockObject{}
		mock.SetName("my-cluster-role")
		mock.SetGroupVersionKind(schema.GroupVersionKind{
			Group:   "rbac.authorization.k8s.io",
			Version: "v1",
			Kind:    "ClusterRole",
		})

		// Act: Create the policy
		policy := NewResourcePolicy(ResourceVerbDelete, mock)

		// Assert: Verify the policy fields, ensuring namespace is empty
		require.NotNil(t, policy)
		assert.Equal(t, ResourceVerbDelete, policy.Verb)
		assert.Equal(t, "rbac.authorization.k8s.io", policy.Group)
		assert.Equal(t, "ClusterRole", policy.Kind)
		assert.Equal(t, "my-cluster-role", policy.Name)
		assert.Empty(t, policy.Namespace, "Namespace should be empty for cluster-scoped resources")
	})
}

func TestAttributesFor(t *testing.T) {
	userInfo := &user.DefaultInfo{
		Name:   "test-user",
		Groups: []string{"group-a", "system:authenticated"},
	}

	t.Run("should create attributes for a specific resource", func(t *testing.T) {
		// Arrange: Create a policy for a specific resource
		policy := &ResourcePolicy{
			Verb:      ResourceVerbUpdate,
			Group:     "kubeflow.org",
			Version:   "v1beta1",
			Kind:      "Workspace",
			Namespace: "user-namespace",
			Name:      "my-workspace",
		}

		// Act: Generate attributes from the policy
		attrs := policy.AttributesFor(userInfo)

		// Assert: Verify all attributes are correctly set
		require.NotNil(t, attrs)
		assert.Equal(t, userInfo, attrs.GetUser())
		assert.Equal(t, "update", attrs.GetVerb())
		assert.Equal(t, "user-namespace", attrs.GetNamespace())
		assert.Equal(t, "kubeflow.org", attrs.GetAPIGroup())
		assert.Equal(t, "v1beta1", attrs.GetAPIVersion())
		assert.Equal(t, "Workspace", attrs.GetResource())
		assert.Equal(t, "my-workspace", attrs.GetName())
		assert.True(t, attrs.IsResourceRequest())
	})

	t.Run("should create attributes for a collection of resources", func(t *testing.T) {
		// Arrange: Create a policy for a 'list' operation, which doesn't have a specific name
		policy := &ResourcePolicy{
			Verb:      ResourceVerbList,
			Group:     "kubeflow.org",
			Version:   "v1beta1",
			Kind:      "Workspace",
			Namespace: "user-namespace",
			Name:      "", // Name is empty for list operations
		}

		// Act: Generate attributes
		attrs := policy.AttributesFor(userInfo)

		// Assert: Verify attributes, ensuring name is empty
		require.NotNil(t, attrs)
		assert.Equal(t, userInfo, attrs.GetUser())
		assert.Equal(t, "list", attrs.GetVerb())
		assert.Equal(t, "user-namespace", attrs.GetNamespace())
		assert.Empty(t, attrs.GetName(), "Name should be empty for a list verb")
		assert.True(t, attrs.IsResourceRequest())
	})
}
