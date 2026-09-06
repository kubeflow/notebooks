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
	"net/http/httptest"
	"testing"
)

const (
	testSessionCookie = "_oauth2_proxy"
	testSessionValue  = "valid-session"
)

// fakeAuthProxy imitates oauth2-proxy's /oauth2/auth endpoint: a valid session
// cookie yields 202 with identity headers and a bearer token, anything else 401.
func fakeAuthProxy(t *testing.T) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(testSessionCookie)
		if err != nil || cookie.Value != testSessionValue {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("X-Auth-Request-Email", "ana@example.com")
		w.Header().Set("X-Auth-Request-Groups", "team-a,team-b")
		w.Header().Set("Authorization", "Bearer proxy-id-token")
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(server.Close)
	return server
}

func newSessionRequest(cookieValue string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/authz/workspace/connect/ns/ws/lab/", http.NoBody)
	if cookieValue != "" {
		req.AddCookie(&http.Cookie{Name: testSessionCookie, Value: cookieValue})
	}
	return req
}

func TestSessionAuthenticatorResolvesCookieViaProxy(t *testing.T) {
	proxy := fakeAuthProxy(t)
	sessionAuth, err := NewSessionAuthenticator(proxy.URL, testSessionCookie, nil)
	if err != nil {
		t.Fatalf("NewSessionAuthenticator returned unexpected error: %v", err)
	}

	response, ok, err := sessionAuth.AuthenticateRequest(newSessionRequest(testSessionValue))
	if err != nil || !ok {
		t.Fatalf("AuthenticateRequest = (%v, %v, %v), want an authenticated response", response, ok, err)
	}
	if got := response.User.GetName(); got != "ana@example.com" {
		t.Errorf("username = %q, want ana@example.com", got)
	}
	if got := response.User.GetGroups(); len(got) != 2 || got[0] != "team-a" || got[1] != "team-b" {
		t.Errorf("groups = %v, want [team-a team-b]", got)
	}
}

func TestSessionAuthenticatorReviewsProxyToken(t *testing.T) {
	proxy := fakeAuthProxy(t)
	tokenAuthenticator := &fakeTokenAuthenticator{validToken: "proxy-id-token", username: "reviewed@example.com"}
	sessionAuth, err := NewSessionAuthenticator(proxy.URL, testSessionCookie, tokenAuthenticator)
	if err != nil {
		t.Fatalf("NewSessionAuthenticator returned unexpected error: %v", err)
	}

	response, ok, err := sessionAuth.AuthenticateRequest(newSessionRequest(testSessionValue))
	if err != nil || !ok {
		t.Fatalf("AuthenticateRequest = (%v, %v, %v), want an authenticated response", response, ok, err)
	}
	if got := response.User.GetName(); got != "reviewed@example.com" {
		t.Errorf("username = %q, want the TokenReview identity reviewed@example.com, not the header identity", got)
	}
}

func TestSessionAuthenticatorRejectsInvalidSession(t *testing.T) {
	proxy := fakeAuthProxy(t)
	sessionAuth, err := NewSessionAuthenticator(proxy.URL, testSessionCookie, nil)
	if err != nil {
		t.Fatalf("NewSessionAuthenticator returned unexpected error: %v", err)
	}

	response, ok, err := sessionAuth.AuthenticateRequest(newSessionRequest("forged-session"))
	if err != nil {
		t.Fatalf("AuthenticateRequest returned unexpected error: %v", err)
	}
	if ok {
		t.Fatalf("AuthenticateRequest authenticated %q from an invalid session", response.User.GetName())
	}
}

func TestSessionAuthenticatorFailsClosedWhenProxyUnreachable(t *testing.T) {
	proxy := fakeAuthProxy(t)
	proxyURL := proxy.URL
	proxy.Close()

	sessionAuth, err := NewSessionAuthenticator(proxyURL, testSessionCookie, nil)
	if err != nil {
		t.Fatalf("NewSessionAuthenticator returned unexpected error: %v", err)
	}

	_, ok, err := sessionAuth.AuthenticateRequest(newSessionRequest(testSessionValue))
	if ok {
		t.Fatal("AuthenticateRequest authenticated a session despite the proxy being unreachable")
	}
	if err == nil {
		t.Error("AuthenticateRequest returned no error, want the proxy failure surfaced for a fail-closed 5xx")
	}
}

