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
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

var _ = Describe("Gateway API HTTPRoute Generation", func() {
	var (
		reconciler    *WorkspaceReconciler
		workspace     *kubefloworgv1beta1.Workspace
		workspaceKind *kubefloworgv1beta1.WorkspaceKind
		service       *corev1.Service
		imageSpec     kubefloworgv1beta1.ImageConfigSpec
	)

	BeforeEach(func() {
		reconciler = &WorkspaceReconciler{
			Config: &config.EnvConfig{
				GatewayName:  "kubeflow-gateway",
				GatewayHosts: "notebooks.example.com,*.kubeflow.org",
			},
		}

		workspace = &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "test-workspace",
				Namespace: "test-namespace",
			},
		}

		workspaceKind = &kubefloworgv1beta1.WorkspaceKind{
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
					Ports: []kubefloworgv1beta1.WorkspaceKindPort{
						{
							Id:       "jupyterlab",
							Protocol: kubefloworgv1beta1.ImagePortProtocolHTTP,
							HTTPProxy: &kubefloworgv1beta1.HTTPProxy{
								RemovePathPrefix: new(bool),
							},
						},
					},
				},
			},
		}

		service = &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name: "test-workspace-service",
			},
		}

		imageSpec = kubefloworgv1beta1.ImageConfigSpec{
			Ports: []kubefloworgv1beta1.ImagePort{
				{
					Id:   "jupyterlab",
					Port: 8888,
				},
			},
		}
	})

	Context("Positive behavior", func() {
		It("should generate a valid HTTPRoute with correct routing rules", func() {
			route := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageSpec)

			Expect(route).NotTo(BeNil())
			Expect(route.Namespace).To(Equal("test-namespace"))
			Expect(route.Labels[workspaceNameLabel]).To(Equal("test-workspace"))
			Expect(route.Spec.ParentRefs).To(HaveLen(1))
			Expect(route.Spec.ParentRefs[0].Name).To(Equal(gatewayv1.ObjectName("kubeflow-gateway")))

			Expect(route.Spec.Hostnames).To(HaveLen(2))
			Expect(route.Spec.Hostnames[0]).To(Equal(gatewayv1.Hostname("notebooks.example.com")))
			Expect(route.Spec.Hostnames[1]).To(Equal(gatewayv1.Hostname("*.kubeflow.org")))

			Expect(route.Spec.Rules).To(HaveLen(1))

			// Match logic
			rule := route.Spec.Rules[0]
			Expect(rule.Matches).To(HaveLen(1))
			Expect(*rule.Matches[0].Path.Value).To(Equal("/workspace/connect/test-namespace/test-workspace/jupyterlab/"))

			// Backend ref
			Expect(rule.BackendRefs).To(HaveLen(1))
			Expect(rule.BackendRefs[0].Name).To(Equal(gatewayv1.ObjectName("test-workspace-service")))
			Expect(*rule.BackendRefs[0].Port).To(Equal(gatewayv1.PortNumber(8888)))

			// Filters logic
			Expect(rule.Filters).To(HaveLen(1))
			Expect(rule.Filters[0].Type).To(Equal(gatewayv1.HTTPRouteFilterURLRewrite))
			Expect(*rule.Filters[0].URLRewrite.Path.ReplacePrefixMatch).To(Equal("/workspace/connect/test-namespace/test-workspace/jupyterlab/"))
		})

		It("should generate HTTPRoute removing path prefix when requested", func() {
			removePathPrefix := true
			workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RemovePathPrefix = &removePathPrefix
			route := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageSpec)

			Expect(route.Spec.Rules).To(HaveLen(1))
			rule := route.Spec.Rules[0]

			// Should have NO URLRewrite filter if RemovePathPrefix is true
			Expect(rule.Filters).To(BeEmpty())
		})

		It("should inject request header modifiers when specified", func() {
			workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
				Set:    map[string]string{"X-Test-Set": "set-val"},
				Add:    map[string]string{"X-Test-Add": "add-val"},
				Remove: []string{"X-Test-Remove"},
			}

			route := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageSpec)

			Expect(route.Spec.Rules).To(HaveLen(1))
			rule := route.Spec.Rules[0]

			// Should have Rewrite + RequestHeaderModifier
			Expect(rule.Filters).To(HaveLen(2))
			var headerFilter *gatewayv1.HTTPHeaderFilter
			for _, f := range rule.Filters {
				if f.Type == gatewayv1.HTTPRouteFilterRequestHeaderModifier {
					headerFilter = f.RequestHeaderModifier
				}
			}
			Expect(headerFilter).NotTo(BeNil())
			Expect(headerFilter.Set).To(HaveLen(1))
			Expect(string(headerFilter.Set[0].Name)).To(Equal("X-Test-Set"))
			Expect(headerFilter.Add).To(HaveLen(1))
			Expect(string(headerFilter.Add[0].Name)).To(Equal("X-Test-Add"))
			Expect(headerFilter.Remove).To(HaveLen(1))
			Expect(headerFilter.Remove[0]).To(Equal("X-Test-Remove"))
		})
	})

	Context("Negative behavior", func() {
		It("should skip generating rules for ports that exist in imageSpec but not in workspaceKind", func() {
			imageSpec.Ports = append(imageSpec.Ports, kubefloworgv1beta1.ImagePort{
				Id:   "unknown-port",
				Port: 9999,
			})

			route := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageSpec)

			// Still only 1 rule for the matching port
			Expect(route.Spec.Rules).To(HaveLen(1))
		})

		It("should skip generating rules for non-HTTP ports", func() {
			workspaceKind.Spec.PodTemplate.Ports[0].Protocol = "TCP"

			route := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageSpec)

			// No rules should be generated
			Expect(route.Spec.Rules).To(BeEmpty())
		})

		It("should handle empty gateway hosts gracefully", func() {
			reconciler.Config.GatewayHosts = ""
			route := reconciler.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageSpec)

			Expect(route.Spec.Hostnames).To(BeEmpty())
		})
	})
})
