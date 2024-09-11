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

package helper

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	clientRest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
)

// GetKubeconfig returns the current KUBECONFIG configuration based on the default loading rules.
func GetKubeconfig() (*clientRest.Config, error) {
	loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
	configOverrides := &clientcmd.ConfigOverrides{}
	kubeConfig := clientcmd.NewNonInteractiveDeferredLoadingClientConfig(loadingRules, configOverrides)
	return kubeConfig.ClientConfig()
}

// BuildScheme returns builds a new runtime scheme with all the necessary types registered.
func BuildScheme() (*runtime.Scheme, error) {
	scheme := runtime.NewScheme()
	if err := clientgoscheme.AddToScheme(scheme); err != nil {
		return nil, fmt.Errorf("failed to add Kubernetes types to scheme: %w", err)
	}
	if err := kubefloworgv1beta1.AddToScheme(scheme); err != nil {
		return nil, fmt.Errorf("failed to add Kubeflow types to scheme: %w", err)
	}
	return scheme, nil
}

func (k *KubernetesClient) GetWorkspaces(namespace string) ([]workspacesv1beta1.Workspace, error) {
	//TODO check if there is no typed client for this
	restConfig, err := getRestConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}
	dynamicClient, err := dynamic.NewForConfig(restConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	workspaceGVR := schema.GroupVersionResource{
		Group:    "kubeflow.org",
		Version:  "v1beta1",
		Resource: "workspaces",
	}

	if namespace == "" {
		return nil, fmt.Errorf("failed to list workspaces - namespace is empty: %w", err)
	}

	list, err := dynamicClient.Resource(workspaceGVR).Namespace(namespace).List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list workspaces: %w", err)
	}

	workspaces := make([]workspacesv1beta1.Workspace, 0, len(list.Items))
	for _, item := range list.Items {
		workspace := &workspacesv1beta1.Workspace{}
		err := runtime.DefaultUnstructuredConverter.FromUnstructured(item.Object, workspace)
		if err != nil {
			return nil, fmt.Errorf("failed to convert unstructured to Workspace: %w", err)
		}
		workspaces = append(workspaces, *workspace)
	}

	return workspaces, nil
}
