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

package main

import (
	"crypto/tls"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/websocket"
)

func main() {
	var namespace, workspace, port, server, userid, userHeader string
	var insecure bool
	flag.StringVar(&namespace, "namespace", "default", "Kubernetes namespace")
	flag.StringVar(&workspace, "workspace", "", "Workspace name")
	flag.StringVar(&port, "port", "22", "Target SSH port")
	flag.StringVar(&server, "server", "localhost:4000", "Backend API server host (e.g. localhost:4000 or https://192.168.8.8/workspaces)")
	flag.StringVar(&userid, "userid", "notebooks-admin", "Authenticated user ID header value")
	flag.StringVar(&userHeader, "user-header", "kubeflow-userid", "Header key containing the authenticated user ID")
	flag.BoolVar(&insecure, "insecure", true, "Skip TLS certificate verification for HTTPS/WSS")
	flag.Parse()

	if workspace == "" {
		log.Fatal("Error: -workspace parameter is required")
	}

	// Determine WebSocket scheme and trim any URL protocol prefix from server
	scheme := "ws"
	if strings.HasPrefix(server, "https://") {
		scheme = "wss"
		server = strings.TrimPrefix(server, "https://")
	} else if strings.HasPrefix(server, "http://") {
		server = strings.TrimPrefix(server, "http://")
	}

	// Route: ws://<server>/api/v1/workspaces/<namespace>/<workspace>/connect/<port>
	wsURL := fmt.Sprintf("%s://%s/api/v1/workspaces/%s/%s/connect/%s", scheme, server, namespace, workspace, port)

	headers := http.Header{}
	headers.Set(userHeader, userid)

	dialer := websocket.DefaultDialer
	if insecure {
		dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}
	}

	wsConn, resp, err := dialer.Dial(wsURL, headers)
	if err != nil {
		if resp != nil {
			log.Printf("Handshake failed with HTTP status: %s", resp.Status)
			for k, v := range resp.Header {
				log.Printf("Header: %s = %v", k, v)
			}
		}
		log.Fatalf("Failed to connect to WebSocket bridge: %v", err)
	}
	defer wsConn.Close()

	errChan := make(chan error, 2)

	// WebSocket -> Stdout
	go func() {
		for {
			msgType, reader, err := wsConn.NextReader()
			if err != nil {
				errChan <- err
				return
			}
			if msgType == websocket.BinaryMessage || msgType == websocket.TextMessage {
				if _, err := io.Copy(os.Stdout, reader); err != nil {
					errChan <- err
					return
				}
				os.Stdout.Sync()
			}
		}
	}()

	// Stdin -> WebSocket
	go func() {
		buf := make([]byte, 32*1024)
		for {
			n, err := os.Stdin.Read(buf)
			if n > 0 {
				writer, wErr := wsConn.NextWriter(websocket.BinaryMessage)
				if wErr != nil {
					errChan <- wErr
					return
				}
				if _, wErr = writer.Write(buf[:n]); wErr != nil {
					errChan <- wErr
					return
				}
				writer.Close()
			}
			if err != nil {
				errChan <- err
				return
			}
		}
	}()

	<-errChan
}
