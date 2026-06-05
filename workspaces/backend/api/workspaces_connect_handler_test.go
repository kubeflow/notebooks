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
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"

	"github.com/gorilla/websocket"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("Workspaces Connect Handler (SSH WebSocket Bridge)", func() {
	var (
		mockTCPListener net.Listener
		mockTCPPort     string
		dialOverride    func(network, address string) (net.Conn, error)
		originalDialTcp func(network, address string) (net.Conn, error)
		testServer      *httptest.Server
		wsClient        *websocket.Conn
		wg              sync.WaitGroup
	)

	BeforeEach(func() {
		originalDialTcp = dialTcp

		// Start local mock TCP Listener (representing the target container sshd)
		var err error
		mockTCPListener, err = net.Listen("tcp", "127.0.0.1:0")
		Expect(err).NotTo(HaveOccurred())

		_, mockTCPPort, err = net.SplitHostPort(mockTCPListener.Addr().String())
		Expect(err).NotTo(HaveOccurred())

		// Intercept dialTcp calls to redirect them to the local mock TCP Listener
		dialOverride = func(network, address string) (net.Conn, error) {
			return net.Dial("tcp", mockTCPListener.Addr().String())
		}
		dialTcp = dialOverride

		// Spin up real HTTP test server to allow WebSocket upgrades
		testServer = httptest.NewServer(a.Routes())
	})

	AfterEach(func() {
		dialTcp = originalDialTcp
		if wsClient != nil {
			wsClient.Close()
		}
		if testServer != nil {
			testServer.Close()
		}
		if mockTCPListener != nil {
			mockTCPListener.Close()
		}
		wg.Wait()
	})

	It("should stream bytes bidirectionally between WebSocket and TCP socket", func() {
		namespace := "default"
		workspaceName := "my-ssh-workspace"

		// 1. Setup mock Workspace to pass validation
		wsObj := NewExampleWorkspace(workspaceName, namespace, "jupyterlab")
		Expect(k8sClient.Create(ctx, wsObj)).To(Succeed())

		// Setup mock Service with standard matching labels to pass connection lookup
		svcObj := &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "my-ssh-workspace-service",
				Namespace: namespace,
				Labels: map[string]string{
					"notebooks.kubeflow.org/workspace-name": workspaceName,
				},
			},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{
					{
						Name: "http-22",
						Port: 22,
					},
				},
			},
		}
		Expect(k8sClient.Create(ctx, svcObj)).To(Succeed())

		defer func() {
			Expect(k8sClient.Delete(ctx, wsObj)).To(Succeed())
			Expect(k8sClient.Delete(ctx, svcObj)).To(Succeed())
		}()

		// 2. Setup the mock TCP target handler to respond
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer GinkgoRecover()

			tcpConn, err := mockTCPListener.Accept()
			if err != nil {
				return // Server stopped
			}
			defer tcpConn.Close()

			// Verify we receive SSH client handshake or test string
			buf := make([]byte, 1024)
			n, err := tcpConn.Read(buf)
			Expect(err).NotTo(HaveOccurred())
			Expect(string(buf[:n])).To(Equal("SSH-2.0-OpenSSH_mock_client"))

			// Send mock SSH server handshake response back
			_, err = tcpConn.Write([]byte("SSH-2.0-OpenSSH_mock_server"))
			Expect(err).NotTo(HaveOccurred())
		}()

		// 3. Construct WebSocket URL
		// Path: /api/v1/workspaces/:namespace/:name/connect/:port
		wsURL := fmt.Sprintf("%s/api/v1/workspaces/%s/%s/connect/%s", testServer.URL, namespace, workspaceName, mockTCPPort)
		wsURL = strings.Replace(wsURL, "http://", "ws://", 1)

		// 4. Connect WebSocket Client with Auth headers
		var err error
		headers := http.Header{}
		headers.Set(userIdHeader, adminUser)
		wsClient, _, err = websocket.DefaultDialer.Dial(wsURL, headers)
		Expect(err).NotTo(HaveOccurred())

		// 5. Send client message
		err = wsClient.WriteMessage(websocket.BinaryMessage, []byte("SSH-2.0-OpenSSH_mock_client"))
		Expect(err).NotTo(HaveOccurred())

		// 6. Read server response
		msgType, msgBytes, err := wsClient.ReadMessage()
		Expect(err).NotTo(HaveOccurred())
		Expect(msgType).To(Equal(websocket.BinaryMessage))
		Expect(string(msgBytes)).To(Equal("SSH-2.0-OpenSSH_mock_server"))
	})
})
