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

package workspaces

import (
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
)

func TestWorkspacesModels(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Workspaces Models Suite")
}

// makeWsk returns a minimal WorkspaceKind with the given culling config.
func makeWsk(culling *kubefloworgv1beta1.WorkspaceKindCullingConfig) *kubefloworgv1beta1.WorkspaceKind {
	return &kubefloworgv1beta1.WorkspaceKind{
		ObjectMeta: metav1.ObjectMeta{
			Name: "test-kind",
			UID:  "test-uid",
		},
		Spec: kubefloworgv1beta1.WorkspaceKindSpec{
			PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
				Culling: culling,
			},
		},
	}
}

var _ = Describe("buildCullingConfig", func() {

	It("returns nil when the WorkspaceKind is nil", func() {
		Expect(buildCullingConfig(nil)).To(BeNil())
	})

	It("returns nil when the WorkspaceKind has no UID (missing from cluster)", func() {
		wsk := makeWsk(&kubefloworgv1beta1.WorkspaceKindCullingConfig{
			Enabled:            ptr.To(true),
			MaxInactiveSeconds: ptr.To(int32(1800)),
			ActivityProbe: kubefloworgv1beta1.ActivityProbe{
				Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{LastActivity: true},
			},
		})
		wsk.UID = "" // simulate missing WorkspaceKind
		Expect(buildCullingConfig(wsk)).To(BeNil())
	})

	It("returns nil when culling is disabled", func() {
		wsk := makeWsk(&kubefloworgv1beta1.WorkspaceKindCullingConfig{
			Enabled:            ptr.To(false),
			MaxInactiveSeconds: ptr.To(int32(1800)),
			ActivityProbe: kubefloworgv1beta1.ActivityProbe{
				Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{LastActivity: true},
			},
		})
		Expect(buildCullingConfig(wsk)).To(BeNil())
	})

	It("returns nil when the culling field is absent on the WorkspaceKind", func() {
		wsk := makeWsk(nil)
		Expect(buildCullingConfig(wsk)).To(BeNil())
	})

	It("returns CullingConfig with the configured MaxInactiveSeconds when culling is enabled", func() {
		wsk := makeWsk(&kubefloworgv1beta1.WorkspaceKindCullingConfig{
			Enabled:            ptr.To(true),
			MaxInactiveSeconds: ptr.To(int32(1800)),
			ActivityProbe: kubefloworgv1beta1.ActivityProbe{
				Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{LastActivity: true},
			},
		})
		result := buildCullingConfig(wsk)
		Expect(result).NotTo(BeNil())
		Expect(result.MaxInactiveSeconds).To(Equal(int32(1800)))
	})

	It("defaults MaxInactiveSeconds to 86400 when not set", func() {
		wsk := makeWsk(&kubefloworgv1beta1.WorkspaceKindCullingConfig{
			// MaxInactiveSeconds omitted — should default to 86400
			ActivityProbe: kubefloworgv1beta1.ActivityProbe{
				Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{LastActivity: true},
			},
		})
		result := buildCullingConfig(wsk)
		Expect(result).NotTo(BeNil())
		Expect(result.MaxInactiveSeconds).To(Equal(int32(86400)))
	})

	It("treats an absent Enabled field as enabled (default true)", func() {
		wsk := makeWsk(&kubefloworgv1beta1.WorkspaceKindCullingConfig{
			// Enabled omitted — should default to true
			MaxInactiveSeconds: ptr.To(int32(3600)),
			ActivityProbe: kubefloworgv1beta1.ActivityProbe{
				Jupyter: &kubefloworgv1beta1.ActivityProbeJupyter{LastActivity: true},
			},
		})
		result := buildCullingConfig(wsk)
		Expect(result).NotTo(BeNil())
		Expect(result.MaxInactiveSeconds).To(Equal(int32(3600)))
	})
})
