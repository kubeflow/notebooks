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
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/cache"
	"k8s.io/client-go/discovery"
	metricsv1beta1 "k8s.io/metrics/pkg/apis/metrics/v1beta1"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	modelsCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/models/common"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces/podtemplate/resources"
	repoCommon "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/common"
)

const (
	// TTL for API availability checks when the API is served or confirmed absent.
	apiAvailabilityTTL = 60 * time.Second

	// Shorter TTL for API availability checks when a transient error (e.g. timeout) occurred.
	apiAvailabilityTransientTTL = 10 * time.Second

	// Default TTL for cached workspace resource usage responses.
	defaultResourceUsageCacheTTL = 30 * time.Second

	// Default short TTL for negative/missing workspace resource usage responses (e.g. scrape pending or PodMetrics unavailable).
	defaultResourceUsageNegativeCacheTTL = 5 * time.Second

	// Default timeout for probing the Kubernetes Metrics API via the discovery client.
	defaultMetricsDiscoveryTimeout = 5 * time.Second

	// Default timeout for querying PodMetrics from the Metrics Server.
	defaultMetricsQueryTimeout = 5 * time.Second

	// Maximum entries in the resource usage LRU cache.
	resourceUsageCacheMaxCapacity = 10000
)

// MetricsRepository exposes point-in-time workspace resource utilization, read from the
// Kubernetes Metrics Server, to the API layer.
//
// It maintains two levels of in-memory caching to minimize cluster overhead:
//  1. API Availability (apiAvailable): A memoized probe (60s TTL, 10s on transient error) that caches whether the
//     Kubernetes Metrics API (metrics.k8s.io) is served in the cluster, avoiding repetitive
//     discovery calls.
//  2. Resource Usage Cache (usageCache): A TTL LRU cache (max 10000 entries) keyed by
//     "<namespace>/<workspace>/<podUID>". Successful metrics reads are cached for 30s, while
//     negative/fallback results (missing metrics or pending scrapes) are cached for 5s to avoid
//     hammering the Metrics Server while allowing rapid recovery once metrics are scraped.
type MetricsRepository struct {
	cfg              *config.EnvConfig
	client           client.Client
	discoveryClient  discovery.DiscoveryInterface
	logger           *slog.Logger
	apiAvailable     func() bool
	usageCache       *cache.LRUExpireCache
	cacheTTL         time.Duration
	negativeCacheTTL time.Duration
	queryTimeout     time.Duration
	discoveryTimeout time.Duration
}

// NewMetricsRepository creates a MetricsRepository for accessing workspace metrics.
func NewMetricsRepository(
	cfg *config.EnvConfig,
	c client.Client,
	discoveryClient discovery.DiscoveryInterface,
	logger *slog.Logger,
) *MetricsRepository {
	if logger == nil {
		logger = slog.Default()
	}
	repo := &MetricsRepository{
		cfg:              cfg,
		client:           c,
		discoveryClient:  discoveryClient,
		logger:           logger,
		usageCache:       cache.NewLRUExpireCache(resourceUsageCacheMaxCapacity),
		cacheTTL:         defaultResourceUsageCacheTTL,
		negativeCacheTTL: defaultResourceUsageNegativeCacheTTL,
		queryTimeout:     defaultMetricsQueryTimeout,
		discoveryTimeout: defaultMetricsDiscoveryTimeout,
	}
	repo.apiAvailable = memoize(func() (bool, error) {
		ctx, cancel := context.WithTimeout(context.Background(), repo.discoveryTimeout)
		defer cancel()
		return metricsAPIServed(ctx, repo.discoveryClient)
	}, repo.availabilityTTL)
	return repo
}

