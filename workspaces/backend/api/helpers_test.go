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

package api

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
)

var _ = Describe("API Helper Functions", func() {

	var (
		app *App
		w   *httptest.ResponseRecorder
	)

	BeforeEach(func() {
		app = &App{}
		w = httptest.NewRecorder()
	})

	Describe("WriteJSON", func() {
		It("should write JSON response with status and custom headers", func() {
			headers := http.Header{"X-Custom": []string{"val"}}
			err := app.WriteJSON(w, http.StatusCreated, Envelope[string]{Data: "ok"}, headers)
			Expect(err).NotTo(HaveOccurred())
			Expect(w.Code).To(Equal(http.StatusCreated))
			Expect(w.Header().Get("Content-Type")).To(Equal(constants.MediaTypeJson))
			Expect(w.Header().Get("X-Custom")).To(Equal("val"))
			Expect(w.Body.String()).To(MatchJSON(`{"data":"ok"}`))
		})

		It("should return an error when data cannot be marshaled", func() {
			err := app.WriteJSON(w, http.StatusOK, make(chan int), nil)
			Expect(err).To(HaveOccurred())
		})
	})

	Describe("WriteSVG", func() {
		It("should write SVG content with defensive XSS headers", func() {
			svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"></svg>`)
			headers := http.Header{"ETag": []string{`"abc123"`}}

			err := app.WriteSVG(w, http.StatusOK, svg, headers)
			Expect(err).NotTo(HaveOccurred())
			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(w.Header().Get("Content-Type")).To(Equal(constants.MediaTypeSVG))
			Expect(w.Header().Get("Content-Security-Policy")).To(Equal("default-src 'none'; script-src 'none'; sandbox"))
			Expect(w.Header().Get("X-Content-Type-Options")).To(Equal("nosniff"))
			Expect(w.Header().Get("Content-Disposition")).To(Equal(`attachment; filename="workspacekind-asset.svg"`))
			Expect(w.Header().Get("ETag")).To(Equal(`"abc123"`))
			Expect(w.Body.Bytes()).To(Equal(svg))
		})
	})

	Describe("DecodeJSON", func() {
		type payload struct {
			Name string `json:"name"`
		}

		It("should decode valid JSON body", func() {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"ws-1"}`))
			var p payload
			Expect(app.DecodeJSON(req, &p)).To(Succeed())
			Expect(p.Name).To(Equal("ws-1"))
		})

		It("should reject unknown fields", func() {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"ws-1","extra":true}`))
			var p payload
			err := app.DecodeJSON(req, &p)
			Expect(err).To(MatchError(ContainSubstring("unknown field")))
		})

		It("should wrap EOF for an empty request body", func() {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(""))
			var p payload
			err := app.DecodeJSON(req, &p)
			Expect(err).To(MatchError(ContainSubstring("request body was empty")))
			Expect(app.IsEOFError(err)).To(BeTrue())
		})

		It("should preserve MaxBytesError when request body exceeds limit", func() {
			req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"name":"very-long-workspace-name"}`))
			req.Body = http.MaxBytesReader(w, req.Body, 5)
			var p payload
			err := app.DecodeJSON(req, &p)
			Expect(err).To(HaveOccurred())
			Expect(app.IsMaxBytesError(err)).To(BeTrue())
		})
	})

	Describe("IsMaxBytesError and IsEOFError", func() {
		It("should detect wrapped errors accurately", func() {
			Expect(app.IsMaxBytesError(&http.MaxBytesError{Limit: 10})).To(BeTrue())
			Expect(app.IsMaxBytesError(errors.New("other"))).To(BeFalse())
			Expect(app.IsEOFError(fmt.Errorf("wrapped: %w", io.EOF))).To(BeTrue())
			Expect(app.IsEOFError(errors.New("other"))).To(BeFalse())
		})
	})

	Describe("ValidateContentType", func() {
		It("should accept matching Content-Type with optional parameters", func() {
			req := httptest.NewRequest(http.MethodPost, "/", http.NoBody)
			req.Header.Set("Content-Type", "application/json; charset=utf-8")
			Expect(app.ValidateContentType(w, req, constants.MediaTypeJson)).To(BeTrue())
		})

		It("should return 415 when Content-Type header is missing", func() {
			req := httptest.NewRequest(http.MethodPost, "/", http.NoBody)
			Expect(app.ValidateContentType(w, req, constants.MediaTypeJson)).To(BeFalse())
			Expect(w.Code).To(Equal(http.StatusUnsupportedMediaType))
		})

		It("should return 400 when Content-Type header is malformed", func() {
			req := httptest.NewRequest(http.MethodPost, "/", http.NoBody)
			req.Header.Set("Content-Type", "application/json; invalid=")
			Expect(app.ValidateContentType(w, req, constants.MediaTypeJson)).To(BeFalse())
			Expect(w.Code).To(Equal(http.StatusBadRequest))
		})

		It("should return 415 when media type does not match", func() {
			req := httptest.NewRequest(http.MethodPost, "/", http.NoBody)
			req.Header.Set("Content-Type", "text/plain")
			Expect(app.ValidateContentType(w, req, constants.MediaTypeJson)).To(BeFalse())
			Expect(w.Code).To(Equal(http.StatusUnsupportedMediaType))
		})
	})

	Describe("Location helpers", func() {
		It("should format workspace, workspacekind, and secret GET paths", func() {
			Expect(app.LocationGetWorkspace("team-a", "ws-1")).To(Equal("/api/v1/workspaces/team-a/ws-1"))
			Expect(app.LocationGetWorkspaceKind("jupyterlab")).To(Equal("/api/v1/workspacekinds/jupyterlab"))
			Expect(app.LocationGetSecret("team-a", "my-secret")).To(Equal("/api/v1/secrets/team-a/my-secret"))
		})
	})
})
