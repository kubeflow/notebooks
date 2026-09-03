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
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"
)

const (
	testUserIDHeader = "kubeflow-userid"
	testGroupsHeader = "kubeflow-groups"
)

type fakeTokenAuthenticator struct {
	validToken string
	username   string
	err        error
}

func (f *fakeTokenAuthenticator) AuthenticateToken(_ context.Context, token string) (*authenticator.Response, bool, error) {
	if f.err != nil {
		return nil, false, f.err
	}
	if token != f.validToken {
		return nil, false, nil
	}
	return &authenticator.Response{User: &user.DefaultInfo{Name: f.username}}, true, nil
}

func newTestRequest(headers map[string]string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/workspaces", http.NoBody)
	for name, value := range headers {
		req.Header.Set(name, value)
	}
	return req
}

func TestAuthenticateWithHeadersOnly(t *testing.T) {
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, "", testGroupsHeader, nil)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	response, ok, err := requestAuthenticator.AuthenticateRequest(newTestRequest(map[string]string{
		testUserIDHeader: "ana@example.com",
	}))
	if err != nil || !ok {
		t.Fatalf("AuthenticateRequest = (%v, %v, %v), want an authenticated response", response, ok, err)
	}
	if got := response.User.GetName(); got != "ana@example.com" {
		t.Errorf("username = %q, want ana@example.com", got)
	}
}

func TestAuthenticateTrimsUserIDPrefix(t *testing.T) {
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, ":", testGroupsHeader, nil)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	response, ok, err := requestAuthenticator.AuthenticateRequest(newTestRequest(map[string]string{
		testUserIDHeader: ":ana@example.com",
	}))
	if err != nil || !ok {
		t.Fatalf("AuthenticateRequest = (%v, %v, %v), want an authenticated response", response, ok, err)
	}
	if got := response.User.GetName(); got != "ana@example.com" {
		t.Errorf("username = %q, want ana@example.com", got)
	}
}

func TestAuthenticateBearerTokenTakesPrecedence(t *testing.T) {
	tokenAuthenticator := &fakeTokenAuthenticator{validToken: "good-token", username: "ana@example.com"}
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, "", testGroupsHeader, tokenAuthenticator)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	response, ok, err := requestAuthenticator.AuthenticateRequest(newTestRequest(map[string]string{
		"Authorization":  "Bearer good-token",
		testUserIDHeader: "admin@example.com",
	}))
	if err != nil || !ok {
		t.Fatalf("AuthenticateRequest = (%v, %v, %v), want an authenticated response", response, ok, err)
	}
	if got := response.User.GetName(); got != "ana@example.com" {
		t.Errorf("username = %q, want the token identity ana@example.com, not the header identity", got)
	}
}

// TestAuthenticateRejectsBadTokenWithoutFallingBackToHeaders is the reason
// bearer tokens are handled separately from the header authenticator: a caller
// must not be able to present a token that fails review and still be
// authenticated by a header it controls.
func TestAuthenticateRejectsBadTokenWithoutFallingBackToHeaders(t *testing.T) {
	tokenAuthenticator := &fakeTokenAuthenticator{validToken: "good-token", username: "ana@example.com"}
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, "", testGroupsHeader, tokenAuthenticator)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	response, ok, _ := requestAuthenticator.AuthenticateRequest(newTestRequest(map[string]string{
		"Authorization":  "Bearer forged-token",
		testUserIDHeader: "admin@example.com",
	}))
	if ok {
		t.Fatalf("AuthenticateRequest authenticated %q from a header despite an invalid bearer token",
			response.User.GetName())
	}
}

func TestAuthenticateSurfacesTokenReviewErrors(t *testing.T) {
	tokenAuthenticator := &fakeTokenAuthenticator{err: errors.New("api server unreachable")}
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, "", testGroupsHeader, tokenAuthenticator)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	_, ok, err := requestAuthenticator.AuthenticateRequest(newTestRequest(map[string]string{
		"Authorization": "Bearer any-token",
	}))
	if ok {
		t.Fatal("AuthenticateRequest authenticated a request despite a TokenReview error")
	}
	if err == nil {
		t.Error("AuthenticateRequest returned no error, want the TokenReview failure surfaced")
	}
}

func TestAuthenticateFallsBackToHeadersWithoutBearerToken(t *testing.T) {
	tokenAuthenticator := &fakeTokenAuthenticator{validToken: "good-token", username: "ana@example.com"}
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, "", testGroupsHeader, tokenAuthenticator)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	for _, authorization := range []string{"", "Basic dXNlcjpwYXNz", "Bearer "} {
		headers := map[string]string{testUserIDHeader: "ana@example.com"}
		if authorization != "" {
			headers["Authorization"] = authorization
		}

		response, ok, err := requestAuthenticator.AuthenticateRequest(newTestRequest(headers))
		if err != nil || !ok {
			t.Fatalf("Authorization %q: AuthenticateRequest = (%v, %v, %v), want the header identity",
				authorization, response, ok, err)
		}
		if got := response.User.GetName(); got != "ana@example.com" {
			t.Errorf("Authorization %q: username = %q, want ana@example.com", authorization, got)
		}
	}
}