// GetWorkspaceResourceUsage returns the resource usage for all pods in the given namespace and workspace.
func (r *MetricsRepository) GetWorkspaceResourceUsage(ctx context.Context, ns, workspace string) (*models.WorkspaceResourceUsage, error) {
	// Confirm the workspace exists first. Usage is resolved by pod label, so without this a
	// workspace that never existed would be indistinguishable from one that is merely paused,
	// and both would report WORKSPACE_NOT_RUNNING. This read is served from the informer cache.
	ws := &kubefloworgv1beta1.Workspace{}
	if err := r.client.Get(ctx, client.ObjectKey{Namespace: ns, Name: workspace}, ws); err != nil {
		if apierrors.IsNotFound(err) {
			return nil, repoCommon.ErrWorkspaceNotFound
		}
		return nil, err
	}

	selector := client.MatchingLabels{modelsCommon.LabelWorkspaceName: workspace}
	podList := &corev1.PodList{}
	if err := r.client.List(ctx, podList, client.InNamespace(ns), selector); err != nil {
		return nil, err
	}

	if len(podList.Items) == 0 {
		return nil, repoCommon.ErrWorkspacePodNotRunning
	}

	// Workspaces are backed by StatefulSets with replicas=1. Because StatefulSets provide
	// strict deployment guarantees, there will only ever be a maximum of one pod running
	// at any given time. Therefore, we can safely just grab the first item in the list.
	pod := &podList.Items[0]

	cacheKey := fmt.Sprintf("%s/%s/%s", ns, workspace, pod.UID)
	if r.usageCache != nil {
		if val, ok := r.usageCache.Get(cacheKey); ok {
			if cachedUsage, valid := val.(*models.WorkspaceResourceUsage); valid {
				return cachedUsage, nil
			}
		}
	}

	if !r.apiAvailable() {
		return models.NewWorkspaceResourceUsage(pod, nil), nil
	}

	podMetrics := &metricsv1beta1.PodMetrics{}
	queryCtx, cancel := context.WithTimeout(ctx, r.queryTimeout)
	defer cancel()

	if err := r.client.Get(queryCtx, client.ObjectKey{Namespace: ns, Name: pod.Name}, podMetrics); err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		usage := models.NewWorkspaceResourceUsage(pod, nil)
		if r.usageCache != nil {
			r.usageCache.Add(cacheKey, usage, r.negativeCacheTTL)
		}
		return usage, nil
	}

	if len(podMetrics.Containers) == 0 {
		usage := models.NewWorkspaceResourceUsage(pod, nil)
		if r.usageCache != nil {
			r.usageCache.Add(cacheKey, usage, r.negativeCacheTTL)
		}
		return usage, nil
	}

	usage := models.NewWorkspaceResourceUsage(pod, models.UsageForPod(podMetrics))
	if r.usageCache != nil {
		r.usageCache.Add(cacheKey, usage, r.cacheTTL)
	}
	return usage, nil
}

// memoize caches the result of the probe using a TTL determined by ttlFunc(err).
func memoize(probe func() (bool, error), ttlFunc func(error) time.Duration) func() bool {
	var (
		mu        sync.Mutex
		val       bool
		checkedAt time.Time
		ttl       time.Duration
	)
	return func() bool {
		mu.Lock()
		defer mu.Unlock()
		if checkedAt.IsZero() || time.Since(checkedAt) >= ttl {
			var err error
			val, err = probe()
			ttl = ttlFunc(err)
			checkedAt = time.Now()
		}
		return val
	}
}

// metricsAPIServed checks whether the Kubernetes Metrics API (metrics.k8s.io/v1beta1) is served in the cluster.
//
// Note: ctx should not be request-scoped. Because the probe result is memoized and shared across all
// concurrent and future workspace resource usage requests, using a request-scoped context could cause
// an early client cancellation or disconnect to fail the probe. This would poison the shared cache with
// a transient failure and penalize unrelated requests for the duration of apiAvailabilityTransientTTL.
// Callers should instead use an independent context with a dedicated timeout (e.g. context.Background()
// with repo.discoveryTimeout).
func metricsAPIServed(ctx context.Context, d discovery.DiscoveryInterface) (bool, error) {
	if d == nil || d.RESTClient() == nil {
		return false, errors.New("discovery client is not configured")
	}
	err := d.RESTClient().
		Get().
		AbsPath("/apis", metricsv1beta1.SchemeGroupVersion.Group, metricsv1beta1.SchemeGroupVersion.Version).
		Do(ctx).
		Error()
	if err != nil {
		return false, err
	}
	return true, nil
}

// availabilityTTL returns the cache duration for a Metrics API availability probe result.
// When the API is served (err == nil) or confirmed not installed in the cluster (HTTP 404 NotFound),
// the result is cached for apiAvailabilityTTL. For transient errors (e.g. timeouts or 503s),
// it logs a warning and returns a shorter apiAvailabilityTransientTTL to allow faster recovery
// once the apiserver stabilizes while still providing a cooldown period.
func (r *MetricsRepository) availabilityTTL(err error) time.Duration {
	if err == nil {
		return apiAvailabilityTTL
	}
	if apierrors.IsNotFound(err) {
		return apiAvailabilityTTL
	}
	r.logger.Warn("metrics API availability probe failed; will retry after transient cooldown",
		"error", err,
		"retryAfter", apiAvailabilityTransientTTL,
	)
	// For transient failures (e.g. discovery timeout or apiserver network error), use a shorter
	// TTL so metrics recovery is not delayed for an entire minute once the apiserver stabilizes,
	// while still providing a cooldown period to avoid hammering during outages.
	return apiAvailabilityTransientTTL
}
