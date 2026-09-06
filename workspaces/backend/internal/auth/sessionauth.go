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
	"net/url"
	"strings"
	"time"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/user"
)

const (
	sessionAuthTimeout = 10 * time.Second

	// Response headers of the auth_request contract, set by oauth2-proxy with
	// --set-xauthrequest and --set-authorization-header.
	sessionEmailHeader  = "X-Auth-Request-Email"
	sessionGroupsHeader = "X-Auth-Request-Groups"
)

// SessionAuthenticator resolves a browser session cookie by delegating to an
// OIDC proxy's auth-check endpoint, such as oauth2-proxy's /oauth2/auth.
//
// The proxy owns the session: the backend cannot read its encrypted cookie, and
// should not learn how to. Forwarding the cookie to the check endpoint and
// consuming the response headers is the auth_request contract that nginx and
// Envoy already speak; the caller being an application changes nothing on the
// wire.
type SessionAuthenticator struct {
	authURL    string
	cookieName string

	// tokenAuthenticator, when non-nil, revalidates the bearer token returned
	// by the proxy, anchoring the identity in the API server. When nil, the
	// identity headers of the response are used: they come from this service's
	// own outbound call to a configured endpoint, not from the client, so
	// trusting them is trusting the proxy itself.
	tokenAuthenticator authenticator.Token

	client *http.Client
}

// NewSessionAuthenticator returns a SessionAuthenticator for the given
// auth-check URL and session cookie name.
func NewSessionAuthenticator(authURL string, cookieName string, tokenAuthenticator authenticator.Token) (*SessionAuthenticator, error) {
	parsedURL, err := url.Parse(authURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse session auth URL %q: %w", authURL, err)
	}
	if parsedURL.Scheme == "" || parsedURL.Host == "" {
		return nil, fmt.Errorf("session auth URL %q must be absolute", authURL)
	}
	if cookieName == "" {
		return nil, fmt.Errorf("session cookie name must not be empty")
	}

	return &SessionAuthenticator{
		authURL:            authURL,
		cookieName:         cookieName,
		tokenAuthenticator: tokenAuthenticator,
		client:             &http.Client{Timeout: sessionAuthTimeout},
	}, nil
}

// HasSessionCookie reports whether the request carries the proxy's session
// cookie. The composing authenticator uses this to route the request here, so
// that a request with a session that fails resolution is never silently
// downgraded to header authentication.
func (s *SessionAuthenticator) HasSessionCookie(req *http.Request) bool {
	_, err := req.Cookie(s.cookieName)
	return err == nil
}

// AuthenticateRequest implements authenticator.Request.
func (s *SessionAuthenticator) AuthenticateRequest(req *http.Request) (*authenticator.Response, bool, error) {
	// The URL is operator configuration validated at construction, not
	// request-derived input, so this is not a server-side request forgery.
	checkReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet, s.authURL, http.NoBody) //nolint:gosec
	if err != nil {
		return nil, false, fmt.Errorf("failed to build session auth request: %w", err)
	}
	// The cookie is the credential; nothing else from the client request is
	// forwarded, so a client cannot influence the check through other headers.
	for _, cookie := range req.Cookies() {
		checkReq.AddCookie(cookie)
	}

	resp, err := s.client.Do(checkReq) //nolint:gosec // the URL is operator configuration, see above
	if err != nil {
		// Surfaced as an error so an unreachable proxy fails closed as a 5xx,
		// distinguishable from an unauthenticated request.
		return nil, false, fmt.Errorf("failed to check session with auth proxy: %w", err)
	}
	defer resp.Body.Close() //nolint:errcheck

	// The auth_request contract: 2xx is authenticated, anything else is not.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, false, nil
	}

	if s.tokenAuthenticator != nil {
		token, ok := bearerFromHeader(resp.Header.Get("Authorization"))
		if !ok {
			return nil, false, fmt.Errorf("session auth response carried no bearer token to review; is the proxy running with --set-authorization-header?")
		}
		return s.tokenAuthenticator.AuthenticateToken(req.Context(), token)
	}

	email := resp.Header.Get(sessionEmailHeader)
	if email == "" {
		return nil, false, fmt.Errorf("session auth response carried no %s header; is the proxy running with --set-xauthrequest?", sessionEmailHeader)
	}

	// oauth2-proxy sends groups as a single comma-separated header value.
	var groups []string
	for group := range strings.SplitSeq(resp.Header.Get(sessionGroupsHeader), ",") {
		if group = strings.TrimSpace(group); group != "" {
			groups = append(groups, group)
		}
	}

	return &authenticator.Response{
		User: &user.DefaultInfo{
			Name:   email,
			Groups: groups,
		},
	}, true, nil
}

func bearerFromHeader(value string) (string, bool) {
	scheme, token, found := strings.Cut(value, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	token = strings.TrimSpace(token)
	return token, token != ""
}
