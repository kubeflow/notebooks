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

package controller

import (
	"fmt"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

var _ = Describe("VirtualService Generation", func() {
	var (
		workspaceName     string
		workspaceKindName string
		reconciler        *WorkspaceReconciler
		workspace         *kubefloworgv1beta1.Workspace
		workspaceKind     *kubefloworgv1beta1.WorkspaceKind
		service           *corev1.Service
		imageConfigSpec   kubefloworgv1beta1.ImageConfigSpec
		namespaceName     string
	)

	BeforeEach(func() {
		uniqueName := "ws-virtualservice-test"
		workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
		workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
		namespaceName = "default"

		reconciler = &WorkspaceReconciler{
			Config: &config.EnvConfig{
				ClusterDomain: "cluster.local",
			},
		}
		workspaceKind = NewExampleWorkspaceKind1(workspaceKindName)
		workspace = NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
		service = &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("ws-%s", workspaceName),
				Namespace: namespaceName,
			},
		}
		imageConfigSpec = workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec
	})

	It("should not rewrite the URI when `removePathPrefix` is false", func() {
		By("generating the VirtualService")
		workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RemovePathPrefix = new(false)
		virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
		Expect(err).NotTo(HaveOccurred())

		By("checking the HTTP route has no rewrite")
		Expect(virtualService.Spec.Http).To(HaveLen(1))
		Expect(virtualService.Spec.Http[0].Rewrite).To(BeNil())
	})

	It("should rewrite the URI to '/' when `removePathPrefix` is true", func() {
		By("generating the VirtualService")
		workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RemovePathPrefix = new(true)
		virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
		Expect(err).NotTo(HaveOccurred())

		By("checking the HTTP route rewrites the URI to '/'")
		Expect(virtualService.Spec.Http).To(HaveLen(1))
		Expect(virtualService.Spec.Http[0].Rewrite).NotTo(BeNil())
		Expect(virtualService.Spec.Http[0].Rewrite.Uri).To(Equal("/"))
	})

	It("should not rewrite the URI when `httpProxy` is not set", func() {
		By("generating the VirtualService")
		workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy = nil
		virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
		Expect(err).NotTo(HaveOccurred())

		By("checking the HTTP route has no rewrite")
		Expect(virtualService.Spec.Http).To(HaveLen(1))
		Expect(virtualService.Spec.Http[0].Rewrite).To(BeNil())
	})

	It("should render go templates in `requestHeaders` values", func() {
		By("generating the VirtualService")
		workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
			Set: map[string]string{
				"X-RStudio-Root-Path": `{{ httpPathPrefix "jupyterlab" }}`,
			},
		}
		virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
		Expect(err).NotTo(HaveOccurred())

		By("checking the rendered header value")
		Expect(virtualService.Spec.Http).To(HaveLen(1))
		Expect(virtualService.Spec.Http[0].Headers.Request.Set).To(HaveKeyWithValue(
			"X-RStudio-Root-Path", getWorkspaceConnectPath(workspace.Namespace, workspace.Name, "jupyterlab"),
		))
	})

	It("should fail to generate when a `requestHeaders` value has an invalid go template", func() {
		By("generating the VirtualService")
		workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
			Set: map[string]string{
				"X-RStudio-Root-Path": `{{ httpPathPrefix 'jupyterlab' }}`,
			},
		}
		_, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
		Expect(err).To(HaveOccurred())
	})
})
