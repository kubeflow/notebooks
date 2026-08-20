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
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

// generateNetworkPolicy generates a NetworkPolicy restricting ingress to a
// Workspace's pods to the configured routing layer.
//
// Selecting the pod is enough to deny everything else: once any ingress policy
// selects a pod, traffic that no policy allows is dropped. No separate
// default-deny policy is needed in the workspace namespace.
func (r *WorkspaceReconciler) generateNetworkPolicy(workspace *kubefloworgv1beta1.Workspace) *networkingv1.NetworkPolicy {
	cfg := r.Config.WorkspaceNetworkPolicy

	peer := networkingv1.NetworkPolicyPeer{
		NamespaceSelector: &metav1.LabelSelector{
			MatchLabels: map[string]string{
				namespaceNameLabel: cfg.IngressNamespace,
			},
		},
	}
	if len(cfg.IngressPodSelector) > 0 {
		peer.PodSelector = &metav1.LabelSelector{MatchLabels: cfg.IngressPodSelector}
	}

	return &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: generateNamePrefix(workspace.Name, maxNetworkPolicyNameLength),
			Namespace:    workspace.Namespace,
			Labels: map[string]string{
				workspaceNameLabel: workspace.Name,
			},
		},
		Spec: networkingv1.NetworkPolicySpec{
			// Mirrors the StatefulSet's pod selector.
			PodSelector: metav1.LabelSelector{
				MatchLabels: map[string]string{
					workspaceNameLabel:     workspace.Name,
					workspaceSelectorLabel: workspace.Name,
				},
			},
			Ingress: []networkingv1.NetworkPolicyIngressRule{
				{From: []networkingv1.NetworkPolicyPeer{peer}},
			},
			PolicyTypes: []networkingv1.PolicyType{networkingv1.PolicyTypeIngress},
		},
	}
}
