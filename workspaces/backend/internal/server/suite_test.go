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

package server_test

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"strings"
	"testing"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/kubeflow/notebooks/workspaces/backend/api"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/server"
)

const (
	serverStartupTimeout  = 5 * time.Second
	serverShutdownTimeout = 2 * time.Second
	pollInterval          = 100 * time.Millisecond
	dialTimeout           = 500 * time.Millisecond
)

func TestServer(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Server Suite")
}

var _ = Describe("Server Component", func() {
	var (
		testServer *server.Server
		testApp    *api.App
		testLogger *slog.Logger
		ctx        context.Context
		cancel     context.CancelFunc
		testPort   int
		err        error
	)

	// findFreePort is a helper to get an available TCP port, preventing test conflicts.
	findFreePort := func() (int, error) {
		listener, err := net.Listen("tcp", "localhost:0")
		if err != nil {
			return 0, err
		}
		defer listener.Close()
		return listener.Addr().(*net.TCPAddr).Port, nil
	}

	BeforeEach(func() {
		ctx, cancel = context.WithCancel(context.Background())
		testLogger = slog.New(slog.NewTextHandler(GinkgoWriter, nil))
		testPort, err = findFreePort()
		Expect(err).NotTo(HaveOccurred(), "failed to find a free port for the test server")

		// Create a minimal App config. Disabling auth is key for this simple unit test.
		appConfig := &config.EnvConfig{
			Port:        testPort,
			DisableAuth: true,
		}

		// Create the minimal App instance needed by the server.
		// We pass 'nil' for Kubernetes dependencies because they are not needed for this test.
		testApp, err = api.NewApp(appConfig, testLogger, nil, nil, nil, nil)
		Expect(err).NotTo(HaveOccurred())
	})

	AfterEach(func() {
		cancel()
	})

	Context("when managing the server lifecycle", func() {
		It("should start, listen on the correct port, and shut down gracefully", func() {
			var err error
			By("creating a new server instance")
			testServer, err = server.NewServer(testApp, testLogger)
			Expect(err).NotTo(HaveOccurred())
			Expect(testServer).NotTo(BeNil())

			serverErrChan := make(chan error, 1)
			By("starting the server in a background goroutine")
			go func() {
				defer GinkgoRecover()
				serverErrChan <- testServer.Start(ctx)
			}()

			serverAddr := fmt.Sprintf("localhost:%d", testPort)
			By("verifying the server is listening on " + serverAddr)
			// Eventually checks that the TCP port becomes available.
			Eventually(func() error {
				conn, err := net.DialTimeout("tcp", serverAddr, dialTimeout)
				if err != nil {
					return err
				}
				conn.Close()
				return nil
			}, serverStartupTimeout, pollInterval).Should(Succeed())

			By("triggering a graceful shutdown")
			cancel()

			By("verifying the server's Start method returns nil for a clean shutdown")
			Eventually(serverErrChan, serverStartupTimeout).Should(Receive(BeNil()))

			By("verifying the server is no longer listening")
			// Consistently checks that the port remains closed and specifically for connection refused.
			Consistently(func() error {
				_, err := net.DialTimeout("tcp", serverAddr, dialTimeout)
				return err
			}, serverShutdownTimeout, pollInterval).Should(
				WithTransform(func(e error) bool { // Transform the error into a boolean for assertion
					if e == nil {
						return false // If error is nil, connection succeeded, which is NOT desired.
					}
					return strings.Contains(e.Error(), "connection refused") ||
						strings.Contains(e.Error(), "dial tcp")
				}, BeTrue()), "Server port should be closed after shutdown and return a connection refused error",
			)
		})
	})
})
