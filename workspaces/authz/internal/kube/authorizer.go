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

// Package kube builds the Kubernetes clients this service depends on.
package kube

import (
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/authorization/authorizerfactory"
	authorizationv1 "k8s.io/client-go/kubernetes/typed/authorization/v1"
	"k8s.io/client-go/rest"
)

const (
	allowCacheTTL = 10 * time.Second
	denyCacheTTL  = 10 * time.Second
)

// NewAuthorizer returns an authorizer that delegates decisions to the API
// server via SubjectAccessReview, matching the backend's behaviour so that both
// components agree on what a user may do.
func NewAuthorizer(restConfig *rest.Config) (authorizer.Authorizer, error) {
	client, err := authorizationv1.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("creating authorization client: %w", err)
	}

	config := authorizerfactory.DelegatingAuthorizerConfig{
		SubjectAccessReviewClient: client,
		AllowCacheTTL:             allowCacheTTL,
		DenyCacheTTL:              denyCacheTTL,
		WebhookRetryBackoff: &wait.Backoff{
			Duration: 500 * time.Millisecond,
			Factor:   1.5,
			Jitter:   0.2,
			Steps:    5,
		},
	}

	delegating, err := config.New()
	if err != nil {
		return nil, fmt.Errorf("creating authorizer: %w", err)
	}
	return delegating, nil
}
