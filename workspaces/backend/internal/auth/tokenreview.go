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
	"context"
	"fmt"
	"time"

	authenticationv1 "k8s.io/api/authentication/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/token/cache"
	"k8s.io/apiserver/pkg/authentication/user"
	authenticationv1client "k8s.io/client-go/kubernetes/typed/authentication/v1"
	"k8s.io/client-go/rest"
)

const (
	tokenSuccessCacheTTL = 10 * time.Second
	tokenFailureCacheTTL = 10 * time.Second
)

// NewTokenReviewAuthenticator returns an authenticator that validates bearer
// tokens by asking the API server to review them.
//
// This makes the backend agree with the API server about who the caller is,
// which is what gives the SubjectAccessReview results their meaning: the
// username being authorized is the same one an administrator names in a
// RoleBinding. It also removes the need to trust whatever set the identity
// headers.
func NewTokenReviewAuthenticator(restConfig *rest.Config, audiences []string) (authenticator.Token, error) {
	client, err := authenticationv1client.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create authentication client: %w", err)
	}

	tokenAuthenticator := &tokenReviewAuthenticator{
		client:    client.TokenReviews(),
		audiences: audiences,
	}

	return cache.New(tokenAuthenticator, false, tokenSuccessCacheTTL, tokenFailureCacheTTL), nil
}

type tokenReviewAuthenticator struct {
	client    authenticationv1client.TokenReviewInterface
	audiences []string
}

func (a *tokenReviewAuthenticator) AuthenticateToken(ctx context.Context, token string) (*authenticator.Response, bool, error) {
	review := &authenticationv1.TokenReview{
		Spec: authenticationv1.TokenReviewSpec{
			Token:     token,
			Audiences: a.audiences,
		},
	}

	result, err := a.client.Create(ctx, review, metav1.CreateOptions{})
	if err != nil {
		// Surfaced as an error rather than a rejection so that an unreachable
		// API server cannot be mistaken for a bad token.
		return nil, false, fmt.Errorf("failed to create TokenReview: %w", err)
	}

	if !result.Status.Authenticated {
		return nil, false, nil
	}

	extra := make(map[string][]string, len(result.Status.User.Extra))
	for key, values := range result.Status.User.Extra {
		extra[key] = values
	}

	return &authenticator.Response{
		User: &user.DefaultInfo{
			Name:   result.Status.User.Username,
			UID:    result.Status.User.UID,
			Groups: result.Status.User.Groups,
			Extra:  extra,
		},
		Audiences: authenticator.Audiences(result.Status.Audiences),
	}, true, nil
}
