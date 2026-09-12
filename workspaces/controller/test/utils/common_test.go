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

package utils

import (
	"path/filepath"
	"testing"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"
)

func TestUtils(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "Utils Suite")
}

var _ = Describe("Render functions", func() {
	projectDir, err := GetProjectDir()
	Expect(err).NotTo(HaveOccurred())

	It("should render WorkspaceKind with new name", func() {
		samplePath := filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml")
		rendered, err := RenderActivityWorkspaceKind(samplePath, "custom-kind-name")
		Expect(err).NotTo(HaveOccurred())

		var obj unstructured.Unstructured
		Expect(yaml.Unmarshal([]byte(rendered), &obj.Object)).To(Succeed())
		Expect(obj.GetName()).To(Equal("custom-kind-name"))
		Expect(obj.GetKind()).To(Equal("WorkspaceKind"))
	})

	It("should render Workspace with new name and new kind", func() {
		samplePath := filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml")
		rendered, err := RenderActivityWorkspace(samplePath, "custom-ws-name", "custom-kind-name")
		Expect(err).NotTo(HaveOccurred())

		var obj unstructured.Unstructured
		Expect(yaml.Unmarshal([]byte(rendered), &obj.Object)).To(Succeed())
		Expect(obj.GetName()).To(Equal("custom-ws-name"))
		Expect(obj.GetKind()).To(Equal("Workspace"))

		kind, found, err := unstructured.NestedString(obj.Object, "spec", "kind")
		Expect(err).NotTo(HaveOccurred())
		Expect(found).To(BeTrue())
		Expect(kind).To(Equal("custom-kind-name"))
	})
})
