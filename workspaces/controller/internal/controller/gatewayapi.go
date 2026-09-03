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
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/utils/ptr"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	gatewayv1 "sigs.k8s.io/gateway-api/apis/v1"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
)

const maxRouteNameLength = 63

// reconcileHTTPRoute ensures the Workspace owns exactly one HTTPRoute matching the desired spec.
// When done is true the caller must return result and err immediately.
func (r *WorkspaceReconciler) reconcileHTTPRoute(ctx context.Context, log logr.Logger, workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, service *corev1.Service, imageConfigSpec kubefloworgv1beta1.ImageConfigSpec) (result ctrl.Result, done bool, err error) {
	httpRoute := r.generateGatewayAPIHTTPRoute(workspace, workspaceKind, service, imageConfigSpec)
	if err := ctrl.SetControllerReference(workspace, httpRoute, r.Scheme); err != nil {
		log.Error(err, "unable to set controller reference on HTTPRoute")
		return ctrl.Result{}, true, err
	}

	ownedHTTPRoutes := &gatewayv1.HTTPRouteList{}
	listOpts := &client.ListOptions{
		FieldSelector: fields.OneTermEqualSelector(helper.IndexWorkspaceOwnerField, workspace.Name),
		Namespace:     workspace.Namespace,
	}
	if err := r.List(ctx, ownedHTTPRoutes, listOpts); err != nil {
		log.Error(err, "unable to list HTTPRoutes")
		return ctrl.Result{}, true, err
	}

	switch numHTTPRoutes := len(ownedHTTPRoutes.Items); {
	case numHTTPRoutes > 1:
		httpRouteList := make([]string, len(ownedHTTPRoutes.Items))
		for i, hr := range ownedHTTPRoutes.Items {
			httpRouteList[i] = hr.Name
		}
		httpRouteListString := strings.Join(httpRouteList, ", ")
		log.Error(nil, "Workspace owns multiple HTTPRoutes", "httpRoutes", httpRouteListString)
		result, err := r.updateWorkspaceState(ctx, log, workspace,
			kubefloworgv1beta1.WorkspaceStateError,
			fmt.Sprintf("Workspace owns multiple HTTPRoutes: %s", httpRouteListString),
		)
		return result, true, err
	case numHTTPRoutes == 0:
		if err := r.Create(ctx, httpRoute); err != nil {
			log.Error(err, "unable to create HTTPRoute")
			return ctrl.Result{}, true, err
		}
		log.V(2).Info("HTTPRoute created", "httpRoute", httpRoute.Name)
	default:
		foundHTTPRoute := &ownedHTTPRoutes.Items[0]
		foundHTTPRoute.Spec = httpRoute.Spec
		if err := r.Update(ctx, foundHTTPRoute); err != nil {
			if apierrors.IsConflict(err) {
				log.V(2).Info("update conflict while updating HTTPRoute, will requeue")
				return ctrl.Result{Requeue: true}, true, nil
			}
			log.Error(err, "unable to update HTTPRoute")
			return ctrl.Result{}, true, err
		}
		log.V(2).Info("HTTPRoute updated", "httpRoute", foundHTTPRoute.Name)
	}
	return ctrl.Result{}, false, nil
}

