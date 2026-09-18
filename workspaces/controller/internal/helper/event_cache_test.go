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
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var _ = Describe("StripEventForCache", func() {

	newEvent := func() *corev1.Event {
		return &corev1.Event{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "my-event",
				Namespace:   "my-namespace",
				Annotations: map[string]string{"kubectl.kubernetes.io/last-applied-configuration": "{...}"},
				ManagedFields: []metav1.ManagedFieldsEntry{
					{Manager: "kubelet", Operation: metav1.ManagedFieldsOperationUpdate},
				},
			},
			InvolvedObject: corev1.ObjectReference{
				Kind:            "Pod",
				Namespace:       "my-namespace",
				Name:            "my-pod",
				UID:             "my-pod-uid",
				APIVersion:      "v1",
				ResourceVersion: "12345",
				FieldPath:       "spec.containers{main}",
			},
			Source:              corev1.EventSource{Component: "kubelet", Host: "my-node"},
			Type:                corev1.EventTypeWarning,
			Reason:              "FailedMount",
			Message:             "MountVolume.SetUp failed for volume",
			FirstTimestamp:      metav1.Now(),
			LastTimestamp:       metav1.Now(),
			Count:               3,
			Action:              "Mounting",
			ReportingController: "kubelet",
			ReportingInstance:   "kubelet-my-node",
		}
	}

	It("should preserve every field the controller reads", func() {
		event := newEvent()
		lastTimestamp := event.LastTimestamp

		out, err := StripEventForCache(event)
		Expect(err).NotTo(HaveOccurred())

		strippedEvent, ok := out.(*corev1.Event)
		Expect(ok).To(BeTrue())

		Expect(strippedEvent.Name).To(Equal("my-event"))
		Expect(strippedEvent.Namespace).To(Equal("my-namespace"))
		Expect(strippedEvent.InvolvedObject.UID).To(BeEquivalentTo("my-pod-uid"))
		Expect(strippedEvent.InvolvedObject.Kind).To(Equal("Pod"))
		Expect(strippedEvent.InvolvedObject.Namespace).To(Equal("my-namespace"))
		Expect(strippedEvent.InvolvedObject.Name).To(Equal("my-pod"))
		Expect(strippedEvent.Type).To(Equal(corev1.EventTypeWarning))
		Expect(strippedEvent.Reason).To(Equal("FailedMount"))
		Expect(strippedEvent.Message).To(Equal("MountVolume.SetUp failed for volume"))
		Expect(strippedEvent.LastTimestamp).To(Equal(lastTimestamp))
	})

	It("should drop the fields the controller never reads", func() {
		out, err := StripEventForCache(newEvent())
		Expect(err).NotTo(HaveOccurred())

		strippedEvent, ok := out.(*corev1.Event)
		Expect(ok).To(BeTrue())

		Expect(strippedEvent.ManagedFields).To(BeNil())
		Expect(strippedEvent.Annotations).To(BeNil())
		Expect(strippedEvent.InvolvedObject.APIVersion).To(BeEmpty())
		Expect(strippedEvent.InvolvedObject.ResourceVersion).To(BeEmpty())
		Expect(strippedEvent.InvolvedObject.FieldPath).To(BeEmpty())
		Expect(strippedEvent.Source).To(Equal(corev1.EventSource{}))
		Expect(strippedEvent.FirstTimestamp).To(Equal(metav1.Time{}))
		Expect(strippedEvent.Series).To(BeNil())
		Expect(strippedEvent.Action).To(BeEmpty())
		Expect(strippedEvent.Related).To(BeNil())
		Expect(strippedEvent.ReportingController).To(BeEmpty())
		Expect(strippedEvent.ReportingInstance).To(BeEmpty())
	})

	It("should be idempotent", func() {
		first, err := StripEventForCache(newEvent())
		Expect(err).NotTo(HaveOccurred())

		second, err := StripEventForCache(first)
		Expect(err).NotTo(HaveOccurred())

		Expect(second).To(Equal(first))
	})

	It("should leave objects which are not Events untouched", func() {
		pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "my-pod"}}

		out, err := StripEventForCache(pod)
		Expect(err).NotTo(HaveOccurred())
		Expect(out).To(BeIdenticalTo(pod))
	})
})
