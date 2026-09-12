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

package helper

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

const (
	testTimestampRFC3339     = "2030-01-01T00:00:00Z"
	testTimestampRFC3339Nano = "2030-01-01T00:00:00.123456789Z"
	testTimestampOlder       = "2000-01-01T00:00:00Z"
)

var (
	testTimeRFC3339, _     = time.Parse(time.RFC3339, testTimestampRFC3339)
	testTimeRFC3339Nano, _ = time.Parse(time.RFC3339Nano, testTimestampRFC3339Nano)
)

// fakeHTTPProber is a test double for HTTPProber.
type fakeHTTPProber struct {
	resp        *http.Response
	err         error
	capturedURL string
}

func (f *fakeHTTPProber) Get(_ context.Context, url string) (*http.Response, error) {
	f.capturedURL = url
	return f.resp, f.err
}

func newHTTPResponse(status int, body string) *http.Response {
	return &http.Response{
		StatusCode: status,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     make(http.Header),
	}
}

// fakeExitError implements the exit-code interface used by exitCodeFromError.
type fakeExitError struct {
	code int
}

func (e fakeExitError) Error() string   { return fmt.Sprintf("exit code %d", e.code) }
func (e fakeExitError) ExitStatus() int { return e.code }

// fakePodExecutor is a test double for PodExecutor.
type fakePodExecutor struct {
	stdoutContent string
	err           error
}

func (f *fakePodExecutor) Exec(_ context.Context, _, _, _ string, _ []string, stdin io.Reader, stdout, stderr io.Writer) error {
	// drain stdin (the script) to mimic real behavior
	if stdin != nil {
		_, _ = io.Copy(io.Discard, stdin)
	}
	if f.err != nil {
		return f.err
	}
	if stdout != nil && f.stdoutContent != "" {
		_, _ = io.WriteString(stdout, f.stdoutContent)
	}
	return nil
}

type errorReader struct{}

func (e *errorReader) Read(_ []byte) (int, error) {
	return 0, fmt.Errorf("read body error")
}

var _ = Describe("ProbeResult", func() {
	It("should report Succeeded correctly", func() {
		resSuccess := &ProbeResult{Result: kubefloworgv1beta1.WorkspaceProbeResultSuccess}
		Expect(resSuccess.Succeeded()).To(BeTrue())

		resFailure := &ProbeResult{Result: kubefloworgv1beta1.WorkspaceProbeResultFailure}
		Expect(resFailure.Succeeded()).To(BeFalse())
	})
})

var _ = Describe("DefaultHTTPProber", func() {
	It("should perform an HTTP GET request", func() {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
			_, _ = fmt.Fprintf(w, `{"last_activity":%q}`, testTimestampRFC3339)
		}))
		defer server.Close()

		prober := &DefaultHTTPProber{Client: server.Client()}
		resp, err := prober.Get(context.Background(), server.URL)
		Expect(err).ToNot(HaveOccurred())
		Expect(resp.StatusCode).To(Equal(http.StatusOK))
		_ = resp.Body.Close()
	})

	It("should return error when URL is invalid", func() {
		prober := &DefaultHTTPProber{Client: http.DefaultClient}
		_, err := prober.Get(context.Background(), "http://127.0.0.1:0\x7f")
		Expect(err).To(HaveOccurred())
	})
})

var _ = Describe("RunJupyterProbe", func() {
	ctx := context.Background()

	It("should succeed and extract last_activity", func() {
		prober := &fakeHTTPProber{
			resp: newHTTPResponse(http.StatusOK, fmt.Sprintf(`{"last_activity": %q}`, testTimestampRFC3339)),
		}
		result := RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "", time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
		Expect(*result.LastActivity).To(Equal(testTimeRFC3339))
	})

	It("should report timeout when deadline is exceeded", func() {
		prober := &fakeHTTPProber{err: context.DeadlineExceeded}
		result := RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "", time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultTimeout))
		Expect(result.Message).To(ContainSubstring("timeout after 1000ms"))
	})

	It("should fail when reading response body fails", func() {
		prober := &fakeHTTPProber{
			resp: &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(&errorReader{}),
				Header:     make(http.Header),
			},
		}
		result := RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "", time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("unable to read response body"))
	})

	It("should fail on a non-2xx status code", func() {
		prober := &fakeHTTPProber{
			resp: newHTTPResponse(http.StatusInternalServerError, ``),
		}
		result := RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "", time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.LastActivity).To(BeNil())
		Expect(result.Message).To(ContainSubstring("HTTP 500"))
	})

	It("should fail on a connection error", func() {
		prober := &fakeHTTPProber{err: fmt.Errorf("connection refused")}
		result := RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "", time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.LastActivity).To(BeNil())
	})

	It("should fail on an invalid JSON body", func() {
		prober := &fakeHTTPProber{
			resp: newHTTPResponse(http.StatusOK, `not json`),
		}
		result := RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "", time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("invalid response body"))
	})

	It("should fail on an invalid last_activity timestamp", func() {
		prober := &fakeHTTPProber{
			resp: newHTTPResponse(http.StatusOK, `{"last_activity": "not-a-date"}`),
		}
		result := RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "", time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.LastActivity).To(BeNil())
	})

	It("should respect the basePath", func() {
		prober := &fakeHTTPProber{
			resp: newHTTPResponse(http.StatusOK, fmt.Sprintf(`{"last_activity": %q}`, testTimestampRFC3339)),
		}
		_ = RunJupyterProbe(ctx, prober, "10.0.0.1", 8888, "/my/base/path/", time.Second)
		Expect(prober.capturedURL).To(Equal("http://10.0.0.1:8888/my/base/path/api/status"))
	})
})

