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

package workspaces_test

import (
	"time"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/utils/ptr"

	workspaces "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
)

// Test constants
const (
	testWorkspaceName      = "test-workspace"
	testNamespace          = "test-namespace"
	testWorkspaceKindName  = "jupyter-notebook"
	testUID                = "test-uid"
	testHomePVC            = "home-pvc"
	testHomeMountPath      = "/home/jovyan"
	testDataPVC1           = "data-pvc-1"
	testDataPVC2           = "data-pvc-2"
	testDataMountPath1     = "/data1"
	testDataMountPath2     = "/data2"
	testImageConfigID      = "default-image"
	testPodConfigID        = "default-pod"
	testDesiredImageID     = "desired-image"
	testDesiredPodID       = "desired-pod"
	testOldImageID         = "old-image"
	testOldPodID           = "old-pod"
	testNewImageID         = "new-image"
	testNewPodID           = "new-pod"
	testStateMessage       = "Running successfully"
	testAppLabel           = "test-app"
	testAnnotationKey      = "annotation-key"
	testAnnotationValue    = "annotation-value"
	testEnvironmentLabel   = "environment"
	testPythonValue        = "python"
	testSizeLabel          = "size"
	testSmallValue         = "small"
	testJupyterPortID      = "jupyter"
	testJupyterDisplayName = "Jupyter"
)

// Test data structures
type WorkspaceBuilder struct {
	workspace *kubefloworgv1beta1.Workspace
}

type WorkspaceKindBuilder struct {
	workspaceKind *kubefloworgv1beta1.WorkspaceKind
}

type TestExpectations struct {
	Name                 string
	Namespace            string
	WorkspaceKindName    string
	WorkspaceKindMissing bool
	State                workspaces.WorkspaceState
	StateMessage         string
	DeferUpdates         bool
	Paused               bool
	PendingRestart       bool
	HomePVCName          string
	HomeMountPath        string
	HomeReadOnly         bool
	DataVolumeCount      int
	ImageConfigID        string
	PodConfigID          string
	ServiceCount         int
	Labels               map[string]string
	Annotations          map[string]string
}

// Workspace builder functions
func NewWorkspaceBuilder() *WorkspaceBuilder {
	return &WorkspaceBuilder{
		workspace: &kubefloworgv1beta1.Workspace{
			ObjectMeta: metav1.ObjectMeta{
				Name:      testWorkspaceName,
				Namespace: testNamespace,
			},
			Spec: kubefloworgv1beta1.WorkspaceSpec{
				Kind:         testWorkspaceKindName,
				DeferUpdates: ptr.To(false),
				Paused:       ptr.To(false),
			},
			Status: kubefloworgv1beta1.WorkspaceStatus{
				State:          kubefloworgv1beta1.WorkspaceStateRunning,
				StateMessage:   testStateMessage,
				PendingRestart: false,
			},
		},
	}
}

func (wb *WorkspaceBuilder) WithName(name string) *WorkspaceBuilder {
	wb.workspace.Name = name
	return wb
}

func (wb *WorkspaceBuilder) WithNamespace(namespace string) *WorkspaceBuilder {
	wb.workspace.Namespace = namespace
	return wb
}

func (wb *WorkspaceBuilder) WithKind(kind string) *WorkspaceBuilder {
	wb.workspace.Spec.Kind = kind
	return wb
}

func (wb *WorkspaceBuilder) WithState(state kubefloworgv1beta1.WorkspaceState) *WorkspaceBuilder {
	wb.workspace.Status.State = state
	return wb
}

func (wb *WorkspaceBuilder) WithStateMessage(message string) *WorkspaceBuilder {
	wb.workspace.Status.StateMessage = message
	return wb
}

func (wb *WorkspaceBuilder) WithPodMetadata(labels, annotations map[string]string) *WorkspaceBuilder {
	wb.workspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{
		Labels:      labels,
		Annotations: annotations,
	}
	return wb
}

func (wb *WorkspaceBuilder) WithHomeVolume(pvcName string) *WorkspaceBuilder {
	wb.workspace.Spec.PodTemplate.Volumes.Home = ptr.To(pvcName)
	return wb
}

