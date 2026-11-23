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
	"fmt"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

var _ = Describe("RenderGoTemplate", func() {

	pathPrefixFunc := func(portId kubefloworgv1beta1.PortId) string {
		return fmt.Sprintf("/workspace/default/my-ws/%s", portId)
	}

	It("should return plain strings unchanged", func() {
		out, err := RenderGoTemplate("plain-value", pathPrefixFunc)
		Expect(err).NotTo(HaveOccurred())
		Expect(out).To(Equal("plain-value"))
	})

	It("should render httpPathPrefix calls in template", func() {
		out, err := RenderGoTemplate(`{{ httpPathPrefix "jupyterlab" }}/lab`, pathPrefixFunc)
		Expect(err).NotTo(HaveOccurred())
		Expect(out).To(Equal("/workspace/default/my-ws/jupyterlab/lab"))
	})

	It("should render multiple httpPathPrefix calls in one template", func() {
		out, err := RenderGoTemplate(
			`primary={{ httpPathPrefix "main" }},secondary={{ httpPathPrefix "aux" }}`,
			pathPrefixFunc,
		)
		Expect(err).NotTo(HaveOccurred())
		Expect(out).To(Equal("primary=/workspace/default/my-ws/main,secondary=/workspace/default/my-ws/aux"))
	})

	It("should return a parse error for invalid template syntax", func() {
		out, err := RenderGoTemplate(`{{ httpPathPrefix "unclosed"`, pathPrefixFunc)
		Expect(err).To(MatchError(ContainSubstring("failed to parse template")))
		Expect(out).To(BeEmpty())
	})

	It("should return an execution error for invalid argument types", func() {
		out, err := RenderGoTemplate(`{{ httpPathPrefix 123 }}`, pathPrefixFunc)
		Expect(err).To(MatchError(ContainSubstring("failed to execute template")))
		Expect(out).To(BeEmpty())
	})
})
