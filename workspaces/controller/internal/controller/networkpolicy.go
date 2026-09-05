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
	"context"
	"fmt"
	"strings"

	"github.com/go-logr/logr"
	networkingv1 "k8s.io/api/networking/v1"
	"k8s.io/apimachinery/pkg/api/equality"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
)

const (
	namespaceNameLabel         = "kubernetes.io/metadata.name"
	maxNetworkPolicyNameLength = 63
)

// reconcileNetworkPolicy ensures the Workspace owns exactly one NetworkPolicy matching the desired spec.
// When done is true the caller must return result and err immediately.
func (r *WorkspaceReconciler) reconcileNetworkPolicy(ctx context.Context, log logr.Logger, workspace *kubefloworgv1beta1.Workspace) (result ctrl.Result, done bool, err error) {
	networkPolicy := r.generateNetworkPolicy(workspace)
	if err := ctrl.SetControllerReference(workspace, networkPolicy, r.Scheme); err != nil {
		log.Error(err, "unable to set controller reference on NetworkPolicy")
		return ctrl.Result{}, true, err
	}

	ownedNetworkPolicies := &networkingv1.NetworkPolicyList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceOwnerField, workspace.Name),
		Namespace:     workspace.Namespace,
	}
	if err := r.List(ctx, ownedNetworkPolicies, listOpts); err != nil {
		log.Error(err, "unable to list NetworkPolicies")
		return ctrl.Result{}, true, err
	}

	switch numNetworkPolicies := len(ownedNetworkPolicies.Items); {
	case numNetworkPolicies > 1:
		networkPolicyNames := make([]string, len(ownedNetworkPolicies.Items))
		for i, np := range ownedNetworkPolicies.Items {
			networkPolicyNames[i] = np.Name
		}
		networkPolicyListString := strings.Join(networkPolicyNames, ", ")
		log.Error(nil, "Workspace owns multiple NetworkPolicies", "networkPolicies", networkPolicyListString)
		result, err := r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf("Workspace owns multiple NetworkPolicies: %s", networkPolicyListString),
		)
		return result, true, err
	case numNetworkPolicies == 0:
		if err := r.Create(ctx, networkPolicy); err != nil {
			log.Error(err, "unable to create NetworkPolicy")
			return ctrl.Result{}, true, err
		}
		log.V(2).Info("NetworkPolicy created", "networkPolicy", networkPolicy.Name)
	default:
		foundNetworkPolicy := &ownedNetworkPolicies.Items[0]
		if !equality.Semantic.DeepEqual(foundNetworkPolicy.Spec, networkPolicy.Spec) {
			foundNetworkPolicy.Spec = networkPolicy.Spec
			if err := r.Update(ctx, foundNetworkPolicy); err != nil {
				if apierrors.IsConflict(err) {
					log.V(2).Info("update conflict while updating NetworkPolicy, will requeue")
					return ctrl.Result{Requeue: true}, true, nil
				}
				log.Error(err, "unable to update NetworkPolicy")
				return ctrl.Result{}, true, err
			}
			log.V(2).Info("NetworkPolicy updated", "networkPolicy", foundNetworkPolicy.Name)
		}
	}
	return ctrl.Result{}, false, nil
}

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