func (wb *WorkspaceBuilder) WithoutHomeVolume() *WorkspaceBuilder {
	wb.workspace.Spec.PodTemplate.Volumes.Home = nil
	return wb
}

func (wb *WorkspaceBuilder) WithDataVolumes(volumes []kubefloworgv1beta1.PodVolumeMount) *WorkspaceBuilder {
	wb.workspace.Spec.PodTemplate.Volumes.Data = volumes
	return wb
}

func (wb *WorkspaceBuilder) WithImageConfig(imageConfig string) *WorkspaceBuilder {
	wb.workspace.Spec.PodTemplate.Options.ImageConfig = imageConfig
	return wb
}

func (wb *WorkspaceBuilder) WithPodConfig(podConfig string) *WorkspaceBuilder {
	wb.workspace.Spec.PodTemplate.Options.PodConfig = podConfig
	return wb
}

func (wb *WorkspaceBuilder) WithDesiredImageConfig(desired string) *WorkspaceBuilder {
	wb.workspace.Status.PodTemplateOptions.ImageConfig.Desired = desired
	return wb
}

func (wb *WorkspaceBuilder) WithDesiredPodConfig(desired string) *WorkspaceBuilder {
	wb.workspace.Status.PodTemplateOptions.PodConfig.Desired = desired
	return wb
}

func (wb *WorkspaceBuilder) WithImageRedirectChain(chain []kubefloworgv1beta1.WorkspacePodOptionRedirectStep) *WorkspaceBuilder {
	wb.workspace.Status.PodTemplateOptions.ImageConfig.RedirectChain = chain
	return wb
}

func (wb *WorkspaceBuilder) WithPodRedirectChain(chain []kubefloworgv1beta1.WorkspacePodOptionRedirectStep) *WorkspaceBuilder {
	wb.workspace.Status.PodTemplateOptions.PodConfig.RedirectChain = chain
	return wb
}

func (wb *WorkspaceBuilder) WithActivity(lastActivity, lastUpdate int64) *WorkspaceBuilder {
	wb.workspace.Status.Activity = kubefloworgv1beta1.WorkspaceActivity{
		LastActivity: lastActivity,
		LastUpdate:   lastUpdate,
	}
	return wb
}

func (wb *WorkspaceBuilder) Build() *kubefloworgv1beta1.Workspace {
	return wb.workspace
}

// WorkspaceKind builder functions
func NewWorkspaceKindBuilder() *WorkspaceKindBuilder {
	return &WorkspaceKindBuilder{
		workspaceKind: &kubefloworgv1beta1.WorkspaceKind{
			ObjectMeta: metav1.ObjectMeta{
				Name: testWorkspaceKindName,
				UID:  types.UID(testUID),
			},
			Spec: kubefloworgv1beta1.WorkspaceKindSpec{
				Spawner: kubefloworgv1beta1.WorkspaceKindSpawner{
					DisplayName: "Jupyter Notebook",
					Description: "A Jupyter notebook workspace",
				},
				PodTemplate: kubefloworgv1beta1.WorkspaceKindPodTemplate{
					VolumeMounts: kubefloworgv1beta1.WorkspaceKindVolumeMounts{
						Home: testHomeMountPath,
					},
				},
			},
		},
	}
}

func (wkb *WorkspaceKindBuilder) WithName(name string) *WorkspaceKindBuilder {
	wkb.workspaceKind.Name = name
	return wkb
}

func (wkb *WorkspaceKindBuilder) WithUID(uid string) *WorkspaceKindBuilder {
	wkb.workspaceKind.UID = types.UID(uid)
	return wkb
}

func (wkb *WorkspaceKindBuilder) WithoutUID() *WorkspaceKindBuilder {
	wkb.workspaceKind.UID = ""
	return wkb
}

func (wkb *WorkspaceKindBuilder) WithHomeMountPath(path string) *WorkspaceKindBuilder {
	wkb.workspaceKind.Spec.PodTemplate.VolumeMounts.Home = path
	return wkb
}

func (wkb *WorkspaceKindBuilder) WithImageConfigs(configs []kubefloworgv1beta1.ImageConfigValue) *WorkspaceKindBuilder {
	wkb.workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values = configs
	return wkb
}

