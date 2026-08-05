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

package metrics

import (
	"context"
	"fmt"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/runtime/schema"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/metrics"
)

const (
	// TTL for API availability checks.
	apiAvailabilityTTL = 60 * time.Second
)

// MetricsRepository exposes point-in-time workspace resource utilization, read from the
// Kubernetes Metrics Server, to the API layer.
type MetricsRepository struct {
	cfg          *config.EnvConfig
	client       client.Client
	apiAvailable func() (bool, error)
}

// NewMetricsRepository creates a MetricsRepository for accessing workspace metrics.
func NewMetricsRepository(cfg *config.EnvConfig, c client.Client) *MetricsRepository {
	return &MetricsRepository{
		cfg:          cfg,
		client:       c,
		apiAvailable: memoize(apiAvailabilityTTL, func() (bool, error) { return metricsAPIServed(c) }),
	}
}

// GetWorkspaceResourceUsage returns the resource usage for all pods in the given namespace and workspace.
func (r *MetricsRepository) GetWorkspaceResourceUsage(ctx context.Context, ns, workspace string) (*models.WorkspaceResourceUsage, error) {
	available, err := r.apiAvailable()
	if err != nil {
		return nil, err
	}

	if !available {
		return models.NewErrorResourceUsage(models.ErrorCodeMetricsAPINotAvailable), nil
	}

	selector := client.MatchingLabels{modelsCommon.LabelWorkspaceName: workspace}
	podList := &corev1.PodList{}
	if err := r.client.List(ctx, podList, client.InNamespace(ns), selector); err != nil {
		return nil, err
	}

	if len(podList.Items) == 0 {
		return models.NewErrorResourceUsage(models.ErrorCodeWorkspaceNotRunning), nil
	}

	// Workspaces are backed by StatefulSets with replicas=1. Because StatefulSets provide
	// strict deployment guarantees, there will only ever be a maximum of one pod running
	// at any given time. Therefore, we can safely just grab the first item in the list.
	pod := &podList.Items[0]
	podMetricsList := &metricsv1beta1.PodMetricsList{}
	if err := r.client.List(ctx, podMetricsList, client.InNamespace(ns), selector); err != nil {
		return nil, err
	}

	usageByContainer := models.UsageForPod(podMetricsList.Items, pod.Name)
	return models.NewWorkspaceResourceUsage(
		pod,
		usageByContainer,
	), nil
}

// memoize caches the result of the probe for ttl.
func memoize(ttl time.Duration, probe func() (bool, error)) func() (bool, error) {
	var (
		mu        sync.Mutex
		val       bool
		checkedAt time.Time
	)
	return func() (bool, error) {
		mu.Lock()
		defer mu.Unlock()
		if !checkedAt.IsZero() && time.Since(checkedAt) < ttl {
			return val, nil
		}
		v, err := probe()
		if err != nil {
			return false, err
		}
		val, checkedAt = v, time.Now()
		return val, nil
	}
}

func metricsAPIServed(c client.Client) (bool, error) {
	_, err := c.RESTMapper().RESTMapping(
		schema.GroupKind{Group: metricsv1beta1.GroupName, Kind: "PodMetrics"},
		metricsv1beta1.SchemeGroupVersion.Version,
	)

	switch {
	case err == nil:
		return true, nil
	case meta.IsNoMatchError(err):
		return false, nil
	default:
		return false, fmt.Errorf("checking metrics.k8s.io availability: %w", err)
	}
}
