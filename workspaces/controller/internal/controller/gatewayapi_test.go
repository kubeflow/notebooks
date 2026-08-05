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
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

var _ = Describe("Gateway API HTTPRoute Generation", func() {
	var (
		reconciler        *WorkspaceReconciler
		workspace         *kubefloworgv1beta1.Workspace
		workspaceKind     *kubefloworgv1beta1.WorkspaceKind
		service           *corev1.Service
		imageConfigSpec   kubefloworgv1beta1.ImageConfigSpec
		workspaceName     string
		workspaceKindName string
	)

	BeforeEach(func() {
		uniqueName := "ws-gatewayapi-test"
		workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
		workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
		namespaceName := "default"

		reconciler = &WorkspaceReconciler{
			Config: &config.EnvConfig{
				ClusterDomain: "cluster.local",
				GatewayName:   "kubeflow-gateway",
				GatewayHosts:  "example.com",
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

	It("should generate HTTPRoute with URLRewrite when removePathPrefix is false", func() {
		workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RemovePathPrefix = new(false)
		httpRoute := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageConfigSpec)
		Expect(httpRoute).NotTo(BeNil())
		Expect(httpRoute.Spec.ParentRefs).To(HaveLen(1))
		Expect(string(httpRoute.Spec.ParentRefs[0].Name)).To(Equal("kubeflow-gateway"))
		Expect(httpRoute.Spec.Rules).To(HaveLen(1))
		Expect(httpRoute.Spec.Rules[0].Filters).To(HaveLen(1))
		Expect(httpRoute.Spec.Rules[0].Filters[0].Type).To(Equal(gatewayv1.HTTPRouteFilterURLRewrite))
	})

	It("should generate HTTPRoute without URLRewrite filter when removePathPrefix is true", func() {
		*workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RemovePathPrefix = true
		httpRoute := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageConfigSpec)
		Expect(httpRoute).NotTo(BeNil())
		Expect(httpRoute.Spec.Rules).To(HaveLen(1))
		Expect(httpRoute.Spec.Rules[0].Filters).To(BeEmpty())
	})

	It("should populate header filters when requestHeaders are specified", func() {
		workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
			Set: map[string]string{
				"X-Custom-Header": "custom-value",
			},
			Add: map[string]string{
				"X-Add-Header": "add-value",
			},
			Remove: []string{"X-Remove-Header"},
		}
		httpRoute := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageConfigSpec)
		Expect(httpRoute).NotTo(BeNil())
		Expect(httpRoute.Spec.Rules[0].Filters).To(HaveLen(2)) // URLRewrite + RequestHeaderModifier
		var headerFilter *gatewayv1.HTTPHeaderFilter
		for _, f := range httpRoute.Spec.Rules[0].Filters {
			if f.Type == gatewayv1.HTTPRouteFilterRequestHeaderModifier {
				headerFilter = f.RequestHeaderModifier
				break
			}
		}
		Expect(headerFilter).NotTo(BeNil())
		Expect(headerFilter.Set).To(HaveLen(1))
		Expect(string(headerFilter.Set[0].Name)).To(Equal("X-Custom-Header"))
	})

	// Workspace routes are created in user namespaces, so a Gateway living
	// elsewhere has to be referenced with an explicit namespace.
	It("should split a namespaced gateway name into the parentRef namespace", func() {
		reconciler.Config.GatewayName = "kubeflow/kubeflow-gateway"
		httpRoute := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageConfigSpec)
		Expect(httpRoute.Spec.ParentRefs).To(HaveLen(1))
		Expect(string(httpRoute.Spec.ParentRefs[0].Name)).To(Equal("kubeflow-gateway"))
		Expect(httpRoute.Spec.ParentRefs[0].Namespace).NotTo(BeNil())
		Expect(string(*httpRoute.Spec.ParentRefs[0].Namespace)).To(Equal("kubeflow"))
	})

	It("should leave the parentRef namespace unset for a bare gateway name", func() {
		reconciler.Config.GatewayName = "kubeflow-gateway"
		httpRoute := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageConfigSpec)
		Expect(httpRoute.Spec.ParentRefs).To(HaveLen(1))
		Expect(string(httpRoute.Spec.ParentRefs[0].Name)).To(Equal("kubeflow-gateway"))
		Expect(httpRoute.Spec.ParentRefs[0].Namespace).To(BeNil())
	})
})