func (wkb *WorkspaceKindBuilder) WithPodConfigs(configs []kubefloworgv1beta1.PodConfigValue) *WorkspaceKindBuilder {
	wkb.workspaceKind.Spec.PodTemplate.Options.PodConfig.Values = configs
	return wkb
}

func (wkb *WorkspaceKindBuilder) Build() *kubefloworgv1beta1.WorkspaceKind {
	return wkb.workspaceKind
}

// Helper functions for creating common test data
func createDefaultDataVolumes() []kubefloworgv1beta1.PodVolumeMount {
	return []kubefloworgv1beta1.PodVolumeMount{
		{
			PVCName:   testDataPVC1,
			MountPath: testDataMountPath1,
			ReadOnly:  ptr.To(false),
		},
		{
			PVCName:   testDataPVC2,
			MountPath: testDataMountPath2,
			ReadOnly:  ptr.To(true),
		},
	}
}

func createDefaultPodMetadata() (map[string]string, map[string]string) {
	labels := map[string]string{testAppLabel: testAppLabel}
	annotations := map[string]string{testAnnotationKey: testAnnotationValue}
	return labels, annotations
}

func createDefaultImageConfigs() []kubefloworgv1beta1.ImageConfigValue {
	return []kubefloworgv1beta1.ImageConfigValue{
		{
			Id: testImageConfigID,
			Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
				DisplayName: "Default Image",
				Description: ptr.To("Default Jupyter image"),
				Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
					{Key: testEnvironmentLabel, Value: testPythonValue},
				},
			},
			Spec: kubefloworgv1beta1.ImageConfigSpec{
				Ports: []kubefloworgv1beta1.ImagePort{
					{
						Id:          testJupyterPortID,
						DisplayName: testJupyterDisplayName,
						Protocol:    kubefloworgv1beta1.ImagePortProtocolHTTP,
					},
				},
			},
		},
		{
			Id: testOldImageID,
			Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
				DisplayName: "Old Image",
				Description: ptr.To("Deprecated image"),
			},
			Redirect: &kubefloworgv1beta1.OptionRedirect{
				To: testNewImageID,
				Message: &kubefloworgv1beta1.RedirectMessage{
					Text:  "This image has been deprecated",
					Level: kubefloworgv1beta1.RedirectMessageLevelWarning,
				},
			},
		},
	}
}

func createDefaultPodConfigs() []kubefloworgv1beta1.PodConfigValue {
	return []kubefloworgv1beta1.PodConfigValue{
		{
			Id: testPodConfigID,
			Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
				DisplayName: "Default Pod Config",
				Description: ptr.To("Default pod configuration"),
				Labels: []kubefloworgv1beta1.OptionSpawnerLabel{
					{Key: testSizeLabel, Value: testSmallValue},
				},
			},
		},
		{
			Id: testOldPodID,
			Spawner: kubefloworgv1beta1.OptionSpawnerInfo{
				DisplayName: "Old Pod Config",
				Description: ptr.To("Deprecated pod config"),
			},
			Redirect: &kubefloworgv1beta1.OptionRedirect{
				To: testNewPodID,
				Message: &kubefloworgv1beta1.RedirectMessage{
					Text:  "This pod config has been deprecated",
					Level: kubefloworgv1beta1.RedirectMessageLevelDanger,
				},
			},
		},
	}
}

func createDefaultRedirectChain() []kubefloworgv1beta1.WorkspacePodOptionRedirectStep {
	return []kubefloworgv1beta1.WorkspacePodOptionRedirectStep{
		{Source: testOldImageID, Target: testNewImageID},
	}
}

// Assertion helper functions
func expectBasicWorkspaceFields(result *workspaces.Workspace, expectations *TestExpectations) {
	Expect(result.Name).To(Equal(expectations.Name))
	Expect(result.Namespace).To(Equal(expectations.Namespace))
	Expect(result.WorkspaceKind.Name).To(Equal(expectations.WorkspaceKindName))
	Expect(result.WorkspaceKind.Missing).To(Equal(expectations.WorkspaceKindMissing))
	Expect(result.State).To(Equal(expectations.State))
	Expect(result.StateMessage).To(Equal(expectations.StateMessage))
	Expect(result.DeferUpdates).To(Equal(expectations.DeferUpdates))
	Expect(result.Paused).To(Equal(expectations.Paused))
	Expect(result.PendingRestart).To(Equal(expectations.PendingRestart))
}

