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
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/util/httpstream"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/remotecommand"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

const (
	// maxProbeResponseBytes bounds how much of a probe response body is read, to protect the
	// controller against a misbehaving or malicious Workspace returning an unbounded response.
	maxProbeResponseBytes = 1 << 20 // 1 MiB

	// probeContainerName is the name of the container in the Workspace Pod that the
	// activity probes target (matches workspacePodTemplateContainerName in the controller).
	probeContainerName = "main"

	// jupyterStatusPath is the Jupyter Server endpoint used to determine activity.
	jupyterStatusPath = "/api/status"

	// ProbeMessagePrefixJupyterFailed is the message prefix for failed Jupyter probe results.
	ProbeMessagePrefixJupyterFailed = "Jupyter probe failed: "

	// ProbeMessageJupyterSucceeded is the message for successful Jupyter probe results.
	ProbeMessageJupyterSucceeded = "Jupyter probe succeeded"

	// ProbeMessagePrefixPodExecFailed is the message prefix for failed PodExec probe results.
	ProbeMessagePrefixPodExecFailed = "PodExec probe failed: "

	// ProbeMessagePodExecSucceeded is the message for successful PodExec probe results.
	ProbeMessagePodExecSucceeded = "PodExec probe succeeded"

	// ProbeMessagePodNotReady is the message when a Workspace Pod is not ready to be probed.
	ProbeMessagePodNotReady = "probe failed: Workspace Pod is not ready"

	// ProbeMessageNoTypeConfigured is the message when no probe type is configured on a Workspace.
	ProbeMessageNoTypeConfigured = "probe failed: no probe type configured"
)

// ProbeResult captures the outcome of an activity probe execution.
//
// LastActivity is only set (non-nil) when the probe succeeds and determines a new
// activity timestamp. A nil LastActivity on a successful probe means the activity
// timestamp should be left unchanged (e.g. a podExec probe reporting `has_activity: false`
// without a `last_activity` field).
type ProbeResult struct {
	// StartTime is the time the probe was started.
	StartTime time.Time

	// EndTime is the time the probe completed.
	EndTime time.Time

	// Result is the outcome of the probe (Success, Failure, or Timeout).
	Result kubefloworgv1beta1.WorkspaceProbeResult

	// Message is a human-readable message about the probe result.
	Message string

	// LastActivity is the activity timestamp determined by the probe. It is nil
	// when the probe did not succeed or when the activity timestamp should not
	// be updated.
	LastActivity *time.Time
}

// Succeeded reports whether the probe completed successfully.
func (r *ProbeResult) Succeeded() bool {
	return r.Result == kubefloworgv1beta1.WorkspaceProbeResultSuccess
}

// newFailureResult builds a failed ProbeResult with the given start time and message. The end
// time is set to the current time, and LastActivity is left nil so failing probes never trigger any activity rule effects.
func newFailureResult(startTime time.Time, message string) *ProbeResult {
	return &ProbeResult{
		StartTime: startTime,
		EndTime:   time.Now(),
		Result:    kubefloworgv1beta1.WorkspaceProbeResultFailure,
		Message:   message,
	}
}

// newTimeoutResult builds a timed-out ProbeResult with the given start/end time and message.
func newTimeoutResult(startTime, endTime time.Time, message string) *ProbeResult {
	return &ProbeResult{
		StartTime: startTime,
		EndTime:   endTime,
		Result:    kubefloworgv1beta1.WorkspaceProbeResultTimeout,
		Message:   message,
	}
}

// newSuccessResult builds a successful ProbeResult with the given times, message and optional
// activity timestamp (nil means "leave the existing lastActivity unchanged").
func newSuccessResult(startTime, endTime time.Time, message string, lastActivity *time.Time) *ProbeResult {
	return &ProbeResult{
		StartTime:    startTime,
		EndTime:      endTime,
		Result:       kubefloworgv1beta1.WorkspaceProbeResultSuccess,
		Message:      message,
		LastActivity: lastActivity,
	}
}

// jupyterStatusResponse is the subset of the Jupyter `/api/status` response we care about.
type jupyterStatusResponse struct {
	// LastActivity is an ISO 8601 timestamp (e.g. "2030-01-01T00:00:00Z").
	LastActivity string `json:"last_activity"`
}

