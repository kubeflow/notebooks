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

// NewRequestAuthorizer returns a new request authorizer based on the provided configuration.
func NewRequestAuthorizer(restConfig *rest.Config, httpClient *http.Client) (authorizer.Authorizer, error) {
	authorizationV1Client, err := authorizationv1.NewForConfigAndClient(restConfig, httpClient)
	if err != nil {
		return nil, err
	}

	authorizerConfig := authorizerfactory.DelegatingAuthorizerConfig{
		SubjectAccessReviewClient: authorizationV1Client,
		AllowCacheTTL:             allowCacheTTL,
		DenyCacheTTL:              denyCacheTTL,
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
