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

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"
)

var _ = Describe("BuildRateLimiter", func() {

	It("should apply exponential backoff starting at 1s and capping at 7m", func() {
		rl := BuildRateLimiter()
		Expect(rl).NotTo(BeNil())

		req := reconcile.Request{NamespacedName: types.NamespacedName{Namespace: "default", Name: "ws-1"}}

		Expect(rl.When(req)).To(Equal(1 * time.Second))
		Expect(rl.When(req)).To(Equal(2 * time.Second))
		Expect(rl.When(req)).To(Equal(4 * time.Second))
		Expect(rl.NumRequeues(req)).To(Equal(3))

		// Advance past 7 minutes (420s): 1,2,4,8,16,32,64,128,256,512 -> capped at 7m
		for range 10 {
			rl.When(req)
		}
		Expect(rl.When(req)).To(Equal(7 * time.Minute))
	})

	It("should reset backoff after Forget and track items independently", func() {
		rl := BuildRateLimiter()

		reqA := reconcile.Request{NamespacedName: types.NamespacedName{Namespace: "default", Name: "ws-a"}}
		reqB := reconcile.Request{NamespacedName: types.NamespacedName{Namespace: "default", Name: "ws-b"}}

		Expect(rl.When(reqA)).To(Equal(1 * time.Second))
		Expect(rl.When(reqA)).To(Equal(2 * time.Second))
		Expect(rl.When(reqB)).To(Equal(1 * time.Second))

		rl.Forget(reqA)
		Expect(rl.NumRequeues(reqA)).To(BeZero())
		Expect(rl.NumRequeues(reqB)).To(Equal(1))
		Expect(rl.When(reqA)).To(Equal(1 * time.Second))
	})
})