// podExecOutput is the JSON contract written by a podExec probe script to OUTPUT_JSON_PATH.
type podExecOutput struct {
	// HasActivity, when set, indicates whether the Workspace was active at the probe end time.
	HasActivity *bool `json:"has_activity,omitempty"`

	// LastActivity is an ISO 8601 timestamp of the last activity.
	LastActivity *string `json:"last_activity,omitempty"`
}

// PodExecutor executes a command inside a Pod container and streams the result.
// It is an interface to allow the controller to inject a fake implementation in tests.
type PodExecutor interface {
	// Exec runs the given command in the specified Pod container, writing stdin to the
	// process and capturing stdout and stderr. It returns an error if the command exits
	// with a non-zero status code or if the exec stream fails.
	Exec(ctx context.Context, namespace, podName, container string, command []string, stdin io.Reader, stdout, stderr io.Writer) error
}

// HTTPProber performs an HTTP GET request against a Workspace Pod, used by the Jupyter probe.
// It is an interface to allow the controller to inject a fake implementation in tests.
type HTTPProber interface {
	// Get performs an HTTP GET against the given URL and returns the response.
	Get(ctx context.Context, url string) (*http.Response, error)
}

// RemoteCommandExecutor is a PodExecutor backed by the Kubernetes exec subresource.
type RemoteCommandExecutor struct {
	Clientset  kubernetes.Interface
	RestConfig *rest.Config
}

// Exec implements PodExecutor using the Kubernetes exec API.
func (e *RemoteCommandExecutor) Exec(ctx context.Context, namespace, podName, container string, command []string, stdin io.Reader, stdout, stderr io.Writer) error {
	req := e.Clientset.CoreV1().RESTClient().
		Post().
		Resource("pods").
		Name(podName).
		Namespace(namespace).
		SubResource("exec").
		VersionedParams(&corev1.PodExecOptions{
			Container: container,
			Command:   command,
			Stdin:     stdin != nil,
			Stdout:    stdout != nil,
			Stderr:    stderr != nil,
			TTY:       false,
		}, scheme.ParameterCodec)

	websocketExec, err := remotecommand.NewWebSocketExecutor(e.RestConfig, http.MethodPost, req.URL().String())
	if err != nil {
		return fmt.Errorf("failed to initialize websocket executor: %w", err)
	}

	spdyExec, err := remotecommand.NewSPDYExecutor(e.RestConfig, http.MethodPost, req.URL())
	if err != nil {
		return fmt.Errorf("failed to initialize spdy executor: %w", err)
	}

	exec, err := remotecommand.NewFallbackExecutor(websocketExec, spdyExec, httpstream.IsUpgradeFailure)
	if err != nil {
		return fmt.Errorf("failed to initialize fallback executor: %w", err)
	}

	return exec.StreamWithContext(ctx, remotecommand.StreamOptions{
		Stdin:  stdin,
		Stdout: stdout,
		Stderr: stderr,
		Tty:    false,
	})
}

// DefaultHTTPProber is an HTTPProber backed by a standard http.Client.
type DefaultHTTPProber struct {
	Client *http.Client
}

// Get implements HTTPProber using the underlying http.Client.
func (p *DefaultHTTPProber) Get(ctx context.Context, url string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, http.NoBody)
	if err != nil {
		return nil, err
	}
	client := p.Client
	if client == nil {
		client = http.DefaultClient
	}
	return client.Do(req)
}

// isDeadlineExceeded reports whether the given error (or the context) was caused by a deadline.
func isDeadlineExceeded(ctx context.Context, err error) bool {
	return errors.Is(ctx.Err(), context.DeadlineExceeded) || errors.Is(err, context.DeadlineExceeded)
}

