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

// Package streaming provides an in-process publish/subscribe broadcaster used to
// notify long-lived HTTP handlers (e.g. Server-Sent Events streams) that a
// watched resource has changed, so they can re-read and push a fresh snapshot.
package streaming

import "sync"

// AllNamespaces is the namespace filter that matches change notifications from
// every namespace. A subscriber using it receives all published events, which is
// what a cluster-wide (all-namespaces) listing needs.
const AllNamespaces = ""

// subscriberChanBuffer is the buffer size of each subscriber's notification
// channel. Notifications are coalescing signals rather than a lossless event
// log, so a small buffer is enough: if a subscriber is slower than the publish
// rate, additional notifications are dropped (see Hub.Publish) because a single
// pending signal already tells the subscriber it must re-read the current state.
const subscriberChanBuffer = 1

// subscriber is a single registered listener with its namespace filter.
type subscriber struct {
	// namespace is the namespace the subscriber cares about, or AllNamespaces to
	// receive notifications from every namespace.
	namespace string
	// ch receives a signal (an empty struct) whenever a matching change is
	// published. It is buffered and never blocks the publisher.
	ch chan struct{}
}

// Hub is a concurrency-safe, in-process fan-out broadcaster. Producers call
// Publish with the namespace of a changed object; each subscriber whose filter
// matches receives a coalescing signal on its channel.
//
// The zero value is not usable; construct a Hub with NewHub.
type Hub struct {
	mu   sync.Mutex
	subs map[*subscriber]struct{}
}

// NewHub creates an empty Hub ready for use.
func NewHub() *Hub {
	return &Hub{
		subs: make(map[*subscriber]struct{}),
	}
}

// Subscribe registers a listener for changes in the given namespace (or
// AllNamespaces for every namespace). It returns a receive-only channel that is
// signaled on each matching change, and an unsubscribe function that removes the
// subscription and closes the channel. The unsubscribe function is idempotent and
// must be called (e.g. via defer) when the subscriber is done to avoid leaks.
func (h *Hub) Subscribe(namespace string) (<-chan struct{}, func()) {
	sub := &subscriber{
		namespace: namespace,
		ch:        make(chan struct{}, subscriberChanBuffer),
	}

	h.mu.Lock()
	h.subs[sub] = struct{}{}
	h.mu.Unlock()

	var once sync.Once
	unsubscribe := func() {
		once.Do(func() {
			h.mu.Lock()
			delete(h.subs, sub)
			h.mu.Unlock()
			close(sub.ch)
		})
	}

	return sub.ch, unsubscribe
}

// Publish notifies every subscriber whose filter matches namespace that a change
// occurred. A subscriber matches when it registered for AllNamespaces or for this
// exact namespace. Delivery is non-blocking: if a subscriber's buffer is already
// full, the signal is dropped, since a pending signal already tells that
// subscriber to re-read current state.
func (h *Hub) Publish(namespace string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for sub := range h.subs {
		if sub.namespace != AllNamespaces && sub.namespace != namespace {
			continue
		}
		select {
		case sub.ch <- struct{}{}:
		default:
			// Buffer full: an unconsumed signal is already pending, which is
			// sufficient because signals are coalescing.
		}
	}
}
