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
	"time"

	"golang.org/x/time/rate"
	"k8s.io/client-go/util/workqueue"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

// BuildRateLimiter creates a new rate limiter for our controllers.
// NOTE: we dont use `DefaultTypedControllerRateLimiter` because it retries very aggressively, starting at 5ms!
func BuildRateLimiter() workqueue.TypedRateLimiter[reconcile.Request] {
	// exponential backoff rate limiter
	//  - this handles per-item rate limiting for ~failures~
	//  - it uses an exponential backoff strategy were: delay = baseDelay * 2^failures
	//  - graph visualization: https://www.desmos.com/calculator/fexlpdmiti
	failureBaseDelay := 1 * time.Second
	failureMaxDelay := 7 * time.Minute
	failureRateLimiter := workqueue.NewTypedItemExponentialFailureRateLimiter[reconcile.Request](failureBaseDelay, failureMaxDelay)

	// overall rate limiter
	//  - this handles overall rate limiting, ignoring individual items and only considering the overall rate
	//  - it implements a "token bucket" of size totalMaxBurst that is initially full,
	//    and which is refilled at rate totalEventsPerSecond tokens per second.
	totalEventsPerSecond := 10
	totalMaxBurst := 100
	totalRateLimiter := &workqueue.TypedBucketRateLimiter[reconcile.Request]{
		Limiter: rate.NewLimiter(rate.Limit(totalEventsPerSecond), totalMaxBurst),
	}

	// return the worst-case (longest) of the rate limiters for a given item
	return workqueue.NewTypedMaxOfRateLimiter[reconcile.Request](failureRateLimiter, totalRateLimiter)
}