var _ = Describe("RunPodExecProbe", func() {
	ctx := context.Background()
	const script = "#!/usr/bin/env bash\necho hi"

	It("should succeed with has_activity: true and set lastActivity to endTime", func() {
		executor := &fakePodExecutor{stdoutContent: `{"has_activity": true}`}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
		Expect(*result.LastActivity).To(Equal(result.EndTime))
	})

	It("should succeed with empty output and treat as active", func() {
		executor := &fakePodExecutor{stdoutContent: ``}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
		Expect(*result.LastActivity).To(Equal(result.EndTime))
	})

	It("should succeed with has_activity: false and ignore last_activity when both present", func() {
		executor := &fakePodExecutor{stdoutContent: fmt.Sprintf(`{"has_activity": false, "last_activity": %q}`, testTimestampRFC3339)}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).To(BeNil())
	})

	It("should succeed with has_activity: false and no last_activity (leave unchanged)", func() {
		executor := &fakePodExecutor{stdoutContent: `{"has_activity": false}`}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).To(BeNil())
	})

	It("should prefer has_activity over last_activity when both present", func() {
		executor := &fakePodExecutor{stdoutContent: fmt.Sprintf(`{"has_activity": true, "last_activity": %q}`, testTimestampOlder)}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(*result.LastActivity).To(Equal(result.EndTime))
	})

	It("should fail on a non-zero exit code", func() {
		executor := &fakePodExecutor{err: fakeExitError{code: 100}}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.LastActivity).To(BeNil())
		Expect(result.Message).To(ContainSubstring("unexpected exit code 100"))
	})

	It("should recover the exit code from a wrapped exit error", func() {
		executor := &fakePodExecutor{err: fmt.Errorf("stream failed: %w", fakeExitError{code: 42})}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.LastActivity).To(BeNil())
		Expect(result.Message).To(ContainSubstring("unexpected exit code 42"))
	})

	It("should fail on invalid JSON output", func() {
		executor := &fakePodExecutor{stdoutContent: `not-json`}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("invalid JSON file"))
	})

	It("should report a timeout when the context deadline is exceeded", func() {
		executor := &fakePodExecutor{err: context.DeadlineExceeded}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultTimeout))
		Expect(result.LastActivity).To(BeNil())
	})

	It("should fail on a generic non-exit exec error", func() {
		executor := &fakePodExecutor{err: fmt.Errorf("generic exec error")}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("generic exec error"))
	})

	It("should succeed when has_activity is false and last_activity is invalid (last_activity ignored)", func() {
		executor := &fakePodExecutor{stdoutContent: `{"has_activity": false, "last_activity": "invalid"}`}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).To(BeNil())
	})

	It("should succeed when has_activity is true and last_activity is invalid (last_activity ignored)", func() {
		executor := &fakePodExecutor{stdoutContent: `{"has_activity": true, "last_activity": "invalid"}`}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
		Expect(*result.LastActivity).To(Equal(result.EndTime))
	})

	It("should succeed when only valid last_activity is provided", func() {
		executor := &fakePodExecutor{stdoutContent: fmt.Sprintf(`{"last_activity": %q}`, testTimestampRFC3339)}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
		Expect(*result.LastActivity).To(Equal(testTimeRFC3339))
	})

	It("should fail when only invalid last_activity is provided", func() {
		executor := &fakePodExecutor{stdoutContent: `{"last_activity": "bad-date"}`}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultFailure))
		Expect(result.Message).To(ContainSubstring("invalid JSON file"))
	})

	It("should succeed with empty JSON object and treat as active", func() {
		executor := &fakePodExecutor{stdoutContent: `{}`}
		result := RunPodExecProbe(ctx, executor, "ns", "pod", script, time.Second)
		Expect(result.Result).To(Equal(kubefloworgv1beta1.WorkspaceProbeResultSuccess))
		Expect(result.LastActivity).ToNot(BeNil())
		Expect(*result.LastActivity).To(Equal(result.EndTime))
	})
})

var _ = Describe("parseISO8601", func() {
	It("should parse an RFC3339 timestamp", func() {
		t, err := parseISO8601(testTimestampRFC3339)
		Expect(err).ToNot(HaveOccurred())
		Expect(t.Equal(testTimeRFC3339)).To(BeTrue())
	})

	It("should parse an RFC3339Nano timestamp fallback", func() {
		t, err := parseISO8601(testTimestampRFC3339Nano)
		Expect(err).ToNot(HaveOccurred())
		Expect(t.Equal(testTimeRFC3339Nano)).To(BeTrue())
	})

	It("should error on an empty string", func() {
		_, err := parseISO8601("")
		Expect(err).To(HaveOccurred())
	})

	It("should error on an invalid timestamp", func() {
		_, err := parseISO8601("nope")
		Expect(err).To(HaveOccurred())
	})
})

var _ = Describe("exitCodeFromError", func() {
	It("should return (0, false) for non-exit errors", func() {
		code, ok := exitCodeFromError(fmt.Errorf("random error"))
		Expect(ok).To(BeFalse())
		Expect(code).To(Equal(0))
	})
})
