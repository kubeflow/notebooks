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

// Command authz is the external authorization service for Kubeflow Workspaces.
//
// It authenticates callers against an OIDC issuer and authorizes them against
// Kubernetes RBAC, and serves that decision over both protocols named by the
// Gateway API ExternalAuth filter (GEP-1494): Envoy's ext_authz gRPC service and
// HTTP forward-auth. The same gRPC service is what Istio's AuthorizationPolicy
// CUSTOM action calls, so one deployment covers both routing providers.
package main

import (
	"context"
	"encoding/base64"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	authv3 "github.com/envoyproxy/go-control-plane/envoy/service/auth/v3"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health"
	healthv1 "google.golang.org/grpc/health/grpc_health_v1"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/log/zap"

	"github.com/kubeflow/notebooks/workspaces/authz/internal/check"
	"github.com/kubeflow/notebooks/workspaces/authz/internal/kube"
	"github.com/kubeflow/notebooks/workspaces/authz/internal/oidc"
	"github.com/kubeflow/notebooks/workspaces/authz/internal/server"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "fatal: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	var (
		grpcAddr   string
		httpAddr   string
		pathPrefix string

		oidcCfg      oidc.Config
		cookieKeyB64 string

		userIDHeader string
		groupsHeader string
	)

	flag.StringVar(&grpcAddr, "grpc-bind-address", getEnv("GRPC_BIND_ADDRESS", ":9001"),
		"Address the Envoy ext_authz gRPC service binds to")
	flag.StringVar(&httpAddr, "http-bind-address", getEnv("HTTP_BIND_ADDRESS", ":9002"),
		"Address the HTTP forward-auth service and OIDC callback endpoints bind to")
	flag.StringVar(&pathPrefix, "http-path-prefix", getEnv("HTTP_PATH_PREFIX", ""),
		"Value of the ExternalAuth filter's http.path field, stripped from incoming forward-auth paths")

	flag.StringVar(&oidcCfg.IssuerURL, "oidc-issuer-url", getEnv("OIDC_ISSUER_URL", ""),
		"OIDC issuer URL, which must be the issuer the API server is configured with")
	flag.StringVar(&oidcCfg.ClientID, "oidc-client-id", getEnv("OIDC_CLIENT_ID", ""),
		"OIDC client ID")
	flag.StringVar(&oidcCfg.ClientSecret, "oidc-client-secret", os.Getenv("OIDC_CLIENT_SECRET"),
		"OIDC client secret (prefer the OIDC_CLIENT_SECRET environment variable)")
	flag.StringVar(&oidcCfg.RedirectURL, "oidc-redirect-url", getEnv("OIDC_REDIRECT_URL", ""),
		"Absolute URL of the OIDC callback endpoint served by this service")
	flag.StringVar(&oidcCfg.UsernameClaim, "oidc-username-claim", getEnv("OIDC_USERNAME_CLAIM", "email"),
		"ID token claim to use as the username; must match the API server's --oidc-username-claim")
	flag.StringVar(&oidcCfg.UsernamePrefix, "oidc-username-prefix", getEnv("OIDC_USERNAME_PREFIX", ""),
		"Prefix prepended to the username; must match the API server's --oidc-username-prefix")
	flag.StringVar(&oidcCfg.GroupsClaim, "oidc-groups-claim", getEnv("OIDC_GROUPS_CLAIM", "groups"),
		"ID token claim to use as groups; must match the API server's --oidc-groups-claim")
	flag.StringVar(&oidcCfg.GroupsPrefix, "oidc-groups-prefix", getEnv("OIDC_GROUPS_PREFIX", ""),
		"Prefix prepended to each group; must match the API server's --oidc-groups-prefix")
	flag.StringVar(&oidcCfg.CookieName, "cookie-name", getEnv("COOKIE_NAME", "kubeflow-workspaces-session"),
		"Name of the session cookie")
	flag.BoolVar(&oidcCfg.CookieSecure, "cookie-secure", getEnvAsBool("COOKIE_SECURE", true),
		"Set the Secure attribute on cookies")
	flag.StringVar(&cookieKeyB64, "cookie-key", os.Getenv("COOKIE_KEY"),
		"Base64-encoded 32-byte key used to encrypt session cookies (prefer the COOKIE_KEY environment variable)")

	flag.StringVar(&userIDHeader, "userid-header", getEnv("USERID_HEADER", "kubeflow-userid"),
		"Identity header set on authorized requests")
	flag.StringVar(&groupsHeader, "groups-header", getEnv("GROUPS_HEADER", "kubeflow-groups"),
		"Groups header set on authorized requests")

	zapOpts := zap.Options{Development: false}
	zapOpts.BindFlags(flag.CommandLine)
	flag.Parse()

	log := zap.New(zap.UseFlagOptions(&zapOpts))
	ctrl.SetLogger(log)

	if oidcCfg.IssuerURL == "" || oidcCfg.ClientID == "" || oidcCfg.RedirectURL == "" {
		return errors.New("--oidc-issuer-url, --oidc-client-id and --oidc-redirect-url are required")
	}

	cookieKey, err := base64.StdEncoding.DecodeString(strings.TrimSpace(cookieKeyB64))
	if err != nil {
		return fmt.Errorf("decoding --cookie-key: %w", err)
	}
	if len(cookieKey) != oidc.SessionKeyLength {
		return fmt.Errorf("--cookie-key must decode to %d bytes, got %d", oidc.SessionKeyLength, len(cookieKey))
	}
	oidcCfg.CookieKey = cookieKey

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	restConfig, err := rest.InClusterConfig()
	if err != nil {
		restConfig, err = ctrl.GetConfig()
		if err != nil {
			return fmt.Errorf("loading Kubernetes configuration: %w", err)
		}
	}

	authorizer, err := kube.NewAuthorizer(restConfig)
	if err != nil {
		return err
	}

	authenticator, err := oidc.New(ctx, oidcCfg)
	if err != nil {
		return err
	}

	checker := &check.Checker{
		Authenticator: authenticator,
		Authorizer:    authorizer,
		UserIDHeader:  userIDHeader,
		GroupsHeader:  groupsHeader,
	}

	grpcServer := grpc.NewServer()
	authv3.RegisterAuthorizationServer(grpcServer, &server.GRPC{Checker: checker, Log: log.WithName("grpc")})
	healthv1.RegisterHealthServer(grpcServer, health.NewServer())

	mux := http.NewServeMux()
	authenticator.RegisterRoutes(mux, log.WithName("oidc"))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.Handle("/", &server.HTTP{Checker: checker, Log: log.WithName("http"), PathPrefix: pathPrefix})

	httpServer := &http.Server{
		Addr:              httpAddr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errs := make(chan error, 2)

	go func() {
		listener, err := net.Listen("tcp", grpcAddr)
		if err != nil {
			errs <- fmt.Errorf("listening on %s: %w", grpcAddr, err)
			return
		}
		log.Info("serving ext_authz gRPC", "address", grpcAddr)
		errs <- grpcServer.Serve(listener)
	}()

	go func() {
		log.Info("serving forward-auth HTTP", "address", httpAddr)
		err := httpServer.ListenAndServe()
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		errs <- err
	}()

	select {
	case <-ctx.Done():
		log.Info("shutting down")
	case err := <-errs:
		if err != nil {
			return err
		}
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := httpServer.Shutdown(shutdownCtx); err != nil {
		log.Error(err, "shutting down HTTP server")
	}
	grpcServer.GracefulStop()

	return nil
}

func getEnv(name, defaultValue string) string {
	if value, ok := os.LookupEnv(name); ok {
		return value
	}
	return defaultValue
}

func getEnvAsBool(name string, defaultValue bool) bool {
	switch strings.ToLower(os.Getenv(name)) {
	case "true", "1":
		return true
	case "false", "0":
		return false
	default:
		return defaultValue
	}
}
