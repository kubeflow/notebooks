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

// Package oidc authenticates callers against an OIDC issuer.
//
// The claims-to-username mapping mirrors the Kubernetes API server's OIDC
// options so that the identity this service authorizes with is the same
// identity the API server sees. That is what makes the SubjectAccessReview
// results, and therefore the RBAC bindings an administrator writes, meaningful.
package oidc

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	gooidc "github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
	"k8s.io/apiserver/pkg/authentication/user"

	"github.com/kubeflow/notebooks/workspaces/authz/internal/check"
)

// Config configures the OIDC relying party.
type Config struct {
	IssuerURL    string
	ClientID     string
	ClientSecret string
	// RedirectURL is the absolute URL of the callback endpoint, which must be
	// routed to this service and registered with the issuer.
	RedirectURL string
	Scopes      []string

	// UsernameClaim, UsernamePrefix, GroupsClaim and GroupsPrefix mirror the
	// Kubernetes API server's OIDC authentication options and MUST be set to the
	// same values as the cluster.
	UsernameClaim  string
	UsernamePrefix string
	GroupsClaim    string
	GroupsPrefix   string

	CookieName   string
	CookieKey    []byte
	CookieSecure bool
}

// Authenticator resolves an identity from a bearer token or a session cookie,
// and drives the authorization code flow when neither is present.
type Authenticator struct {
	cfg      Config
	verifier *gooidc.IDTokenVerifier
	oauth    *oauth2.Config
	codec    *sessionCodec
}

const stateCookieName = "kubeflow-workspaces-authz-state"

// New discovers the issuer's configuration and builds an Authenticator.
func New(ctx context.Context, cfg Config) (*Authenticator, error) {
	provider, err := gooidc.NewProvider(ctx, cfg.IssuerURL)
	if err != nil {
		return nil, fmt.Errorf("discovering OIDC issuer %q: %w", cfg.IssuerURL, err)
	}

	codec, err := newSessionCodec(cfg.CookieKey)
	if err != nil {
		return nil, err
	}

	scopes := cfg.Scopes
	if len(scopes) == 0 {
		scopes = []string{gooidc.ScopeOpenID, "profile", "email", gooidc.ScopeOfflineAccess}
	}

	return &Authenticator{
		cfg:      cfg,
		verifier: provider.Verifier(&gooidc.Config{ClientID: cfg.ClientID}),
		oauth: &oauth2.Config{
			ClientID:     cfg.ClientID,
			ClientSecret: cfg.ClientSecret,
			Endpoint:     provider.Endpoint(),
			RedirectURL:  cfg.RedirectURL,
			Scopes:       scopes,
		},
		codec: codec,
	}, nil
}

// Authenticate implements check.Authenticator.
func (a *Authenticator) Authenticate(ctx context.Context, r *check.Request) (*check.Identity, error) {
	if token, ok := bearerToken(r.Headers); ok {
		return a.identityFromToken(ctx, token)
	}

	cookie, err := cookieValue(r.Headers, a.cfg.CookieName)
	if err != nil {
		return nil, check.ErrNoCredentials
	}

	var sess session
	if err := a.codec.open(cookie, &sess); err != nil {
		// A cookie that cannot be opened is treated as absent so that a key
		// rotation logs users back in instead of locking them out.
		return nil, check.ErrNoCredentials
	}

	if sess.Expiry > 0 && time.Now().After(time.Unix(sess.Expiry, 0)) {
		refreshed, err := a.refresh(ctx, sess)
		if err != nil {
			return nil, check.ErrNoCredentials
		}
		sess = refreshed
	}

	return a.identityFromToken(ctx, sess.IDToken)
}

// identityFromToken verifies an ID token's signature, issuer, audience and
// expiry, then maps its claims onto a Kubernetes identity.
func (a *Authenticator) identityFromToken(ctx context.Context, rawToken string) (*check.Identity, error) {
	idToken, err := a.verifier.Verify(ctx, rawToken)
	if err != nil {
		return nil, check.ErrNoCredentials
	}

	claims := map[string]any{}
	if err := idToken.Claims(&claims); err != nil {
		return nil, fmt.Errorf("parsing ID token claims: %w", err)
	}

	username, err := stringClaim(claims, a.cfg.UsernameClaim)
	if err != nil {
		return nil, err
	}
	if username == "" {
		return nil, fmt.Errorf("ID token has empty %q claim", a.cfg.UsernameClaim)
	}

	groups, err := stringsClaim(claims, a.cfg.GroupsClaim)
	if err != nil {
		return nil, err
	}
	for i, group := range groups {
		groups[i] = a.cfg.GroupsPrefix + group
	}

	return &check.Identity{
		User: &user.DefaultInfo{
			Name:   a.cfg.UsernamePrefix + username,
			Groups: groups,
		},
		Token: rawToken,
	}, nil
}

func (a *Authenticator) refresh(ctx context.Context, sess session) (session, error) {
	if sess.RefreshToken == "" {
		return session{}, errors.New("session has no refresh token")
	}

	source := a.oauth.TokenSource(ctx, &oauth2.Token{
		RefreshToken: sess.RefreshToken,
		Expiry:       time.Unix(sess.Expiry, 0),
	})
	token, err := source.Token()
	if err != nil {
		return session{}, fmt.Errorf("refreshing token: %w", err)
	}

	return a.sessionFromToken(token)
}

func (a *Authenticator) sessionFromToken(token *oauth2.Token) (session, error) {
	rawIDToken, ok := token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return session{}, errors.New("token response has no id_token")
	}
	return session{
		IDToken:      rawIDToken,
		RefreshToken: token.RefreshToken,
		Expiry:       token.Expiry.Unix(),
	}, nil
}

func bearerToken(headers http.Header) (string, bool) {
	value := headers.Get("Authorization")
	if value == "" {
		return "", false
	}
	token, ok := strings.CutPrefix(value, "Bearer ")
	if !ok {
		return "", false
	}
	return strings.TrimSpace(token), token != ""
}

// cookieValue reads a cookie out of a header set without needing a full
// http.Request, which the gRPC transport does not have.
func cookieValue(headers http.Header, name string) (string, error) {
	request := http.Request{Header: headers}
	cookie, err := request.Cookie(name)
	if err != nil {
		return "", err
	}
	return cookie.Value, nil
}

func stringClaim(claims map[string]any, name string) (string, error) {
	raw, ok := claims[name]
	if !ok {
		return "", fmt.Errorf("ID token is missing the %q claim", name)
	}
	value, ok := raw.(string)
	if !ok {
		return "", fmt.Errorf("claim %q is not a string", name)
	}
	return value, nil
}

func stringsClaim(claims map[string]any, name string) ([]string, error) {
	raw, ok := claims[name]
	if !ok {
		return nil, nil
	}

	switch value := raw.(type) {
	case string:
		return []string{value}, nil
	case []any:
		groups := make([]string, 0, len(value))
		for _, item := range value {
			group, ok := item.(string)
			if !ok {
				return nil, fmt.Errorf("claim %q contains a non-string entry", name)
			}
			groups = append(groups, group)
		}
		return groups, nil
	default:
		return nil, fmt.Errorf("claim %q is neither a string nor a list of strings", name)
	}
}
