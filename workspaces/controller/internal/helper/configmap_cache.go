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
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/selection"
	toolscache "k8s.io/client-go/tools/cache"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/cache"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

const (
	// ImageSourceLabel is the label that must be present on ConfigMaps for them
	// to be visible to the filtered image-source cache.
	ImageSourceLabel = "notebooks.kubeflow.org/image-source"

	// SHA256AnnotationPrefix is the prefix for virtual annotations that store
	// pre-computed SHA256 hashes of ConfigMap data keys.
	// The full annotation key is: VIRTUAL.notebooks.kubeflow.org/sha256.{data-key}
	//
	// The "VIRTUAL." prefix uses capital letters which are invalid in real Kubernetes
	// annotations, making it obvious that these only exist in the in-memory cache.
	SHA256AnnotationPrefix = "VIRTUAL.notebooks.kubeflow.org/sha256."
)

// TransformConfigMapSha256 returns a cache Transform function that computes SHA256 hashes
// of each key in ConfigMap Data and BinaryData, storing them as virtual annotations.
//
// These annotations only exist in the in-memory cache — they are never written back to the
// API server. This allows consumers to read pre-computed hashes without redundant computation.
//
// For a ConfigMap with Data key "my-icon", the annotation will be:
//
//	VIRTUAL.notebooks.kubeflow.org/sha256.my-icon = "a1b2c3..."
func TransformConfigMapSha256() toolscache.TransformFunc {
	return func(in any) (any, error) {
		obj, err := meta.Accessor(in)
		if err != nil {
			return in, nil
		}

		cm, ok := in.(*corev1.ConfigMap)
		if !ok {
			return in, nil
		}

		annotations := obj.GetAnnotations()
		if annotations == nil {
			annotations = make(map[string]string)
		}

		// compute SHA256 for each key in Data
		for key, value := range cm.Data {
			hash := sha256.Sum256([]byte(value))
			annotations[SHA256AnnotationPrefix+key] = hex.EncodeToString(hash[:])
		}

		// compute SHA256 for each key in BinaryData
		for key, value := range cm.BinaryData {
			hash := sha256.Sum256(value)
			annotations[SHA256AnnotationPrefix+key] = hex.EncodeToString(hash[:])
		}

		obj.SetAnnotations(annotations)

		return in, nil
	}
}

// BuildImageSourceConfigMapCache creates a filtered cache for ConfigMaps with the label
// notebooks.kubeflow.org/image-source: true. This follows the guidance from:
// https://github.com/kubernetes-sigs/controller-runtime/issues/244#issuecomment-2466564541
//
// The cache uses a Transform function that pre-computes SHA256 hashes of each ConfigMap
// data key and stores them as virtual annotations (see TransformConfigMapSha256).
//
// The returned cache.Cache implements client.Reader (for Get/List) and can be used as a
// watch source in controller builder via source.Kind.
//
// WARNING: a cache will be completely unable to see resources in the cluster which don't
// match the label selector, even if they exist.
func BuildImageSourceConfigMapCache(mgr ctrl.Manager) (cache.Cache, error) {
	// ConfigMaps we manage will have the `notebooks.kubeflow.org/image-source=true` label
	imageSourceLabelReq, err := labels.NewRequirement(ImageSourceLabel, selection.Equals, []string{"true"})
	if err != nil {
		return nil, fmt.Errorf("failed to create label requirement: %w", err)
	}
	imageSourceLabelSelector := labels.NewSelector().Add(*imageSourceLabelReq)

	// create a new cache with a label selector for image source ConfigMaps
	// NOTE: this means that the cache will be unable to see ConfigMaps without the "image-source" label
	configMapCacheOpts := cache.Options{
		HTTPClient: mgr.GetHTTPClient(),
		Scheme:     mgr.GetScheme(),
		Mapper:     mgr.GetRESTMapper(),
		ByObject: map[client.Object]cache.ByObject{
			&corev1.ConfigMap{}: {
				Label:     imageSourceLabelSelector,
				Transform: TransformConfigMapSha256(),
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

	return configMapCache, nil
}
