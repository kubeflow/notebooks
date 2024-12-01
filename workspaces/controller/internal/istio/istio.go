package istio

import (
	"context"
	"fmt"
	"github.com/go-logr/logr"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/helper"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	ApiVersionIstio    = "networking.istio.io/v1"
	VirtualServiceKind = "VirtualService"

	EnvIstioHost    = "ISTIO_HOST"
	EnvIstioGateway = "ISTIO_GATEWAY"
	ClusterDomain   = "CLUSTER_DOMAIN"
)

func GenerateIstioVirtualService(workspace *kubefloworgv1beta1.Workspace, workspaceKind *kubefloworgv1beta1.WorkspaceKind, imageConfig *kubefloworgv1beta1.ImageConfigValue, serviceName string, _ logr.Logger) (*unstructured.Unstructured, error) {

	virtualService := &unstructured.Unstructured{}
	virtualService.SetAPIVersion(ApiVersionIstio)
	virtualService.SetKind(VirtualServiceKind)

	prefix := helper.GenerateNamePrefix(workspace.Name, helper.MaxServiceNameLength)
	virtualService.SetName(helper.RemoveTrailingDash(prefix))
	virtualService.SetNamespace(workspace.Namespace)

	// .spec.gateways
	istioGateway := helper.GetEnvOrDefault(EnvIstioGateway, "kubeflow/kubeflow-gateway")
	if err := unstructured.SetNestedStringSlice(virtualService.Object, []string{istioGateway},
		"spec", "gateways"); err != nil {
		return nil, fmt.Errorf("set .spec.gateways error: %v", err)
	}

	istioHost := helper.GetEnvOrDefault(EnvIstioHost, "*")
	if err := unstructured.SetNestedStringSlice(virtualService.Object, []string{istioHost},
		"spec", "gateways"); err != nil {
		return nil, fmt.Errorf("set .spec.hosts error: %v", err)
	}

	var prefixes []string
	for _, imagePort := range imageConfig.Spec.Ports {
		prefix := fmt.Sprintf("/workspace/%s/%s/%s", workspace.Namespace, workspace.Name, imagePort.Id)
		prefixes = append(prefixes, prefix)
	}

	var httpRoutes []interface{}

	host := fmt.Sprintf("%s.%s.svc.%s", serviceName, workspace.Namespace, helper.GetEnvOrDefault(ClusterDomain, "cluster.local"))

	// generate container ports
	containerPortsIdMap, err := helper.GenerateContainerPortsIdMap(imageConfig)
	if errContainerPorts := unstructured.SetNestedStringSlice(virtualService.Object, []string{istioHost},
		"spec", "gateways"); err != nil {
		return nil, fmt.Errorf("set .spec.hosts error: %v", errContainerPorts)
	}
	httpPathPrefixFunc := helper.GenerateHttpPathPrefixFunc(workspace, containerPortsIdMap)

	for _, imagePort := range imageConfig.Spec.Ports {

		httpRoute := map[string]interface{}{
			"match": []map[string]interface{}{
				{
					"uri": map[string]interface{}{
						"prefix": fmt.Sprintf("/workspace/%s/%s/%s", workspace.Namespace, workspace.Name, imagePort.Id),
					},
				},
			},
			"route": []map[string]interface{}{
				{
					"destination": map[string]interface{}{
						"host": host,
						"port": map[string]interface{}{
							"number": imagePort.Port,
						},
					},
				},
			},
		}

		if *workspaceKind.Spec.PodTemplate.HTTPProxy.RemovePathPrefix {
			httpRoute["rewrite"] = map[string]interface{}{"uri": "/"}
		}

		// templating .spec.http[].match.headers
		setHeaders := helper.RenderHeadersWithHttpPathPrefix(workspaceKind.Spec.PodTemplate.HTTPProxy.RequestHeaders.Set, httpPathPrefixFunc)
		addHeaders := helper.RenderHeadersWithHttpPathPrefix(workspaceKind.Spec.PodTemplate.HTTPProxy.RequestHeaders.Add, httpPathPrefixFunc)

		removeHeaders := make([]string, len(workspaceKind.Spec.PodTemplate.HTTPProxy.RequestHeaders.Remove))
		for i, header := range workspaceKind.Spec.PodTemplate.HTTPProxy.RequestHeaders.Remove {
			if header != "" {
				out, err := helper.RenderWithHttpPathPrefixFunc(header, nil)
				if err != nil {
					return nil, fmt.Errorf("failed to render header %q: %w", header, err)
				}
				removeHeaders[i] = out
			}
		}

		httpRoute["headers"] = map[string]interface{}{
			"request": map[string]interface{}{
				"add":    setHeaders,
				"set":    addHeaders,
				"remove": removeHeaders,
			},
		}

		httpRoutes = append(httpRoutes, httpRoute)
	}

	virtualService.Object["spec"] = map[string]interface{}{
		"gateways": []string{
			istioGateway,
		},
		"hosts": []string{
			istioHost,
		},
		"http": httpRoutes,
	}

	return virtualService, nil
}

func ReconcileVirtualService(ctx context.Context, r client.Client, virtualServiceName, namespace string, virtualService *unstructured.Unstructured, log logr.Logger) error {
	foundVirtualService := &unstructured.Unstructured{}
	foundVirtualService.SetAPIVersion(ApiVersionIstio)
	foundVirtualService.SetKind(VirtualServiceKind)
	justCreated := false
	if err := r.Get(ctx, types.NamespacedName{Name: virtualServiceName, Namespace: namespace}, foundVirtualService); err != nil {
		if apierrors.IsNotFound(err) {
			log.Info("Creating virtual service", "namespace", namespace, "name", virtualServiceName)
			if err := r.Create(ctx, virtualService); err != nil {
				log.Error(err, "unable to create virtual service")
				return err
			}
			justCreated = true
		} else {
			log.Error(err, "error getting virtual service")
			return err
		}
	}
	if !justCreated {
		log.Info("Updating virtual service", "namespace", namespace, "name", virtualServiceName)
		if err := r.Update(ctx, foundVirtualService); err != nil {
			log.Error(err, "unable to update virtual service")
			return err
		}
	}

	return nil
}
