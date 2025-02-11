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

package auth

import (
	"fmt"
	"net/http"
	"strings"

	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/headerrequest"
	"k8s.io/apiserver/pkg/authentication/user"
)

// NewRequestAuthenticator returns a new request authenticator based on the provided configuration.
func NewRequestAuthenticator(useridHeader string, useridPrefix string, groupsHeader string) (authenticator.Request, error) {

	// create an upstream `requestHeaderAuthRequestHandler` to extract user and groups from the request headers
	requestHeaderAuthenticator, err := headerrequest.New(
		[]string{useridHeader},
		[]string{groupsHeader},
		nil,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request header authenticator: %w", err)
	}

	// if the user id prefix is empty, return the upstream authenticator as is
	if useridPrefix == "" {
		return requestHeaderAuthenticator, nil
	}

	// wrap the upstream authenticator to trim the user prefix from the user id
	requestAuthenticator := authenticator.RequestFunc(func(req *http.Request) (*authenticator.Response, bool, error) {
		response, ok, err := requestHeaderAuthenticator.AuthenticateRequest(req)
		if err != nil {
			return nil, false, err
		}

		// if the request was not authenticated, return the response as is
		if !ok {
			return response, ok, nil
		}

		// trim the user id prefix from the username
		return &authenticator.Response{
			User: &user.DefaultInfo{
				Name:   strings.TrimPrefix(response.User.GetName(), useridPrefix),
				Groups: response.User.GetGroups(),
				Extra:  response.User.GetExtra(),
			},
		}, true, nil
	})

	return requestAuthenticator, nil
}
