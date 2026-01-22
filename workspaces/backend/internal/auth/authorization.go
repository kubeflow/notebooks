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
	"fmt"
	"net/http"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizerfactory"
	authorizationv1 "k8s.io/client-go/kubernetes/typed/authorization/v1"
	"k8s.io/client-go/rest"
)

const (
	allowCacheTTL = 10 * time.Second
	denyCacheTTL  = 10 * time.Second
)

// NewRequestAuthorizer returns a new request authorizer based on the provided configuration.
// loosely based on `WithAuthenticationAndAuthorization` from: https://github.com/kubernetes-sigs/controller-runtime/blob/v0.20.1/pkg/metrics/filters/filters.go#L36-L122
func NewRequestAuthorizer(restConfig *rest.Config, httpClient *http.Client) (authorizer.Authorizer, error) {
	authorizationV1Client, err := authorizationv1.NewForConfigAndClient(restConfig, httpClient)
	if err != nil {
		return nil, err
	}

	authorizerConfig := authorizerfactory.DelegatingAuthorizerConfig{
		SubjectAccessReviewClient: authorizationV1Client,

		// AllowCacheTTL is the length of time that a successful authorization response will be cached
		AllowCacheTTL: allowCacheTTL,

		// DenyCacheTTL is the length of time that a denied authorization response will be cached
		DenyCacheTTL: denyCacheTTL,

		// wait.Backoff is copied from: https://github.com/kubernetes/apiserver/blob/v0.29.0/pkg/server/options/authentication.go#L43-L50
		// options.DefaultAuthWebhookRetryBackoff is not used to avoid a dependency on "k8s.io/apiserver/pkg/server/options".
		WebhookRetryBackoff: &wait.Backoff{
			Duration: 500 * time.Millisecond,
			Factor:   1.5,
			Jitter:   0.2,
			Steps:    5,
		},
	}

	delegatingAuthorizer, err := authorizerConfig.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create authorizer: %w", err)
	}

	return delegatingAuthorizer, nil
}

type ResourcePolicy struct {
	Verb ResourceVerb

	Group    string
	Version  string
	Resource string

	Namespace string
	Name      string
}

// ResourcePolicyResource is a string enum for the resource types used in resource policies.
type ResourcePolicyResource string

const (
	ResourcePolicyResourceWorkspaces     ResourcePolicyResource = "workspaces"
	ResourcePolicyResourceWorkspaceKinds ResourcePolicyResource = "workspacekinds"
	ResourcePolicyResourceSecrets        ResourcePolicyResource = "secrets"
	ResourcePolicyResourceNamespaces     ResourcePolicyResource = "namespaces"
)

// resourceGVMap maps resource policy resources to their API group and version.
var resourceGVMap = map[ResourcePolicyResource]struct{ Group, Version string }{
	ResourcePolicyResourceWorkspaces:     {Group: "kubeflow.org", Version: "v1beta1"},
	ResourcePolicyResourceWorkspaceKinds: {Group: "kubeflow.org", Version: "v1beta1"},
	ResourcePolicyResourceSecrets:        {Group: "", Version: "v1"},
	ResourcePolicyResourceNamespaces:     {Group: "", Version: "v1"},
}

// NewResourcePolicy returns a resource policy for the given verb and resource type.
// Optional scope is passed via meta; use &metav1.ObjectMeta{} or nil for list/create or cluster-scoped resources.
// Group and version are resolved from a hardcoded lookup map.
func NewResourcePolicy(verb ResourceVerb, resource ResourcePolicyResource, meta *metav1.ObjectMeta) *ResourcePolicy {
	gv, ok := resourceGVMap[resource]
	if !ok {
		panic(fmt.Sprintf("NewResourcePolicy: unknown resource %q", resource))
	}

	policy := &ResourcePolicy{
		Verb:     verb,
		Group:    gv.Group,
		Version:  gv.Version,
		Resource: string(resource),
	}
	if meta != nil {
		if meta.Namespace != "" {
			policy.Namespace = meta.Namespace
		}
		if meta.Name != "" {
			policy.Name = meta.Name
		}
	}
	return policy
}

// AttributesFor returns an authorizer.Attributes which could be used with an authorizer.Authorizer to authorize the user for the resource policy.
func (p *ResourcePolicy) AttributesFor(u user.Info) authorizer.Attributes {
	return authorizer.AttributesRecord{
		User:            u,
		Verb:            string(p.Verb),
		Namespace:       p.Namespace,
		APIGroup:        p.Group,
		APIVersion:      p.Version,
		Resource:        p.Resource,
		Name:            p.Name,
		ResourceRequest: true,
	}
}

// ResourceVerb represents a verb for an action on a resource.
type ResourceVerb string

const (
	ResourceVerbCreate ResourceVerb = "create"
	ResourceVerbGet    ResourceVerb = "get"
	ResourceVerbList   ResourceVerb = "list"
	ResourceVerbUpdate ResourceVerb = "update"
	ResourceVerbPatch  ResourceVerb = "patch"
	ResourceVerbDelete ResourceVerb = "delete"
)
