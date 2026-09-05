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

// Package server exposes the authorization decision over the two protocols
// named by the Gateway API ExternalAuth filter: Envoy's ext_authz gRPC service
// and plain HTTP forward-auth.
package server

import (
	"context"
	"net/http"
	"sort"

	corev3 "github.com/envoyproxy/go-control-plane/envoy/config/core/v3"
	authv3 "github.com/envoyproxy/go-control-plane/envoy/service/auth/v3"
	typev3 "github.com/envoyproxy/go-control-plane/envoy/type/v3"
	"github.com/go-logr/logr"
	rpcstatus "google.golang.org/genproto/googleapis/rpc/status"
	"google.golang.org/grpc/codes"

	"github.com/kubeflow/notebooks/workspaces/authz/internal/check"
)

// GRPC implements the Envoy ext_authz v3 Authorization service.
type GRPC struct {
	authv3.UnimplementedAuthorizationServer

	Checker *check.Checker
	Log     logr.Logger
}

// Check implements authv3.AuthorizationServer.
//
// A non-nil error return makes the data plane fail closed, which is what the
// Gateway API ExternalAuth filter requires when the auth service is unreachable
// or erroring. Denials are returned as a successful RPC with a DeniedResponse.
func (s *GRPC) Check(ctx context.Context, req *authv3.CheckRequest) (*authv3.CheckResponse, error) {
	httpReq := req.GetAttributes().GetRequest().GetHttp()

	headers := http.Header{}
	for name, value := range httpReq.GetHeaders() {
		headers.Add(name, value)
	}

	decision, err := s.Checker.Check(ctx, &check.Request{
		Method:  httpReq.GetMethod(),
		Path:    stripQuery(httpReq.GetPath()),
		Host:    httpReq.GetHost(),
		Scheme:  httpReq.GetScheme(),
		Headers: headers,
	})
	if err != nil {
		s.Log.Error(err, "check failed", "path", stripQuery(httpReq.GetPath()))
		return nil, err
	}

	if decision.Allow {
		return &authv3.CheckResponse{
			Status: &rpcstatus.Status{Code: int32(codes.OK)},
			HttpResponse: &authv3.CheckResponse_OkResponse{
				OkResponse: &authv3.OkHttpResponse{
					Headers: headerValueOptions(decision.UpstreamHeaders),
				},
			},
		}, nil
	}

	return &authv3.CheckResponse{
		Status: &rpcstatus.Status{Code: int32(codes.PermissionDenied)},
		HttpResponse: &authv3.CheckResponse_DeniedResponse{
			DeniedResponse: &authv3.DeniedHttpResponse{
				Status:  &typev3.HttpStatus{Code: typev3.StatusCode(decision.Status)},
				Headers: headerValueOptions(decision.ResponseHeaders),
				Body:    decision.Body,
			},
		},
	}, nil
}

// headerValueOptions converts headers to Envoy's wire format. The first value of
// each key overwrites any existing header, and further values are appended, so
// that a client-supplied header can never survive alongside one this service
// sets.
func headerValueOptions(headers http.Header) []*corev3.HeaderValueOption {
	names := make([]string, 0, len(headers))
	for name := range headers {
		names = append(names, name)
	}
	sort.Strings(names)

	options := make([]*corev3.HeaderValueOption, 0, len(names))
	for _, name := range names {
		for i, value := range headers[name] {
			action := corev3.HeaderValueOption_OVERWRITE_IF_EXISTS_OR_ADD
			if i > 0 {
				action = corev3.HeaderValueOption_APPEND_IF_EXISTS_OR_ADD
			}
			options = append(options, &corev3.HeaderValueOption{
				Header:       &corev3.HeaderValue{Key: name, Value: value},
				AppendAction: action,
			})
		}
	}
	return options
}

func stripQuery(path string) string {
	for i := range len(path) {
		if path[i] == '?' {
			return path[:i]
		}
	}
	return path
}
