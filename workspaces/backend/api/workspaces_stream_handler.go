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
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
)

const (
	// streamHeartbeatInterval is how often a comment "ping" is sent on an idle
	// stream to keep the connection alive through proxies/gateways.
	streamHeartbeatInterval = 20 * time.Second

	// streamDebounceInterval coalesces bursts of change notifications into a
	// single re-list, so a flurry of updates produces at most one snapshot per
	// interval instead of one per event.
	streamDebounceInterval = 250 * time.Millisecond
)

// isWatchRequest reports whether the request asked for a streaming watch via the
// `watch` query parameter (mirroring the Kubernetes API's `?watch=1`/`?watch=true`).
func isWatchRequest(r *http.Request) bool {
	switch r.URL.Query().Get("watch") {
	case "true", "1":
		return true
	default:
		return false
	}
}

// streamWorkspaces serves the workspace list as a Server-Sent Events stream. It
// emits an initial full-list snapshot, then a fresh snapshot whenever a Workspace
// in the requested namespace (or any namespace, when namespace is empty) changes.
// The caller is responsible for having already authenticated and authorized the
// request; authorization is evaluated once, at connection time.
func (a *App) streamWorkspaces(w http.ResponseWriter, r *http.Request, namespace string) {
	ctx := r.Context()

	// Set Server-Sent Events headers before the first write so downstream
	// wrappers (e.g. gzip) see the content type and skip buffering/compression.
	header := w.Header()
	header.Set("Content-Type", constants.MediaTypeEventStream)
	header.Set("Cache-Control", "no-cache")
	header.Set("Connection", "keep-alive")
	// Hint to reverse proxies (nginx/Envoy) not to buffer the response.
	header.Set("X-Accel-Buffering", "no")

	rc := http.NewResponseController(w)
	// Clear the server's WriteTimeout for this connection only; a long-lived
	// stream must not be torn down by the global deadline.
	if err := rc.SetWriteDeadline(time.Time{}); err != nil {
		a.logger.Warn("failed to clear write deadline for workspace stream", "error", err)
	}

	// Subscribe before sending the initial snapshot so no change that occurs
	// between listing and subscribing is missed.
	notifyCh, unsubscribe := a.Hub.Subscribe(namespace)
	defer unsubscribe()

	// Send the initial snapshot immediately.
	if !a.writeWorkspacesSnapshot(w, rc, r, namespace) {
		return
	}

	heartbeat := time.NewTicker(streamHeartbeatInterval)
	defer heartbeat.Stop()

	// debounce is lazily created on the first notification of a burst; while it
	// is running, further notifications are absorbed and collapse into one
	// re-list when it fires.
	var debounce *time.Timer
	var debounceCh <-chan time.Time
	stopDebounce := func() {
		if debounce != nil {
			debounce.Stop()
			debounce = nil
			debounceCh = nil
		}
	}
	defer stopDebounce()

	for {
		select {
		case <-ctx.Done():
			return

		case <-notifyCh:
			if debounce == nil {
				debounce = time.NewTimer(streamDebounceInterval)
				debounceCh = debounce.C
			}

		case <-debounceCh:
			debounce = nil
			debounceCh = nil
			if !a.writeWorkspacesSnapshot(w, rc, r, namespace) {
				return
			}

		case <-heartbeat.C:
			if _, err := fmt.Fprint(w, ": ping\n\n"); err != nil {
				return
			}
			if err := rc.Flush(); err != nil {
				return
			}
		}
	}
}

// writeWorkspacesSnapshot lists the current workspaces (from the same cache-backed
// client the non-streaming handler uses) and writes them as a single SSE `data:`
// event. It returns false if the client is gone or an unrecoverable error
// occurred, signaling the caller to close the stream.
func (a *App) writeWorkspacesSnapshot(w http.ResponseWriter, rc *http.ResponseController, r *http.Request, namespace string) bool {
	var workspaces []models.WorkspaceListItem
	var err error
	if namespace == "" {
		workspaces, err = a.repositories.Workspace.GetAllWorkspaces(r.Context())
	} else {
		workspaces, err = a.repositories.Workspace.GetWorkspaces(r.Context(), namespace)
	}
	if err != nil {
		a.logger.Error("failed to list workspaces for stream", "namespace", namespace, "error", err)
		// Best-effort notify the client of the error, then end the stream.
		_, _ = fmt.Fprint(w, "event: error\ndata: failed to list workspaces\n\n")
		_ = rc.Flush()
		return false
	}

	// json.Marshal produces no raw newlines, so the payload is a single SSE line.
	payload, err := json.Marshal(&WorkspaceListEnvelope{Data: workspaces})
	if err != nil {
		a.logger.Error("failed to marshal workspaces for stream", "error", err)
		return false
	}

	if _, err := fmt.Fprintf(w, "data: %s\n\n", payload); err != nil {
		return false
	}
	if err := rc.Flush(); err != nil {
		return false
	}
	return true
}
