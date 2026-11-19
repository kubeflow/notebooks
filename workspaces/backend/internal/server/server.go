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

package server

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"

	ctrl "sigs.k8s.io/controller-runtime"

	"github.com/kubeflow/notebooks/workspaces/backend/api"
)

const (
	maxHeaderBytes = 1 << 17 // 128 KiB - default is 1MiB
	maxBodyBytes   = 1 << 22 // 4 MiB - default is unlimited
)

// WarmUpFunc is run by the server before it starts serving requests.
// If it returns an error, the server (and therefore the manager) fails to start.
type WarmUpFunc func(ctx context.Context) error

type Server struct {
	logger   *slog.Logger
	listener net.Listener
	server   *http.Server
	warmUp   WarmUpFunc
}

// NewServer creates a new server for the app.
// The optional warmUp function is run in Start, before any request is served.
func NewServer(app *api.App, logger *slog.Logger, warmUp WarmUpFunc) (*Server, error) {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", app.Config.Port))
	if err != nil {
		return nil, fmt.Errorf("failed to create listener: %w", err)
	}

	svc := &http.Server{
		Addr:              fmt.Sprintf(":%d", app.Config.Port),
		Handler:           http.MaxBytesHandler(app.Routes(), maxBodyBytes),
		IdleTimeout:       90 * time.Second, // matches http.DefaultTransport keep-alive timeout
		ReadTimeout:       32 * time.Second,
		ReadHeaderTimeout: 32 * time.Second,
		WriteTimeout:      32 * time.Second,
		MaxHeaderBytes:    maxHeaderBytes,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
	svr := &Server{
		logger:   logger,
		listener: listener,
		server:   svc,
		warmUp:   warmUp,
	}

	return svr, nil
}

// SetupWithManager sets up the app with a controller-runtime manager
func (s *Server) SetupWithManager(mgr ctrl.Manager) error {
	err := mgr.Add(s)
	if err != nil {
		return err
	}
	return nil
}

// Start starts the server
// Blocks until the context is canceled
func (s *Server) Start(ctx context.Context) error {
	if s.warmUp != nil {
		s.logger.Info("warming up server")
		if err := s.warmUp(ctx); err != nil {
			_ = s.listener.Close()
			if ctx.Err() != nil {
				// we are shutting down, so this is not a startup failure
				return nil
			}
			return fmt.Errorf("failed to warm up server: %w", err)
		}
		s.logger.Info("server warm up complete")
	}

	serverShutdown := make(chan struct{})
	go func() {
		<-ctx.Done()
		s.logger.Info("shutting down server")
		if err := s.server.Shutdown(context.WithoutCancel(ctx)); err != nil {
			s.logger.Error("error shutting down server", "error", err)
		}
		close(serverShutdown)
	}()

	s.logger.Info("starting server", "addr", s.server.Addr)
	if err := s.server.Serve(s.listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	<-serverShutdown
	return nil
}

// NeedLeaderElection returns false because this app does not need leader election from the manager
func (s *Server) NeedLeaderElection() bool {
	return false
}
