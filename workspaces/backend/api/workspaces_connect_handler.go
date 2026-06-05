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

package api

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	"github.com/julienschmidt/httprouter"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/api/constants"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

var dialTcp = net.Dial

// checkOrigin implements same-origin checks for WebSocket connections to protect against CSWSH.
// TODO: Currently we only perform strict same-origin matching (Origin == Host) if the Origin header is set,
// because CORS relies on a wildcard allow-all policy (see enableCORS in middleware.go).
// Once the REST API CORS policy is restricted to a curated/configured whitelist of trusted origins,
// this CheckOrigin logic must be updated to validate the parsed Origin against that same whitelist
// to support allowed cross-origin browser environments.
func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		// Allow non-browser clients (e.g. CLI tools, dynamic tunnel clients) which don't send an Origin header
		return true
	}

	u, err := url.Parse(origin)
	if err != nil {
		return false
	}

	return strings.EqualFold(u.Host, r.Host)
}

// ConnectWorkspaceHandler handles bidirectional TCP proxying over a WebSocket connection.
func (a *App) ConnectWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(constants.NamespacePathParam)
	workspaceName := ps.ByName(constants.ResourceNamePathParam)
	port := ps.ByName("port")

	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateKubernetesNamespaceName(field.NewPath(constants.NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateWorkspaceName(field.NewPath(constants.ResourceNamePathParam), workspaceName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// check if is authorized
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(auth.VerbConnect, auth.Workspaces, auth.ResourcePolicyResourceMeta{Namespace: namespace, Name: workspaceName}),
	}
	if _, ok := a.requireAuth(w, r, authPolicies); !ok {
		return
	}

	// Lookup actual Kubernetes Service name dynamically via repository
	svc, err := a.repositories.Workspace.GetWorkspaceService(r.Context(), namespace, workspaceName)
	if err != nil {
		a.logger.Error("Failed to lookup Workspace Service", "namespace", namespace, "workspaceName", workspaceName, "error", err)
		a.notFoundResponse(w, r)
		return
	}

	// Upgrade connection to WebSocket
	upgrader := websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}
	if !a.Config.DisableAuth {
		upgrader.CheckOrigin = checkOrigin
	}
	wsConn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		a.logger.Error("Failed to upgrade connection to WebSocket", "error", err)
		return
	}
	defer wsConn.Close()

	// Dial internal TCP Service for Workspace using dynamically looked up service name
	targetAddress := fmt.Sprintf("%s.%s.svc:%s", svc.Name, namespace, port)
	tcpConn, err := dialTcp("tcp", targetAddress)
	if err != nil {
		a.logger.Error("Failed to dial internal TCP service", "address", targetAddress, "error", err)
		// Send a close message to WebSocket client
		wsConn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, "Failed to connect to target service"))
		return
	}
	defer tcpConn.Close()

	var wg sync.WaitGroup
	wg.Add(2)

	// TCP -> WebSocket (read from pod, send as BinaryMessage)
	go func() {
		defer wg.Done()
		defer wsConn.Close()
		defer tcpConn.Close()
		buf := make([]byte, 32*1024)
		for {
			n, err := tcpConn.Read(buf)
			if n > 0 {
				if wErr := wsConn.WriteMessage(websocket.BinaryMessage, buf[:n]); wErr != nil {
					a.logger.Debug("Failed to write binary message to WebSocket", "error", wErr)
					return
				}
			}
			if err != nil {
				if err != io.EOF {
					a.logger.Error("Error reading from TCP connection", "error", err)
				}
				return
			}
		}
	}()

	// WebSocket -> TCP (read binary/text from client, write to pod)
	go func() {
		defer wg.Done()
		defer wsConn.Close()
		defer tcpConn.Close()
		for {
			msgType, msgBytes, err := wsConn.ReadMessage()
			if err != nil {
				if !websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
					a.logger.Error("Error reading from WebSocket", "error", err)
				}
				return
			}
			if msgType == websocket.BinaryMessage || msgType == websocket.TextMessage {
				_, err = tcpConn.Write(msgBytes)
				if err != nil {
					a.logger.Error("Failed to write to TCP connection", "error", err)
					return
				}
			}
		}
	}()

	wg.Wait()
}
