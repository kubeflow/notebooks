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

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	storagev1 "k8s.io/api/storage/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

// resourceGVRMap maps resource policy resources to their API group and version.
var resourceGVRMap = map[ResourcePolicyResource]schema.GroupVersionResource{
	Namespaces:             corev1.SchemeGroupVersion.WithResource(string(Namespaces)),
	PersistentVolumeClaims: corev1.SchemeGroupVersion.WithResource(string(PersistentVolumeClaims)),
	Secrets:                corev1.SchemeGroupVersion.WithResource(string(Secrets)),
	StorageClasses:         storagev1.SchemeGroupVersion.WithResource(string(StorageClasses)),
	WorkspaceKinds:         kubefloworgv1beta1.GroupVersion.WithResource(string(WorkspaceKinds)),
	Workspaces:             kubefloworgv1beta1.GroupVersion.WithResource(string(Workspaces)),
}

// NewResourcePolicy returns a resource policy for the given verb and resource type.
func NewResourcePolicy(verb ResourcePolicyVerb, resource ResourcePolicyResource, resourceMeta ResourcePolicyResourceMeta) *ResourcePolicy {
	gvr, ok := resourceGVRMap[resource]
	if !ok {
		// this should never happen unless we forgot to update the map
		panic(fmt.Sprintf("unsupported ResourcePolicyResource: %s", resource))
	}

	policy := &ResourcePolicy{
		Verb:         verb,
		GVR:          gvr,
		ResourceMeta: resourceMeta,
	}

	return policy
}

type ResourcePolicy struct {
	Verb         ResourcePolicyVerb
	GVR          schema.GroupVersionResource
	ResourceMeta ResourcePolicyResourceMeta
}

// AttributesFor returns an authorizer.Attributes which could be used with an authorizer.Authorizer to authorize the user for the resource policy.
func (p *ResourcePolicy) AttributesFor(u user.Info) authorizer.Attributes {
	return authorizer.AttributesRecord{
		User:            u,
		Verb:            string(p.Verb),
		Namespace:       p.ResourceMeta.Namespace,
		APIGroup:        p.GVR.Group,
		APIVersion:      p.GVR.Version,
		Resource:        p.GVR.Resource,
		Subresource:     "", // not currently used
		Name:            p.ResourceMeta.Name,
		ResourceRequest: true,
	}
}

// ResourcePolicyVerb are the verbs available for resource policies.
// Corresponds to the verbs of a SubjectAccessReview:
// https://github.com/kubernetes/kubernetes/blob/v1.35.0/pkg/apis/authorization/types.go#L78-L79
type ResourcePolicyVerb string

const (
	VerbCreate ResourcePolicyVerb = "create"
	VerbDelete ResourcePolicyVerb = "delete"
	VerbGet    ResourcePolicyVerb = "get"
	VerbList   ResourcePolicyVerb = "list"
	VerbPatch  ResourcePolicyVerb = "patch"
	VerbUpdate ResourcePolicyVerb = "update"
)

// ResourcePolicyResource are the resource types (kinds) available for resource policies.
type ResourcePolicyResource string

const (
	//
	// WARNING: these MUST be the "plural" form of the resource name because
	//          URLs of Kubernetes APIs are structured as: /apis/<group>/<version>/<plural>
	//

	Namespaces             ResourcePolicyResource = "namespaces"
	PersistentVolumeClaims ResourcePolicyResource = "persistentvolumeclaims"
	Secrets                ResourcePolicyResource = "secrets"
	StorageClasses         ResourcePolicyResource = "storageclasses"
	WorkspaceKinds         ResourcePolicyResource = "workspacekinds"
	Workspaces             ResourcePolicyResource = "workspaces"
)

// ResourcePolicyResourceMeta selects specific resources based on their object metadata.
type ResourcePolicyResourceMeta struct {
	// Namespace is the namespace of the resource which the action will be performed on.
	// "" (empty) is the only valid value for cluster-scoped resources
	// "" (empty) means the caller must be authorized to perform the action in all namespaces.
	Namespace string

	// Name is the name of the resource which the action will be performed on.
	// "" (empty) means the caller must be authorized to perform the action on all resources of this type.
	Name string
}