func expectHomeVolume(result *workspaces.Workspace, expectations *TestExpectations) {
	if expectations.HomePVCName == "" {
		Expect(result.PodTemplate.Volumes.Home).To(BeNil())
	} else {
		Expect(result.PodTemplate.Volumes.Home).ToNot(BeNil())
		Expect(result.PodTemplate.Volumes.Home.PVCName).To(Equal(expectations.HomePVCName))
		Expect(result.PodTemplate.Volumes.Home.MountPath).To(Equal(expectations.HomeMountPath))
		Expect(result.PodTemplate.Volumes.Home.ReadOnly).To(Equal(expectations.HomeReadOnly))
	}
}

func expectDataVolumes(result *workspaces.Workspace, expectations *TestExpectations) {
	Expect(result.PodTemplate.Volumes.Data).To(HaveLen(expectations.DataVolumeCount))
}

func expectPodMetadata(result *workspaces.Workspace, expectations *TestExpectations) {
	if expectations.Labels != nil {
		for key, value := range expectations.Labels {
			Expect(result.PodTemplate.PodMetadata.Labels).To(HaveKeyWithValue(key, value))
		}
	}
	if expectations.Annotations != nil {
		for key, value := range expectations.Annotations {
			Expect(result.PodTemplate.PodMetadata.Annotations).To(HaveKeyWithValue(key, value))
		}
	}
}

func expectServices(result *workspaces.Workspace, expectations *TestExpectations) {
	if expectations.ServiceCount == 0 {
		Expect(result.Services).To(BeNil())
	} else {
		Expect(result.Services).To(HaveLen(expectations.ServiceCount))
	}
}

func validateWorkspaceModel(result *workspaces.Workspace, expectations *TestExpectations) {
	expectBasicWorkspaceFields(result, expectations)
	expectHomeVolume(result, expectations)
	expectDataVolumes(result, expectations)
	expectPodMetadata(result, expectations)
	expectServices(result, expectations)
}

