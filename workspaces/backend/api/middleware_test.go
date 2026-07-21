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
	"compress/gzip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"

	"github.com/klauspost/compress/gzhttp"
	"github.com/klauspost/compress/zstd"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("compression", func() {

	const (
		testRequestPath      = "/test"
		testSmallRequestPath = "/test-small"
	)

	var (
		app        *App
		compressed http.Handler
	)

	// largePayload is intentionally larger than gzhttp's default MinSize (1024 bytes)
	// so that it is eligible for compression.
	largePayload := func() map[string]string {
		return map[string]string{"data": strings.Repeat("kubeflow-notebooks-compression-test", 100)}
	}

	// smallPayload mirrors a tiny response (e.g. the healthcheck endpoint), which should
	// stay under the MinSize threshold and therefore never be compressed.
	smallPayload := func() map[string]string {
		return map[string]string{"data": "ok"}
	}

	BeforeEach(func() {
		app = &App{}

		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			payload := largePayload()
			if r.URL.Path == testSmallRequestPath {
				payload = smallPayload()
			}
			err := app.WriteJSON(w, http.StatusOK, payload, nil)
			Expect(err).NotTo(HaveOccurred())
		})

		compressed = gzhttp.GzipHandler(next)
	})

	DescribeTable("negotiating the response encoding",
		func(requestPath string, acceptEncoding string, expectedEncoding string) {
			r := httptest.NewRequest(http.MethodGet, requestPath, http.NoBody)
			if acceptEncoding != "" {
				r.Header.Set("Accept-Encoding", acceptEncoding)
			}
			w := httptest.NewRecorder()

			compressed.ServeHTTP(w, r)

			Expect(w.Code).To(Equal(http.StatusOK))
			Expect(w.Header().Get("Content-Encoding")).To(Equal(expectedEncoding))

			// the handler only advertises Vary once it has actually compressed the body
			if expectedEncoding != "" {
				Expect(w.Header().Get("Vary")).To(ContainSubstring("Accept-Encoding"))
			}

			var body io.Reader = w.Body
			switch expectedEncoding {
			case "gzip":
				gzReader, err := gzip.NewReader(w.Body)
				Expect(err).NotTo(HaveOccurred())
				defer gzReader.Close()
				body = gzReader
			case "zstd":
				zstdReader, err := zstd.NewReader(w.Body)
				Expect(err).NotTo(HaveOccurred())
				defer zstdReader.Close()
				body = zstdReader
			}

			decompressed, err := io.ReadAll(body)
			Expect(err).NotTo(HaveOccurred())

			payload := largePayload()
			if requestPath == testSmallRequestPath {
				payload = smallPayload()
			}
			expected, err := json.Marshal(payload)
			Expect(err).NotTo(HaveOccurred())
			Expect(decompressed).To(MatchJSON(expected))
		},
		Entry("compresses a large response with gzip when the client accepts it",
			testRequestPath, "gzip", "gzip"),
		Entry("compresses a large response with zstd when the client accepts it",
			testRequestPath, "zstd", "zstd"),
		Entry("prefers zstd over gzip when the client accepts both at equal quality",
			testRequestPath, "gzip, zstd", "zstd"),
		Entry("does not compress the response when the client sends no Accept-Encoding",
			testRequestPath, "", ""),
		Entry("does not compress small responses even when the client accepts compression",
			testSmallRequestPath, "gzip, zstd", ""),
	)
})