// generateGatewayAPIHTTPRoute generates an HTTPRoute for a Workspace using the Gateway API
func (r *WorkspaceReconciler) generateGatewayAPIHTTPRoute(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, service *corev1.Service, imageConfigSpec kubefloworgv1beta1.ImageConfigSpec) *gatewayv1.HTTPRoute {
	namePrefix := generateNamePrefix(workspace.Name, maxRouteNameLength)

	currentPodTemplatePortsMap := make(map[kubefloworgv1beta1.PortId]kubefloworgv1beta1.WorkspaceKindPort)
	for _, port := range workspaceKind.Spec.PodTemplate.Ports {
		currentPodTemplatePortsMap[port.Id] = port
	}

	rules := []gatewayv1.HTTPRouteRule{}
	for _, imageConfigPort := range imageConfigSpec.Ports {
		if _, exists := currentPodTemplatePortsMap[imageConfigPort.Id]; !exists {
			continue
		}
		podTemplatePort := currentPodTemplatePortsMap[imageConfigPort.Id]

		if podTemplatePort.Protocol == kubefloworgv1beta1.ImagePortProtocolHTTP {
			matchUriPrefix := getWorkspaceConnectPath(workspace.Namespace, workspace.Name, imageConfigPort.Id)

			match := gatewayv1.HTTPRouteMatch{
				Path: &gatewayv1.HTTPPathMatch{
					Type:  ptr.To(gatewayv1.PathMatchPathPrefix),
					Value: &matchUriPrefix,
				},
			}

			// filters (ExternalAuth, Rewrite and Headers)
			filters := []gatewayv1.HTTPRouteFilter{}

			if !ptr.Deref(podTemplatePort.HTTPProxy.RemovePathPrefix, false) {
				filters = append(filters, gatewayv1.HTTPRouteFilter{
					Type: gatewayv1.HTTPRouteFilterURLRewrite,
					URLRewrite: &gatewayv1.HTTPURLRewriteFilter{
						Path: &gatewayv1.HTTPPathModifier{
							Type:               gatewayv1.PrefixMatchHTTPPathModifier,
							ReplacePrefixMatch: &matchUriPrefix,
						},
					},
				})
			}

			if podTemplatePort.HTTPProxy.RequestHeaders != nil {
				var reqHeaderFilter gatewayv1.HTTPHeaderFilter
				if len(podTemplatePort.HTTPProxy.RequestHeaders.Set) > 0 {
					for k, v := range podTemplatePort.HTTPProxy.RequestHeaders.Set {
						reqHeaderFilter.Set = append(reqHeaderFilter.Set, gatewayv1.HTTPHeader{Name: gatewayv1.HTTPHeaderName(k), Value: v})
					}
				}
				if len(podTemplatePort.HTTPProxy.RequestHeaders.Add) > 0 {
					for k, v := range podTemplatePort.HTTPProxy.RequestHeaders.Add {
						reqHeaderFilter.Add = append(reqHeaderFilter.Add, gatewayv1.HTTPHeader{Name: gatewayv1.HTTPHeaderName(k), Value: v})
					}
				}
				if len(podTemplatePort.HTTPProxy.RequestHeaders.Remove) > 0 {
					reqHeaderFilter.Remove = append(reqHeaderFilter.Remove, podTemplatePort.HTTPProxy.RequestHeaders.Remove...)
				}
				if len(reqHeaderFilter.Set) > 0 || len(reqHeaderFilter.Add) > 0 || len(reqHeaderFilter.Remove) > 0 {
					filters = append(filters, gatewayv1.HTTPRouteFilter{
						Type:                  gatewayv1.HTTPRouteFilterRequestHeaderModifier,
						RequestHeaderModifier: &reqHeaderFilter,
					})
				}
			}

			backendRef := gatewayv1.HTTPBackendRef{
				BackendRef: gatewayv1.BackendRef{
					BackendObjectReference: gatewayv1.BackendObjectReference{
						Name: gatewayv1.ObjectName(service.Name),
						Port: new(imageConfigPort.Port),
					},
				},
			}

			rules = append(rules, gatewayv1.HTTPRouteRule{
				Matches:     []gatewayv1.HTTPRouteMatch{match},
				Filters:     filters,
				BackendRefs: []gatewayv1.HTTPBackendRef{backendRef},
			})
		}
	}

	var hostnames []gatewayv1.Hostname
	for h := range strings.SplitSeq(r.Config.GatewayHosts, ",") {
		h = strings.TrimSpace(h)
		if h != "" && h != "*" {
			hostnames = append(hostnames, gatewayv1.Hostname(h))
		}
	}

	httpRoute := &gatewayv1.HTTPRoute{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: namePrefix,
			Namespace:    workspace.Namespace,
			Labels: map[string]string{
				workspaceNameLabel: workspace.Name,
			},
		},
		Spec: gatewayv1.HTTPRouteSpec{
			CommonRouteSpec: gatewayv1.CommonRouteSpec{
				ParentRefs: []gatewayv1.ParentReference{
					parseGatewayRef(r.Config.GatewayName),
				},
			},
			Hostnames: hostnames,
			Rules:     rules,
		},
	}

	return httpRoute
}

// parseGatewayRef builds the parentRef for the configured Gateway, accepting
// either "name" or "namespace/name".
//
// Workspace routes live in user namespaces while the Gateway usually does not,
// so the namespace has to be carried in its own field rather than inline the
// way Istio's VirtualService gateways field allows.
func parseGatewayRef(gateway string) gatewayv1.ParentReference {
	namespace, name, hasNamespace := strings.Cut(gateway, "/")
	if !hasNamespace {
		name = gateway
	}

	ref := gatewayv1.ParentReference{Name: gatewayv1.ObjectName(name)}
	if hasNamespace && namespace != "" {
		ref.Namespace = new(gatewayv1.Namespace(namespace))
	}
	return ref
}
