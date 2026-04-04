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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
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

// NewManager creates a new controller-runtime manager with caching disabled for Secrets.
// Caching all Secrets can take a LOT of memory in a large cluster, so we disable the default
// cache and use a metadata-only cache instead (see BuildSecretMetadataClient).
// References:
//   - https://github.com/kubernetes-sigs/controller-runtime/issues/2570#issuecomment-2471247755
func NewManager(cfg *rest.Config, scheme *runtime.Scheme) (ctrl.Manager, error) {
	mgr, err := ctrl.NewManager(cfg, ctrl.Options{
		Scheme: scheme,
		Client: client.Options{
			Cache: &client.CacheOptions{
				// disable caching for Secrets as caching all of them can take a LOT of memory
				DisableFor: []client.Object{
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

// BuildSecretMetadataClient creates a client backed by a metadata-only cache for Secrets.
// This cache stores only the ObjectMeta of each Secret (name, labels, annotations, etc.)
// and does NOT store secret data values, making it safe for high-cardinality and sensitive resources.
//
// NOTE: this client can ONLY be used with PartialObjectMetadata types for Secrets.
//
//	it will fail if used with full Secret objects or other resource types.
//
// References:
//   - https://github.com/kubernetes-sigs/controller-runtime/issues/2570#issuecomment-2471247755
func BuildSecretMetadataClient(mgr ctrl.Manager) (client.Client, error) {
	// create a PartialObjectMetadata template for Secrets
	secretMeta := &metav1.PartialObjectMetadata{}
	secretMeta.SetGroupVersionKind(corev1.SchemeGroupVersion.WithKind("Secret"))

	// create a new cache that only stores metadata for Secrets
	// NOTE: this means the cache/client will only have ObjectMeta fields (name, labels, annotations, etc.)
	//       and will NOT have secret data, type, or immutable fields
	secretMetadataCacheOpts := cache.Options{
		HTTPClient: mgr.GetHTTPClient(),
		Scheme:     mgr.GetScheme(),
		Mapper:     mgr.GetRESTMapper(),
		ByObject: map[client.Object]cache.ByObject{
			secretMeta: {},
		},
		// this requires us to explicitly start an informer for each object type
		// and helps avoid people mistakenly using the secret metadata client for other resources
		ReaderFailOnMissingInformer: true,
	}
	secretMetadataCache, err := cache.New(mgr.GetConfig(), secretMetadataCacheOpts)
	if err != nil {
		return nil, fmt.Errorf("failed to create Secret metadata cache: %w", err)
	}

	// start an informer for Secret metadata
	// this is required because we set ReaderFailOnMissingInformer to true
	_, err = secretMetadataCache.GetInformer(context.Background(), secretMeta)
	if err != nil {
		return nil, fmt.Errorf("failed to get Secret metadata informer: %w", err)
	}

	// add the Secret metadata cache to the manager, so that it starts at the same time
	err = mgr.Add(secretMetadataCache)
	if err != nil {
		return nil, fmt.Errorf("failed to add Secret metadata cache to manager: %w", err)
	}

	// create a new client that uses the Secret metadata cache
	secretMetadataClient, err := client.New(mgr.GetConfig(), client.Options{
		HTTPClient: mgr.GetHTTPClient(),
		Scheme:     mgr.GetScheme(),
		Mapper:     mgr.GetRESTMapper(),
		Cache: &client.CacheOptions{
			Reader: secretMetadataCache,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create Secret metadata client: %w", err)
	}

	return secretMetadataClient, nil
}
