// Copyright 2024.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/repositories"
)

var _ = Describe("Workspace YAML Handler", Ordered, func() {
	const namespaceName = "namespace-yaml"

	var (
		a                 *App
		workspace         *kubefloworgv1beta1.Workspace
		workspaceKey      types.NamespacedName
		workspaceKindName string
	)

	BeforeAll(func() {
		uniqueName := "wsk-yaml-test"
		workspaceName := fmt.Sprintf("workspace-%s", uniqueName)
		workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)

		logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
		repos := repositories.NewRepositories(k8sClient)
		a = &App{
			Config: &config.EnvConfig{
				Port: 4000,
			},
			repositories: repos,
			logger:       logger,
		}

		By("creating namespace")
		namespace := &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: namespaceName,
			},
		}
		Expect(k8sClient.Create(ctx, namespace)).To(Succeed())

		By("creating a WorkspaceKind")
		workspaceKind := NewExampleWorkspaceKind(workspaceKindName)
		Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

		By("creating the Workspace")
		workspace = NewExampleWorkspace(workspaceName, namespaceName, workspaceKindName)
		Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}
	})

	AfterAll(func() {
		By("cleaning up resources")
		workspace := &kubefloworgv1beta1.Workspace{}
		if err := k8sClient.Get(ctx, workspaceKey, workspace); err == nil {
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())
		}

		workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
			ObjectMeta: metav1.ObjectMeta{
				Name: workspaceKindName,
			},
		}
		if err := k8sClient.Get(ctx, client.ObjectKeyFromObject(workspaceKind), workspaceKind); err == nil {
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		}

		namespace := &corev1.Namespace{
			ObjectMeta: metav1.ObjectMeta{
				Name: namespaceName,
			},
		}
		if err := k8sClient.Get(ctx, client.ObjectKeyFromObject(namespace), namespace); err == nil {
			Expect(k8sClient.Delete(ctx, namespace)).To(Succeed())
		}
	})

	It("should retrieve the workspace YAML successfully", func() {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/workspaces/%s/%s/details/yaml", namespaceName, workspaceKey.Name), http.NoBody)
		rr := httptest.NewRecorder()

		ps := httprouter.Params{
			{Key: "namespace", Value: namespaceName},
			{Key: "name", Value: workspaceKey.Name},
		}

		a.GetWorkspaceYAMLHandler(rr, req, ps)

		Expect(rr.Code).To(Equal(http.StatusOK))

		var response WorkspaceYAMLEnvelope
		Expect(json.NewDecoder(rr.Body).Decode(&response)).To(Succeed())

		Expect(response.Data).To(ContainSubstring(fmt.Sprintf("name: %s", workspaceKey.Name)))
		Expect(response.Data).To(ContainSubstring(fmt.Sprintf("namespace: %s", namespaceName)))
	})

	It("should return 404 when workspace doesn't exist", func() {
		req := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/workspaces/%s/non-existent/details/yaml", namespaceName), http.NoBody)
		rr := httptest.NewRecorder()

		ps := httprouter.Params{
			{Key: "namespace", Value: namespaceName},
			{Key: "name", Value: "non-existent"},
		}

		a.GetWorkspaceYAMLHandler(rr, req, ps)

		Expect(rr.Code).To(Equal(http.StatusNotFound))
	})
})
