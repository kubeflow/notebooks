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

package streaming

import (
	"sync"
	"testing"
)

// received reports whether a signal is currently pending on ch without blocking.
func received(ch <-chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

func TestHub_PublishDeliversToMatchingSubscriber(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("team-a")
	defer unsubscribe()

	h.Publish("team-a")

	if !received(ch) {
		t.Fatal("expected subscriber to receive a signal for its namespace")
	}
}

func TestHub_PublishFiltersByNamespace(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("team-a")
	defer unsubscribe()

	h.Publish("team-b")

	if received(ch) {
		t.Fatal("subscriber for team-a should not receive a team-b notification")
	}
}

func TestHub_AllNamespacesReceivesEverything(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe(AllNamespaces)
	defer unsubscribe()

	h.Publish("any-namespace")

	if !received(ch) {
		t.Fatal("AllNamespaces subscriber should receive notifications from any namespace")
	}
}

func TestHub_UnsubscribeStopsDelivery(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("team-a")

	unsubscribe()

	// Publishing after unsubscribe must not panic (channel is closed) and must
	// not deliver. A closed channel would yield a zero value from received; the
	// key assertion is that Publish does not send on it, which it can't since the
	// subscriber was removed from the hub before the channel was closed.
	h.Publish("team-a")

	// Draining a closed, empty channel returns immediately with the zero value.
	if _, ok := <-ch; ok {
		t.Fatal("expected no buffered signal on the channel after unsubscribe")
	}
}

func TestHub_UnsubscribeIsIdempotent(t *testing.T) {
	h := NewHub()
	_, unsubscribe := h.Subscribe("team-a")

	unsubscribe()
	// A second call must be a no-op and must not panic (e.g. double close).
	unsubscribe()
}

func TestHub_PublishDoesNotBlockOnFullBuffer(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("team-a")
	defer unsubscribe()

	// Publish more times than the buffer holds; coalescing means excess signals
	// are dropped rather than blocking the publisher.
	for range 100 {
		h.Publish("team-a")
	}

	if !received(ch) {
		t.Fatal("expected at least one pending signal after repeated publishes")
	}
	// After draining the single buffered signal, no more should remain.
	if received(ch) {
		t.Fatal("expected coalesced signals to collapse to a single pending signal")
	}
}

func TestHub_ConcurrentPublishAndSubscribe(t *testing.T) {
	h := NewHub()

	var wg sync.WaitGroup
	for range 50 {
		wg.Go(func() {
			ch, unsubscribe := h.Subscribe("team-a")
			defer unsubscribe()
			h.Publish("team-a")
			_ = received(ch)
		})
	}
	wg.Wait()
}