// TestSessionAuthenticatorRequiresTokenWhenReviewEnabled guards the mixed
// configuration: with TokenReview enabled, a proxy that does not return the ID
// token must not be silently trusted via its identity headers.
func TestSessionAuthenticatorRequiresTokenWhenReviewEnabled(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("X-Auth-Request-Email", "ana@example.com")
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(server.Close)

	tokenAuthenticator := &fakeTokenAuthenticator{validToken: "proxy-id-token", username: "reviewed@example.com"}
	sessionAuth, err := NewSessionAuthenticator(server.URL, testSessionCookie, tokenAuthenticator)
	if err != nil {
		t.Fatalf("NewSessionAuthenticator returned unexpected error: %v", err)
	}

	_, ok, err := sessionAuth.AuthenticateRequest(newSessionRequest(testSessionValue))
	if ok {
		t.Fatal("AuthenticateRequest trusted identity headers despite TokenReview being enabled and no token returned")
	}
	if err == nil {
		t.Error("AuthenticateRequest returned no error, want a misconfiguration error")
	}
}

// TestAuthenticateSessionDoesNotFallBackToHeaders is the composition guard: a
// request carrying a session cookie that fails resolution must not be
// authenticated by an identity header it controls.
func TestAuthenticateSessionDoesNotFallBackToHeaders(t *testing.T) {
	proxy := fakeAuthProxy(t)
	sessionAuth, err := NewSessionAuthenticator(proxy.URL, testSessionCookie, nil)
	if err != nil {
		t.Fatalf("NewSessionAuthenticator returned unexpected error: %v", err)
	}
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, "", testGroupsHeader, nil, sessionAuth)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	req := newSessionRequest("forged-session")
	req.Header.Set(testUserIDHeader, "admin@example.com")

	response, ok, _ := requestAuthenticator.AuthenticateRequest(req)
	if ok {
		t.Fatalf("AuthenticateRequest authenticated %q from a header despite an invalid session cookie",
			response.User.GetName())
	}
}

// TestAuthenticateSessionPrecedence: bearer beats session, session beats
// headers, and headers still work when neither credential is present.
func TestAuthenticateSessionPrecedence(t *testing.T) {
	proxy := fakeAuthProxy(t)
	tokenAuthenticator := &fakeTokenAuthenticator{validToken: "client-token", username: "token-user@example.com"}
	sessionAuth, err := NewSessionAuthenticator(proxy.URL, testSessionCookie, nil)
	if err != nil {
		t.Fatalf("NewSessionAuthenticator returned unexpected error: %v", err)
	}
	requestAuthenticator, err := NewRequestAuthenticator(testUserIDHeader, "", testGroupsHeader, tokenAuthenticator, sessionAuth)
	if err != nil {
		t.Fatalf("NewRequestAuthenticator returned unexpected error: %v", err)
	}

	tests := []struct {
		name         string
		buildRequest func() *http.Request
		wantUser     string
	}{
		{
			name: "bearer token wins over session cookie",
			buildRequest: func() *http.Request {
				req := newSessionRequest(testSessionValue)
				req.Header.Set("Authorization", "Bearer client-token")
				return req
			},
			wantUser: "token-user@example.com",
		},
		{
			name: "session cookie wins over identity headers",
			buildRequest: func() *http.Request {
				req := newSessionRequest(testSessionValue)
				req.Header.Set(testUserIDHeader, "admin@example.com")
				return req
			},
			wantUser: "ana@example.com",
		},
		{
			name: "identity headers used when no credential is present",
			buildRequest: func() *http.Request {
				req := newSessionRequest("")
				req.Header.Set(testUserIDHeader, "header-user@example.com")
				return req
			},
			wantUser: "header-user@example.com",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			response, ok, err := requestAuthenticator.AuthenticateRequest(tt.buildRequest())
			if err != nil || !ok {
				t.Fatalf("AuthenticateRequest = (%v, %v, %v), want an authenticated response", response, ok, err)
			}
			if got := response.User.GetName(); got != tt.wantUser {
				t.Errorf("username = %q, want %q", got, tt.wantUser)
			}
		})
	}
}

func TestNewSessionAuthenticatorRejectsInvalidConfig(t *testing.T) {
	if _, err := NewSessionAuthenticator("not-a-url", testSessionCookie, nil); err == nil {
		t.Error("NewSessionAuthenticator accepted a relative URL")
	}
	if _, err := NewSessionAuthenticator("http://proxy/oauth2/auth", "", nil); err == nil {
		t.Error("NewSessionAuthenticator accepted an empty cookie name")
	}
}
