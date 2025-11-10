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

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	clientgoscheme "k8s.io/client-go/kubernetes/scheme"
	"k8s.io/client-go/rest"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
	metricsserver "sigs.k8s.io/controller-runtime/pkg/metrics/server"
)

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

// NewManager creates a new controller manager with the standard configuration.
// It disables caching for ConfigMap and Secret resources to avoid cache overhead,
// and disables metrics and health probe serving.
// Following guidance from: https://github.com/kubernetes-sigs/controller-runtime/issues/244#issuecomment-2466564541
func NewManager(cfg *rest.Config, scheme *runtime.Scheme) (ctrl.Manager, error) {
	mgr, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme: scheme,
		Client: client.Options{
			Cache: &client.CacheOptions{
				// Disable caching for ConfigMaps and Secrets as caching all of them can take a LOT of memory in a large cluster
				DisableFor: []client.Object{
					&corev1.ConfigMap{},
					&corev1.Secret{},
				},
			},
		},
		Metrics: metricsserver.Options{
			BindAddress: "0", // disable metrics serving
		},
		HealthProbeBindAddress: "0", // disable health probe serving
		LeaderElection:         false,
	})
	if err != nil {
		return nil, fmt.Errorf("unable to create manager: %w", err)
	}
	return mgr, nil
}

// BuildImageSourceConfigMapClient creates a filtered cache client for ConfigMaps with the label
// notebooks.kubeflow.org/image-source: true. This follows the guidance from:
// https://github.com/kubernetes-sigs/controller-runtime/issues/244#issuecomment-2466564541
//
// WARNING: a client which uses a filtered cache will be completely unable to see resources
// in the cluster which don't match the cache, even if they exist.
func BuildImageSourceConfigMapClient(mgr ctrl.Manager) (client.Client, error) {
	// ConfigMaps we manage will have the `notebooks.kubeflow.org/image-source=true` label
	imageSourceLabelReq, err := labels.NewRequirement("notebooks.kubeflow.org/image-source", selection.Equals, []string{"true"})
	if err != nil {
		return nil, fmt.Errorf("failed to create label requirement: %w", err)
	}
	imageSourceLabelSelector := labels.NewSelector().Add(*imageSourceLabelReq)

	// create a new cache with a label selector for image source ConfigMaps
	// NOTE: this means that the cache/client will be unable to see ConfigMaps without the "image-source" label
	configMapCacheOpts := cache.Options{
		HTTPClient: mgr.GetHTTPClient(),
		Scheme:     mgr.GetScheme(),
		Mapper:     mgr.GetRESTMapper(),
		ByObject: map[client.Object]cache.ByObject{
			&corev1.ConfigMap{}: {
				Label: imageSourceLabelSelector,
			},
		},
		// this requires us to explicitly start an informer for each object type
		// and helps avoid people mistakenly using the configmap client for other resources
		ReaderFailOnMissingInformer: true,
	}
	configMapCache, err := cache.New(mgr.GetConfig(), configMapCacheOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to create ConfigMap cache: %w", err)
	}

	// start an informer for ConfigMaps
	// this is required because we set ReaderFailOnMissingInformer to true
	_, err = configMapCache.GetInformer(context.Background(), &corev1.ConfigMap{})
	if err != nil {
		return nil, fmt.Errorf("failed to get ConfigMap informer: %w", err)
	}

	// add the ConfigMap cache to the manager, so that it starts at the same time
	err = mgr.Add(configMapCache)
	if err != nil {
		return nil, fmt.Errorf("failed to add ConfigMap cache to manager: %w", err)
	}

	// create a new client that uses the ConfigMap cache
	configMapClient, err := client.New(mgr.GetConfig(), client.Options{
		HTTPClient: mgr.GetHTTPClient(),
		Scheme:     mgr.GetScheme(),
		Mapper:     mgr.GetRESTMapper(),
		Cache: &client.CacheOptions{
			Reader: configMapCache,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create ConfigMap client: %w", err)
	}

	return configMapClient, nil
}
