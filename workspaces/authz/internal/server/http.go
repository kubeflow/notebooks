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

package server

import (
	"net/http"
	"strings"

	"github.com/go-logr/logr"

	"github.com/kubeflow/notebooks/workspaces/authz/internal/check"
)

// HTTP implements the forward-auth protocol selected by the Gateway API
// ExternalAuth filter when `protocol: HTTP`: a 200 response authorizes the
// request and any other status rejects it.
type HTTP struct {
	Checker *check.Checker
	Log     logr.Logger

	// PathPrefix matches the `http.path` field of the ExternalAuth filter, which
	// the data plane prepends to the original request path. It is stripped
	// before the path is matched against the policy.
	PathPrefix string
}

func (s *HTTP) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path
	if s.PathPrefix != "" {
		trimmed, ok := strings.CutPrefix(path, s.PathPrefix)
		if !ok {
			// The data plane is misconfigured; failing closed is the only safe
			// option because the real path cannot be recovered.
			s.Log.Info("rejecting request that does not carry the configured path prefix",
				"path", path, "pathPrefix", s.PathPrefix)
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		path = trimmed
	}
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}

	decision, err := s.Checker.Check(r.Context(), &check.Request{
		Method:  r.Method,
		Path:    path,
		Host:    r.Host,
		Scheme:  scheme(r),
		Headers: r.Header,
	})
	if err != nil {
		s.Log.Error(err, "check failed", "path", path)
		http.Error(w, "authorization service error", http.StatusInternalServerError)
		return
	}

	if decision.Allow {
		copyHeaders(w.Header(), decision.UpstreamHeaders)
		w.WriteHeader(http.StatusOK)
		return
	}

	copyHeaders(w.Header(), decision.ResponseHeaders)
	w.WriteHeader(decision.Status)
	if decision.Body != "" {
		if _, err := w.Write([]byte(decision.Body)); err != nil {
			s.Log.Error(err, "writing denial body")
		}
	}
}

func copyHeaders(dst, src http.Header) {
	for name, values := range src {
		dst.Del(name)
		for _, value := range values {
			dst.Add(name, value)
		}
	}
}

func scheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	if forwarded := r.Header.Get("X-Forwarded-Proto"); forwarded != "" {
		return forwarded
	}
	return "http"
}
