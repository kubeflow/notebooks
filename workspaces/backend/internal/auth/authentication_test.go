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
	"net/http/httptest"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

func TestAuth(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Auth Suite")
}

var _ = Describe("NewRequestAuthenticator", func() {

	const (
		useridHeader = "kubeflow-userid"
		groupsHeader = "kubeflow-groups"
	)

	It("should authenticate user and groups when useridPrefix is empty", func() {
		authn, err := NewRequestAuthenticator(useridHeader, "", groupsHeader)
		Expect(err).NotTo(HaveOccurred())

		req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
		req.Header.Set(useridHeader, "alice@example.com")
		req.Header.Add(groupsHeader, "team-a")
		req.Header.Add(groupsHeader, "team-b")

		resp, ok, err := authn.AuthenticateRequest(req)
		Expect(err).NotTo(HaveOccurred())
		Expect(ok).To(BeTrue())
		Expect(resp.User.GetName()).To(Equal("alice@example.com"))
		Expect(resp.User.GetGroups()).To(ConsistOf("team-a", "team-b"))
	})

	It("should trim useridPrefix from authenticated username", func() {
		authn, err := NewRequestAuthenticator(useridHeader, "accounts.google.com:", groupsHeader)
		Expect(err).NotTo(HaveOccurred())

		req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
		req.Header.Set(useridHeader, "accounts.google.com:bob@example.com")
		req.Header.Set(groupsHeader, "devs")

		resp, ok, err := authn.AuthenticateRequest(req)
		Expect(err).NotTo(HaveOccurred())
		Expect(ok).To(BeTrue())
		Expect(resp.User.GetName()).To(Equal("bob@example.com"))
		Expect(resp.User.GetGroups()).To(ConsistOf("devs"))
	})

	It("should keep username unchanged if it does not match useridPrefix", func() {
		authn, err := NewRequestAuthenticator(useridHeader, "prefix:", groupsHeader)
		Expect(err).NotTo(HaveOccurred())

		req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
		req.Header.Set(useridHeader, "charlie@example.com")

		resp, ok, err := authn.AuthenticateRequest(req)
		Expect(err).NotTo(HaveOccurred())
		Expect(ok).To(BeTrue())
		Expect(resp.User.GetName()).To(Equal("charlie@example.com"))
	})

	It("should return unauthenticated when userid header is missing", func() {
		authn, err := NewRequestAuthenticator(useridHeader, "prefix:", groupsHeader)
		Expect(err).NotTo(HaveOccurred())

		req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)

		resp, ok, err := authn.AuthenticateRequest(req)
		Expect(err).NotTo(HaveOccurred())
		Expect(ok).To(BeFalse())
		Expect(resp).To(BeNil())
	})

	It("should return an error when useridHeader is empty", func() {
		authn, err := NewRequestAuthenticator("", "", groupsHeader)
		Expect(err).To(MatchError(ContainSubstring("failed to create request header authenticator")))
		Expect(authn).To(BeNil())
	})
})