// RunJupyterProbe polls the Jupyter `/api/status` endpoint on the Workspace Pod and
// extracts the `last_activity` timestamp.
//
// The serviceHost should be the DNS name (or IP) that resolves to the Workspace Pod, and
// port is the container port to probe. basePath is the HTTP path prefix (if any) used by the
// Jupyter server. A failed probe (connection error, non-2xx status, invalid body) returns a
// ProbeResult with Result == Failure/Timeout and a nil LastActivity, so that failing probes
// never trigger activity rule effects.
func RunJupyterProbe(ctx context.Context, prober HTTPProber, serviceHost string, port int32, basePath string, timeout time.Duration) *ProbeResult {
	startTime := time.Now()

	probeCtx := ctx
	var cancel context.CancelFunc
	if timeout > 0 {
		probeCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	// ensure basePath has no trailing slash and jupyterStatusPath starts with a slash
	url := fmt.Sprintf("http://%s:%d%s%s", serviceHost, port, strings.TrimSuffix(basePath, "/"), jupyterStatusPath)

	resp, err := prober.Get(probeCtx, url)
	endTime := time.Now()

	if err != nil {
		if isDeadlineExceeded(probeCtx, err) {
			return newTimeoutResult(startTime, endTime, fmt.Sprintf("%stimeout after %dms", ProbeMessagePrefixJupyterFailed, timeout.Milliseconds()))
		}
		return newFailureResult(startTime, fmt.Sprintf("%s%v", ProbeMessagePrefixJupyterFailed, err))
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return newFailureResult(startTime, fmt.Sprintf("%sHTTP %d", ProbeMessagePrefixJupyterFailed, resp.StatusCode))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxProbeResponseBytes))
	if err != nil {
		return newFailureResult(startTime, fmt.Sprintf("%sunable to read response body: %v", ProbeMessagePrefixJupyterFailed, err))
	}

	var status jupyterStatusResponse
	if err := json.Unmarshal(body, &status); err != nil {
		return newFailureResult(startTime, ProbeMessagePrefixJupyterFailed+"invalid response body")
	}

	lastActivity, err := parseISO8601(status.LastActivity)
	if err != nil {
		return newFailureResult(startTime, fmt.Sprintf("%sinvalid last_activity: %v", ProbeMessagePrefixJupyterFailed, err))
	}

	return newSuccessResult(startTime, endTime, ProbeMessageJupyterSucceeded, &lastActivity)
}

// RunPodExecProbe executes the given script inside the Workspace Pod via the Kubernetes exec
// API and parses the JSON output written to a randomized OUTPUT_JSON_PATH.
//
// The script is executed via `/bin/sh -c` with the OUTPUT_JSON_PATH environment variable set
// to a randomized path. The script itself provides the interpreter via its shebang. After the
// script exits with code 0, the JSON output file is read back and parsed. A failed probe
// (non-zero exit code, timeout, missing/invalid JSON) returns a ProbeResult with a nil
// LastActivity so that failing probes never trigger activity rule effects.
func RunPodExecProbe(ctx context.Context, executor PodExecutor, namespace, podName, script string, timeout time.Duration) *ProbeResult {
	startTime := time.Now()

	// randomize the output path each probe to prevent scripts (or users) from
	// pre-populating or depending on a fixed location.
	outputPath, err := randomOutputPath()
	if err != nil {
		return newFailureResult(startTime, fmt.Sprintf("%sunable to generate output path: %v", ProbeMessagePrefixPodExecFailed, err))
	}

	execCtx := ctx
	var cancel context.CancelFunc
	if timeout > 0 {
		execCtx, cancel = context.WithTimeout(ctx, timeout)
		defer cancel()
	}

	// Write the script to the output-path directory, execute it with OUTPUT_JSON_PATH set,
	// then print the resulting JSON file to stdout so the controller can read it back.
	// Using a single shell invocation avoids needing multiple exec round-trips.
	// Redirect the probe script's stdout to /dev/null so script stdout/banners do not corrupt
	// the JSON output.
	scriptPath := outputPath + ".script"
	shellCommand := fmt.Sprintf(
		`cat > "%[1]s" && chmod +x "%[1]s" && OUTPUT_JSON_PATH="%[2]s" "%[1]s" >/dev/null; rc=$?; rm -f "%[1]s"; `+
			`if [ $rc -ne 0 ]; then exit $rc; fi; `+
			`if [ -f "%[2]s" ]; then cat "%[2]s"; rm -f "%[2]s"; fi`,
		scriptPath, outputPath,
	)
	command := []string{"/bin/sh", "-c", shellCommand}

	stdout := &limitedBuffer{max: maxProbeResponseBytes}
	stderr := &limitedBuffer{max: maxProbeResponseBytes}
	execErr := executor.Exec(execCtx, namespace, podName, probeContainerName, command, bytes.NewBufferString(script), stdout, stderr)

	// Capture endTime once to ensure the ProbeResult.EndTime matches the fallback
	// timestamp used in parsePodExecOutput when the probe indicates activity.
	endTime := time.Now()

	if execErr != nil {
		if isDeadlineExceeded(execCtx, execErr) {
			return newTimeoutResult(startTime, endTime, fmt.Sprintf("%stimeout after %dms", ProbeMessagePrefixPodExecFailed, timeout.Milliseconds()))
		}
		if code, ok := exitCodeFromError(execErr); ok {
			return newFailureResult(startTime, fmt.Sprintf("%sunexpected exit code %d", ProbeMessagePrefixPodExecFailed, code))
		}
		return newFailureResult(startTime, fmt.Sprintf("%s%v", ProbeMessagePrefixPodExecFailed, execErr))
	}

	lastActivity, err := parsePodExecOutput(stdout.Bytes(), endTime)
	if err != nil {
		return newFailureResult(startTime, fmt.Sprintf("%s%v", ProbeMessagePrefixPodExecFailed, err))
	}

	return newSuccessResult(startTime, endTime, ProbeMessagePodExecSucceeded, lastActivity)
}

