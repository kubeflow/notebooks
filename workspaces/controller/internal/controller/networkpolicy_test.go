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
	networkingv1 "k8s.io/api/networking/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

var _ = Describe("Workspace NetworkPolicy Generation", func() {
	var (
		reconciler *WorkspaceReconciler
		workspace  *kubefloworgv1beta1.Workspace
	)

	BeforeEach(func() {
		workspaceName := fmt.Sprintf("workspace-%s", "ws-networkpolicy-test")
		reconciler = &WorkspaceReconciler{
			Config: &config.EnvConfig{
				RoutingProvider: config.RoutingProviderGatewayAPI,
				WorkspaceNetworkPolicy: config.WorkspaceNetworkPolicyConfig{
					Enabled:          true,
					IngressNamespace: "kubeflow",
					IngressPodSelector: map[string]string{
						"gateway.networking.k8s.io/gateway-name": "kubeflow-gateway",
					},
				},
			},
		}
		workspace = NewExampleWorkspace1(workspaceName, "my-ns", "workspacekind-test")
	})

	It("should select the workspace pods", func() {
		networkPolicy := reconciler.generateNetworkPolicy(workspace)
		Expect(networkPolicy).NotTo(BeNil())
		Expect(networkPolicy.Namespace).To(Equal("my-ns"))
		Expect(networkPolicy.Spec.PodSelector.MatchLabels).To(HaveKeyWithValue(workspaceNameLabel, workspace.Name))
		Expect(networkPolicy.Spec.PodSelector.MatchLabels).To(HaveKeyWithValue(workspaceSelectorLabel, workspace.Name))
	})

	// Selecting the pod is what makes everything not explicitly allowed a deny,
	// so the policy type must stay on the object even though only one rule is set.
	It("should restrict ingress only", func() {
		networkPolicy := reconciler.generateNetworkPolicy(workspace)
		Expect(networkPolicy.Spec.PolicyTypes).To(ConsistOf(networkingv1.PolicyTypeIngress))
	})

	It("should allow only the configured routing layer", func() {
		networkPolicy := reconciler.generateNetworkPolicy(workspace)
		Expect(networkPolicy.Spec.Ingress).To(HaveLen(1))
		Expect(networkPolicy.Spec.Ingress[0].From).To(HaveLen(1))

		peer := networkPolicy.Spec.Ingress[0].From[0]
		Expect(peer.NamespaceSelector).NotTo(BeNil())
		Expect(peer.NamespaceSelector.MatchLabels).To(HaveKeyWithValue(namespaceNameLabel, "kubeflow"))
		Expect(peer.PodSelector).NotTo(BeNil())
		Expect(peer.PodSelector.MatchLabels).To(
			HaveKeyWithValue("gateway.networking.k8s.io/gateway-name", "kubeflow-gateway"))
		Expect(peer.IPBlock).To(BeNil())
	})

	It("should allow the whole ingress namespace when no pod selector is set", func() {
		reconciler.Config.WorkspaceNetworkPolicy.IngressPodSelector = nil
		networkPolicy := reconciler.generateNetworkPolicy(workspace)

		peer := networkPolicy.Spec.Ingress[0].From[0]
		Expect(peer.NamespaceSelector).NotTo(BeNil())
		Expect(peer.PodSelector).To(BeNil())
	})

	It("should name the policy after the workspace", func() {
		networkPolicy := reconciler.generateNetworkPolicy(workspace)
		Expect(networkPolicy.GenerateName).To(ContainSubstring("ws-"))
		Expect(networkPolicy.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspace.Name))
	})
})