var _ = Describe("Workspace Functions", func() {
	var testTime = metav1.NewTime(time.Now())

	Describe("NewWorkspaceModelFromWorkspace", func() {
		DescribeTable("should create workspace models correctly",
			func(
				workspaceBuilder func() *kubefloworgv1beta1.Workspace,
				workspaceKindBuilder func() *kubefloworgv1beta1.WorkspaceKind,
				expectations TestExpectations,
			) {
				workspace := workspaceBuilder()
				workspaceKind := workspaceKindBuilder()

				result := workspaces.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)
				validateWorkspaceModel(&result, &expectations)
			},

			Entry("complete workspace with matching workspace kind",
				func() *kubefloworgv1beta1.Workspace {
					labels, annotations := createDefaultPodMetadata()
					return NewWorkspaceBuilder().
						WithPodMetadata(labels, annotations).
						WithHomeVolume(testHomePVC).
						WithDataVolumes(createDefaultDataVolumes()).
						WithImageConfig(testImageConfigID).
						WithPodConfig(testPodConfigID).
						WithDesiredImageConfig(testDesiredImageID).
						WithDesiredPodConfig(testDesiredPodID).
						WithImageRedirectChain(createDefaultRedirectChain()).
						WithPodRedirectChain(createDefaultRedirectChain()).
						WithActivity(testTime.Unix(), testTime.Unix()).
						Build()
				},
				func() *kubefloworgv1beta1.WorkspaceKind {
					return NewWorkspaceKindBuilder().
						WithImageConfigs(createDefaultImageConfigs()).
						WithPodConfigs(createDefaultPodConfigs()).
						Build()
				},
				TestExpectations{
					Name:                 testWorkspaceName,
					Namespace:            testNamespace,
					WorkspaceKindName:    testWorkspaceKindName,
					WorkspaceKindMissing: false,
					State:                workspaces.WorkspaceStateRunning,
					StateMessage:         testStateMessage,
					DeferUpdates:         false,
					Paused:               false,
					PendingRestart:       false,
					HomePVCName:          testHomePVC,
					HomeMountPath:        testHomeMountPath,
					HomeReadOnly:         false,
					DataVolumeCount:      2,
					ServiceCount:         1,
					Labels:               map[string]string{testAppLabel: testAppLabel},
					Annotations:          map[string]string{testAnnotationKey: testAnnotationValue},
				},
			),

			Entry("workspace with nil workspace kind",
				func() *kubefloworgv1beta1.Workspace {
					return NewWorkspaceBuilder().
						WithHomeVolume(testHomePVC).
						Build()
				},
				func() *kubefloworgv1beta1.WorkspaceKind {
					return nil
				},
				TestExpectations{
					Name:                 testWorkspaceName,
					Namespace:            testNamespace,
					WorkspaceKindName:    testWorkspaceKindName,
					WorkspaceKindMissing: true,
					State:                workspaces.WorkspaceStateRunning,
					StateMessage:         testStateMessage,
					HomePVCName:          testHomePVC,
					HomeMountPath:        workspaces.UnknownHomeMountPath,
					HomeReadOnly:         false,
					DataVolumeCount:      0,
					ServiceCount:         0,
				},
			),

			Entry("workspace kind without UID",
				func() *kubefloworgv1beta1.Workspace {
					return NewWorkspaceBuilder().
						WithHomeVolume(testHomePVC).
						Build()
				},
				func() *kubefloworgv1beta1.WorkspaceKind {
					return NewWorkspaceKindBuilder().
						WithoutUID().
						Build()
				},
				TestExpectations{
					Name:                 testWorkspaceName,
					Namespace:            testNamespace,
					WorkspaceKindName:    testWorkspaceKindName,
					WorkspaceKindMissing: true,
					State:                workspaces.WorkspaceStateRunning,
					StateMessage:         testStateMessage,
					HomePVCName:          testHomePVC,
					HomeMountPath:        workspaces.UnknownHomeMountPath,
					HomeReadOnly:         false,
					DataVolumeCount:      0,
					ServiceCount:         0,
				},
			),

			Entry("workspace without home volume",
				func() *kubefloworgv1beta1.Workspace {
					return NewWorkspaceBuilder().
						WithoutHomeVolume().
						Build()
				},
				func() *kubefloworgv1beta1.WorkspaceKind {
					return NewWorkspaceKindBuilder().Build()
				},
				TestExpectations{
					Name:                 testWorkspaceName,
					Namespace:            testNamespace,
					WorkspaceKindName:    testWorkspaceKindName,
					WorkspaceKindMissing: false,
					State:                workspaces.WorkspaceStateRunning,
					StateMessage:         testStateMessage,
					HomePVCName:          "", // Empty means nil home volume
					DataVolumeCount:      0,
					ServiceCount:         0,
				},
			),
		)

		DescribeTable("should map workspace states correctly",
			func(inputState kubefloworgv1beta1.WorkspaceState, expectedState workspaces.WorkspaceState) {
				workspace := NewWorkspaceBuilder().WithState(inputState).Build()
				workspaceKind := NewWorkspaceKindBuilder().Build()

				result := workspaces.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)
				Expect(result.State).To(Equal(expectedState))
			},
			Entry("Running", kubefloworgv1beta1.WorkspaceStateRunning, workspaces.WorkspaceStateRunning),
			Entry("Terminating", kubefloworgv1beta1.WorkspaceStateTerminating, workspaces.WorkspaceStateTerminating),
			Entry("Paused", kubefloworgv1beta1.WorkspaceStatePaused, workspaces.WorkspaceStatePaused),
			Entry("Pending", kubefloworgv1beta1.WorkspaceStatePending, workspaces.WorkspaceStatePending),
			Entry("Error", kubefloworgv1beta1.WorkspaceStateError, workspaces.WorkspaceStateError),
			Entry("Unknown", kubefloworgv1beta1.WorkspaceStateUnknown, workspaces.WorkspaceStateUnknown),
		)

		Context("error cases", func() {
			It("should panic when workspace kind name doesn't match", func() {
				workspace := NewWorkspaceBuilder().Build()
				workspaceKind := NewWorkspaceKindBuilder().WithName("different-kind").Build()

				Expect(func() {
					workspaces.NewWorkspaceModelFromWorkspace(workspace, workspaceKind)
				}).To(Panic())
			})
		})
	})
})
