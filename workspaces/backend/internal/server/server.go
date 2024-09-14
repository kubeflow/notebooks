package server

import (
	"context"
	"errors"
	"fmt"
	"github.com/kubeflow/notebooks/workspaces/backend/api"
	"log/slog"
	"net"
	"net/http"
	ctrl "sigs.k8s.io/controller-runtime"
	"time"
)

type Server struct {
	logger   *slog.Logger
	listener net.Listener
	server   *http.Server
}

func NewServer(app *api.App, logger *slog.Logger) (*Server, error) {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", app.Config.Port))
	if err != nil {
		return nil, fmt.Errorf("failed to create listener: %w", err)
	}

	svc := &http.Server{
		Addr:              fmt.Sprintf(":%d", app.Config.Port),
		Handler:           app.Routes(),
		IdleTimeout:       90 * time.Second, // matches http.DefaultTransport keep-alive timeout
		ReadTimeout:       32 * time.Second,
		ReadHeaderTimeout: 32 * time.Second,
		WriteTimeout:      32 * time.Second,
		ErrorLog:          slog.NewLogLogger(logger.Handler(), slog.LevelError),
	}
	svr := &Server{
		logger:   logger,
		listener: listener,
		server:   svc,
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
// Blocks until the context is cancelled
func (s *Server) Start(ctx context.Context) error {
	serverShutdown := make(chan struct{})
	go func() {
		<-ctx.Done()
		s.logger.Info("shutting down server")
		if err := s.server.Shutdown(context.Background()); err != nil {
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
