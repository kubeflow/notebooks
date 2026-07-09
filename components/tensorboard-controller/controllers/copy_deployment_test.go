/*
Copyright 2022.

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

package controllers

import (
	"testing"

	"github.com/gogo/protobuf/proto"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func baseDeployment(image string) *appsv1.Deployment {
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{Name: "tb", Namespace: "ns"},
		Spec: appsv1.DeploymentSpec{
			Replicas: proto.Int32(1),
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{
						Name:  "tensorboard",
						Image: image,
					}},
				},
			},
		},
	}
}

func TestCopyDeploymentSetFields_UpdatesChangedContainerImage(t *testing.T) {
	from := baseDeployment("tensorflow/tensorboard:2.16.0")
	to := baseDeployment("tensorflow/tensorboard:2.10.0")

	if !CopyDeploymentSetFields(from, to) {
		t.Fatalf("expected requireUpdate=true when container image differs")
	}
	got := to.Spec.Template.Spec.Containers[0].Image
	if got != "tensorflow/tensorboard:2.16.0" {
		t.Fatalf("expected image to be synced to %q, got %q", "tensorflow/tensorboard:2.16.0", got)
	}
}

func TestCopyDeploymentSetFields_NoUpdateWhenImageMatches(t *testing.T) {
	from := baseDeployment("tensorflow/tensorboard:2.16.0")
	to := baseDeployment("tensorflow/tensorboard:2.16.0")

	if CopyDeploymentSetFields(from, to) {
		t.Fatalf("expected requireUpdate=false when nothing differs")
	}
}

func TestCopyDeploymentSetFields_MatchesContainerByName(t *testing.T) {
	from := baseDeployment("tensorflow/tensorboard:2.16.0")
	to := baseDeployment("tensorflow/tensorboard:2.10.0")
	// Add a sidecar that exists only on `to`; it must not be touched, and its
	// presence must not prevent the tensorboard image from being synced.
	to.Spec.Template.Spec.Containers = append(to.Spec.Template.Spec.Containers, corev1.Container{
		Name:  "sidecar",
		Image: "sidecar:v1",
	})

	if !CopyDeploymentSetFields(from, to) {
		t.Fatalf("expected requireUpdate=true when tensorboard image differs")
	}
	if to.Spec.Template.Spec.Containers[0].Image != "tensorflow/tensorboard:2.16.0" {
		t.Fatalf("tensorboard image was not synced")
	}
	if to.Spec.Template.Spec.Containers[1].Image != "sidecar:v1" {
		t.Fatalf("sidecar image should not be touched, got %q", to.Spec.Template.Spec.Containers[1].Image)
	}
}