// parsePodExecOutput interprets the JSON output of a podExec probe according to the CRD contract:
//   - empty/omitted output -> active (lastActivity = endTime)
//   - has_activity: true -> active (lastActivity = endTime, ignores last_activity)
//   - has_activity: false -> inactive (lastActivity unchanged, nil, ignores last_activity)
//   - last_activity provided without has_activity -> inactive (lastActivity = parsed timestamp)
func parsePodExecOutput(raw []byte, endTime time.Time) (*time.Time, error) {
	trimmed := bytes.TrimSpace(raw)

	// per the CRD contract, both an empty output and a JSON object with neither field
	// mean the workspace is considered active at the probe end time. The empty-output
	// case is handled here up-front; the empty-object case falls through to the same
	// result at the end of this function.
	if len(trimmed) == 0 {
		return &endTime, nil
	}

	var out podExecOutput
	if err := json.Unmarshal(trimmed, &out); err != nil {
		return nil, fmt.Errorf("invalid JSON file: %w", err)
	}
	// has_activity and last_activity are mutually exclusive; if has_activity is present,
	// last_activity is totally ignored.
	if out.HasActivity != nil {
		// has_activity is true, the workspace is active at the probe end time
		if *out.HasActivity {
			return &endTime, nil
		}

		// has_activity is false, the workspace is inactive, preserve existing lastActivity
		return nil, nil
	}

	// last_activity provided (and has_activity is omitted).
	if out.LastActivity != nil {
		t, err := parseISO8601(*out.LastActivity)
		if err != nil {
			return nil, fmt.Errorf("invalid JSON file: %w", err)
		}
		return &t, nil
	}

	// JSON object with neither field: treat as active at probe end time (same as empty output).
	return &endTime, nil
}

// parseISO8601 parses an ISO 8601 / RFC 3339 timestamp.
func parseISO8601(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, fmt.Errorf("empty timestamp")
	}
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		// try with nanosecond precision (RFC3339Nano) as a fallback.
		t, err = time.Parse(time.RFC3339Nano, value)
		if err != nil {
			return time.Time{}, fmt.Errorf("cannot parse timestamp %q: %w", value, err)
		}
	}
	return t, nil
}

// randomOutputPath generates a randomized path under /tmp for the podExec probe output file.
func randomOutputPath() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return fmt.Sprintf("/tmp/.ws-activity-probe-%s.json", hex.EncodeToString(buf)), nil
}

// exitCodeFromError extracts a command exit code from an exec error, if present.
//
// The Kubernetes remotecommand executor returns errors implementing the
// `k8s.io/client-go/util/exec.ExitError` interface (which exposes ExitStatus()) when a
// remote command exits with a non-zero status code. errors.As is used so the exit code is
// still recovered even if the error is wrapped.
func exitCodeFromError(err error) (int, bool) {
	var codeErr interface{ ExitStatus() int }
	if errors.As(err, &codeErr) {
		return codeErr.ExitStatus(), true
	}
	return 0, false
}

// limitedBuffer bounds the maximum number of bytes written into the buffer to prevent
// memory exhaustion from misbehaving probe processes.
type limitedBuffer struct {
	bytes.Buffer
	max int
}

func (b *limitedBuffer) Write(p []byte) (n int, err error) {
	if b.Len() >= b.max {
		return len(p), nil
	}
	if b.Len()+len(p) > b.max {
		p = p[:b.max-b.Len()]
	}
	return b.Buffer.Write(p)
}
