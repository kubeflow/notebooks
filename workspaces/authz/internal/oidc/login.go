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

package oidc

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-logr/logr"

	"github.com/kubeflow/notebooks/workspaces/authz/internal/check"
)

// CallbackPath and SignOutPath are served by this service directly and must be
// routed to it, not gated behind the ExternalAuth filter.
const (
	CallbackPath = "/oauth2/callback"
	SignOutPath  = "/oauth2/sign_out"
)

// loginState is the CSRF state carried in a cookie across the authorization
// code flow.
type loginState struct {
	Nonce string `json:"nonce"`
	// Redirect is a path within this site, never an absolute URL, so that it
	// cannot be used to bounce a user to an attacker-controlled host.
	Redirect string `json:"redirect"`
}

// Challenge implements check.Authenticator.
//
// Browsers are redirected into the authorization code flow. Anything else gets
// a 401 with a Bearer challenge, so that API clients and websocket upgrades see
// a useful error instead of an HTML login page.
func (a *Authenticator) Challenge(r *check.Request) check.Decision {
	if !wantsHTML(r) {
		return check.Decision{
			Status: http.StatusUnauthorized,
			ResponseHeaders: http.Header{
				"WWW-Authenticate": []string{`Bearer realm="kubeflow-workspaces"`},
				"Content-Type":     []string{"text/plain; charset=utf-8"},
			},
			Body: "unauthorized",
		}
	}

	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return check.Denied(http.StatusInternalServerError, "authorization service error")
	}
	nonce := base64.RawURLEncoding.EncodeToString(nonceBytes)

	sealed, err := a.codec.seal(loginState{Nonce: nonce, Redirect: r.Path})
	if err != nil {
		return check.Denied(http.StatusInternalServerError, "authorization service error")
	}

	headers := http.Header{}
	headers.Set("Location", a.oauth.AuthCodeURL(nonce))
	headers.Add("Set-Cookie", a.newCookie(stateCookieName, sealed, 10*time.Minute).String())
	// The login page must not be cached in place of the resource the user asked
	// for.
	headers.Set("Cache-Control", "no-store")

	return check.Decision{
		Status:          http.StatusFound,
		ResponseHeaders: headers,
	}
}

// RegisterRoutes installs the endpoints that complete and end a login.
func (a *Authenticator) RegisterRoutes(mux *http.ServeMux, log logr.Logger) {
	mux.HandleFunc(CallbackPath, func(w http.ResponseWriter, r *http.Request) {
		a.handleCallback(w, r, log)
	})
	mux.HandleFunc(SignOutPath, func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, a.expireCookie(a.cfg.CookieName))
		http.Redirect(w, r, "/", http.StatusFound)
	})
}

func (a *Authenticator) handleCallback(w http.ResponseWriter, r *http.Request, log logr.Logger) {
	stateCookie, err := r.Cookie(stateCookieName)
	if err != nil {
		http.Error(w, "login state missing or expired, please retry", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, a.expireCookie(stateCookieName))

	var state loginState
	if err := a.codec.open(stateCookie.Value, &state); err != nil {
		http.Error(w, "login state is invalid, please retry", http.StatusBadRequest)
		return
	}

	if subtle.ConstantTimeCompare([]byte(state.Nonce), []byte(r.URL.Query().Get("state"))) != 1 {
		http.Error(w, "login state mismatch, please retry", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "authorization code missing", http.StatusBadRequest)
		return
	}

	token, err := a.oauth.Exchange(r.Context(), code)
	if err != nil {
		log.Error(err, "exchanging authorization code")
		http.Error(w, "login failed", http.StatusUnauthorized)
		return
	}

	sess, err := a.sessionFromToken(token)
	if err != nil {
		log.Error(err, "building session from token response")
		http.Error(w, "login failed", http.StatusUnauthorized)
		return
	}

	sealed, err := a.codec.seal(sess)
	if err != nil {
		log.Error(err, "sealing session")
		http.Error(w, "login failed", http.StatusInternalServerError)
		return
	}

	http.SetCookie(w, a.newCookie(a.cfg.CookieName, sealed, time.Until(time.Unix(sess.Expiry, 0))))
	http.Redirect(w, r, safeRedirect(state.Redirect), http.StatusFound)
}

func (a *Authenticator) newCookie(name, value string, maxAge time.Duration) *http.Cookie {
	if maxAge <= 0 {
		maxAge = time.Hour
	}
	return &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/",
		MaxAge:   int(maxAge.Seconds()),
		HttpOnly: true,
		Secure:   a.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

func (a *Authenticator) expireCookie(name string) *http.Cookie {
	return &http.Cookie{
		Name:     name,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   a.cfg.CookieSecure,
		SameSite: http.SameSiteLaxMode,
	}
}

// safeRedirect reduces a stored redirect target to a path on this site,
// rejecting absolute URLs and protocol-relative paths.
func safeRedirect(target string) string {
	if target == "" || !strings.HasPrefix(target, "/") || strings.HasPrefix(target, "//") {
		return "/"
	}
	parsed, err := url.Parse(target)
	if err != nil || parsed.Scheme != "" || parsed.Host != "" {
		return "/"
	}
	return parsed.RequestURI()
}

// wantsHTML reports whether the caller is a browser navigating to a page, and
// so can be sent through an interactive login.
func wantsHTML(r *check.Request) bool {
	if strings.EqualFold(r.Headers.Get("X-Requested-With"), "XMLHttpRequest") {
		return false
	}
	if r.Headers.Get("Upgrade") != "" {
		return false
	}
	if r.Method != http.MethodGet {
		return false
	}
	return strings.Contains(r.Headers.Get("Accept"), "text/html")
}
