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
	"net/http"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("NewRequestAuthenticator", func() {
	const (
		userHeader   = "X-User"
		groupsHeader = "X-Groups"
		userPrefix   = "service-account:"
	)

	type authTestInput struct {
		userHeaderValue     string
		groupsHeaderValue   string
		userPrefix          string
		expectAuthenticated bool
		expectedUserName    string
		expectedGroups      []string
	}

	runAuthTest := func(input authTestInput) {
		authn, err := NewRequestAuthenticator(userHeader, input.userPrefix, groupsHeader)
		Expect(err).NotTo(HaveOccurred())

		req, _ := http.NewRequest("GET", "/", http.NoBody)
		if input.userHeaderValue != "" {
			req.Header.Set(userHeader, input.userHeaderValue)
		}
		if input.groupsHeaderValue != "" {
			req.Header.Set(groupsHeader, input.groupsHeaderValue)
		}

		resp, ok, err := authn.AuthenticateRequest(req)
		Expect(err).NotTo(HaveOccurred())
		Expect(ok).To(Equal(input.expectAuthenticated))
		if input.expectAuthenticated {
			Expect(resp).NotTo(BeNil())
			Expect(resp.User.GetName()).To(Equal(input.expectedUserName))
			Expect(resp.User.GetGroups()).To(Equal(input.expectedGroups))
		} else {
			Expect(resp).To(BeNil())
		}
	}
	It("authenticates user without prefix", func() {
		runAuthTest(authTestInput{
			userHeaderValue:     "test-user",
			groupsHeaderValue:   "group-a,group-b",
			userPrefix:          "",
			expectAuthenticated: true,
			expectedUserName:    "test-user",
			expectedGroups:      []string{"group-a,group-b"},
		})
	})

	It("authenticates user and trims prefix", func() {
		runAuthTest(authTestInput{
			userHeaderValue:     userPrefix + "test-user",
			groupsHeaderValue:   "group-c",
			userPrefix:          userPrefix,
			expectAuthenticated: true,
			expectedUserName:    "test-user",
			expectedGroups:      []string{"group-c"},
		})
	})

	It("authenticates user when prefix is configured but not present", func() {
		runAuthTest(authTestInput{
			userHeaderValue:     "another-user",
			groupsHeaderValue:   "",
			userPrefix:          userPrefix,
			expectAuthenticated: true,
			expectedUserName:    "another-user",
			expectedGroups:      []string{},
		})
	})

	It("handles unauthenticated request", func() {
		runAuthTest(authTestInput{
			userHeaderValue:     "",
			groupsHeaderValue:   "some-group",
			userPrefix:          userPrefix,
			expectAuthenticated: false,
		})
	})
})
