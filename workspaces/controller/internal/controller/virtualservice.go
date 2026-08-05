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

	networkingv1 "istio.io/api/networking/v1"
	istiov1 "istio.io/client-go/pkg/apis/networking/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
)

// generateVirtualServiceHTTPRoute creates an HTTPRoute for a given port configuration
func (r *WorkspaceReconciler) generateVirtualServiceHTTPRoute(
	workspace *kubefloworgv1beta1.Workspace,
	service *corev1.Service,
	imageConfigPort kubefloworgv1beta1.ImagePort,
	podTemplatePort kubefloworgv1beta1.WorkspaceKindPort,
	httpPathPrefixFunc func(kubefloworgv1beta1.PortId) string,
) (*networkingv1.HTTPRoute, error) {

	// generate the match URI prefix
	matchUriPrefix := getWorkspaceConnectPath(workspace.Namespace, workspace.Name, imageConfigPort.Id)

	// determine rewrite configuration
	//  - when removePathPrefix is true, rewrite the matched prefix to "/" so the
	//    upstream receives the path with the connect prefix stripped
	var httpRouteRewrite *networkingv1.HTTPRewrite
	if podTemplatePort.HTTPProxy != nil && ptr.Deref(podTemplatePort.HTTPProxy.RemovePathPrefix, false) {
		httpRouteRewrite = &networkingv1.HTTPRewrite{
			Uri: "/",
		}
	}

	// determine headers configuration
	var httpRouteHeaders *networkingv1.Headers
	if podTemplatePort.HTTPProxy != nil && podTemplatePort.HTTPProxy.RequestHeaders != nil {
		var setHeaders map[string]string
		if podTemplatePort.HTTPProxy.RequestHeaders.Set != nil {
			setHeaders = make(map[string]string, len(podTemplatePort.HTTPProxy.RequestHeaders.Set))
			for k, v := range podTemplatePort.HTTPProxy.RequestHeaders.Set {
				rendered, err := helper.RenderGoTemplate(v, httpPathPrefixFunc)
				if err != nil {
					return nil, fmt.Errorf("failed to render requestHeaders.set %q: %w", k, err)
				}
				setHeaders[k] = rendered
			}
		}

		var addHeaders map[string]string
		if podTemplatePort.HTTPProxy != nil && podTemplatePort.HTTPProxy.RequestHeaders.Add != nil {
			addHeaders = make(map[string]string, len(podTemplatePort.HTTPProxy.RequestHeaders.Add))
			for k, v := range podTemplatePort.HTTPProxy.RequestHeaders.Add {
				rendered, err := helper.RenderGoTemplate(v, httpPathPrefixFunc)
				if err != nil {
					return nil, fmt.Errorf("failed to render requestHeaders.add %q: %w", k, err)
				}
				addHeaders[k] = rendered
			}
		}

		httpRouteHeaders = &networkingv1.Headers{
			Request: &networkingv1.Headers_HeaderOperations{
				Set:    setHeaders,
				Add:    addHeaders,
				Remove: podTemplatePort.HTTPProxy.RequestHeaders.Remove,
			},
		}
	}

	// construct the HTTPRoute with all fields
	httpRoute := &networkingv1.HTTPRoute{
		Headers: httpRouteHeaders,
		Rewrite: httpRouteRewrite,
		Match: []*networkingv1.HTTPMatchRequest{
			{
				Uri: &networkingv1.StringMatch{
					MatchType: &networkingv1.StringMatch_Prefix{
						Prefix: matchUriPrefix,
					},
				},
			},
		},
		Route: []*networkingv1.HTTPRouteDestination{
			{
				Destination: &networkingv1.Destination{
					Host: fmt.Sprintf("%s.%s.svc.%s", service.Name, service.Namespace, r.Config.ClusterDomain),
					Port: &networkingv1.PortSelector{
						Number: uint32(imageConfigPort.Port), //nolint:gosec
					},
				},
			},
		},
	}

	return httpRoute, nil
}

// generateVirtualService generates a VirtualService for a Workspace
func (r *WorkspaceReconciler) generateVirtualService(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, service *corev1.Service, imageConfigSpec kubefloworgv1beta1.ImageConfigSpec) (*istiov1.VirtualService, error) {
	// NOTE: the name prefix is used to generate a unique name for the VirtualService
	namePrefix := generateNamePrefix(workspace.Name, maxRouteNameLength)

	currentPodTemplatePortsMap := make(map[kubefloworgv1beta1.PortId]kubefloworgv1beta1.WorkspaceKindPort)
	for _, port := range workspaceKind.Spec.PodTemplate.Ports {
		currentPodTemplatePortsMap[port.Id] = port
	}

	imageConfigPortsMap := make(map[kubefloworgv1beta1.PortId]kubefloworgv1beta1.ImagePort)
	for _, port := range imageConfigSpec.Ports {
		imageConfigPortsMap[port.Id] = port
	}

	httpPathPrefixFunc := func(portId kubefloworgv1beta1.PortId) string {
		port, ok := imageConfigPortsMap[portId]
		if ok {
			return getWorkspaceConnectPath(workspace.Namespace, workspace.Name, port.Id)
		} else {
			return ""
		}
	}

	httpRoutes := []*networkingv1.HTTPRoute{}
	for _, imageConfigPort := range imageConfigSpec.Ports {
		// silently ignore port ids not defined in the workspace kind
		// NOTE: this should not be possible as the webhook blocks undefined ports
		if _, exists := currentPodTemplatePortsMap[imageConfigPort.Id]; !exists {
			continue
		}

		podTemplatePort := currentPodTemplatePortsMap[imageConfigPort.Id]

		// Additional Cases would be added for SSH, etc.
		switch podTemplatePort.Protocol { //nolint:gocritic
		case kubefloworgv1beta1.ImagePortProtocolHTTP:
			httpRoute, err := r.generateVirtualServiceHTTPRoute(workspace, service, imageConfigPort, podTemplatePort, httpPathPrefixFunc)
			if err != nil {
				return nil, err
			}
			httpRoutes = append(httpRoutes, httpRoute)
		}
	}

	virtualService := &istiov1.VirtualService{
		ObjectMeta: metav1.ObjectMeta{
			GenerateName: namePrefix,
			Namespace:    workspace.Namespace,
			Labels: map[string]string{
				workspaceNameLabel: workspace.Name,
			},
		},
		Spec: networkingv1.VirtualService{
			Gateways: []string{r.Config.IstioGateway},
			Hosts:    []string{r.Config.IstioHosts},
			Http:     httpRoutes,
		},
	}

	return virtualService, nil
}
