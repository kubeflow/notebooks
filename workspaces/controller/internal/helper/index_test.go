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
	"k8s.io/apimachinery/pkg/types"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("indexWorkspaceOwnedResourceUIDs", func() {
	It("should return nil for non-Workspace objects", func() {
		pod := &corev1.Pod{}
		Expect(indexWorkspaceOwnedResourceUIDs(pod)).To(BeNil())
	})

	It("should return empty slice when both Pod and StatefulSet UIDs are empty", func() {
		ws := &kubefloworgv1beta1.Workspace{}
		Expect(indexWorkspaceOwnedResourceUIDs(ws)).To(BeEmpty())
	})

	It("should return both UIDs when Pod and StatefulSet UIDs are set", func() {
		ws := &kubefloworgv1beta1.Workspace{
			Status: kubefloworgv1beta1.WorkspaceStatus{
				PodTemplatePod: kubefloworgv1beta1.WorkspacePodStatus{
					UID: types.UID("pod-uid-123"),
				},
				PodTemplateStatefulSet: kubefloworgv1beta1.WorkspaceStatefulSetStatus{
					UID: types.UID("sts-uid-456"),
				},
			},
		}
		uids := indexWorkspaceOwnedResourceUIDs(ws)
		Expect(uids).To(ConsistOf("pod-uid-123", "sts-uid-456"))
	})

	It("should return only Pod UID when only Pod UID is set", func() {
		ws := &kubefloworgv1beta1.Workspace{
			Status: kubefloworgv1beta1.WorkspaceStatus{
				PodTemplatePod: kubefloworgv1beta1.WorkspacePodStatus{
					UID: types.UID("pod-uid-123"),
				},
			},
		}
		uids := indexWorkspaceOwnedResourceUIDs(ws)
		Expect(uids).To(ConsistOf("pod-uid-123"))
	})

	It("should return only StatefulSet UID when only StatefulSet UID is set", func() {
		ws := &kubefloworgv1beta1.Workspace{
			Status: kubefloworgv1beta1.WorkspaceStatus{
				PodTemplateStatefulSet: kubefloworgv1beta1.WorkspaceStatefulSetStatus{
					UID: types.UID("sts-uid-456"),
				},
			},
		}
		uids := indexWorkspaceOwnedResourceUIDs(ws)
		Expect(uids).To(ConsistOf("sts-uid-456"))
	})
})
