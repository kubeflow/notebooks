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
	"errors"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

var _ = Describe("Helper functions", func() {

	Describe("StatusCausesFromAPIStatus", func() {
		var sampleCauses = []metav1.StatusCause{
			{
				Type:    metav1.CauseTypeFieldValueInvalid,
				Message: "Invalid value",
				Field:   "spec.name",
			},
		}

		It("should extract causes from a valid validation error", func() {
			validationError := apierrors.NewInvalid(
				kubefloworgv1beta1.GroupVersion.WithKind("Workspace").GroupKind(),
				"my-workspace",
				field.ErrorList{
					field.Invalid(field.NewPath("spec", "name"), "my-workspace-!@#", "invalid name"),
				},
			)
			validationError.ErrStatus.Details.Causes = sampleCauses

			causes := StatusCausesFromAPIStatus(validationError)
			Expect(causes).To(Equal(sampleCauses))
		})

		It("should return nil for a non-validation APIStatus error", func() {
			notFoundError := apierrors.NewNotFound(
				kubefloworgv1beta1.GroupVersion.WithResource("Workspace").GroupResource(),
				"my-workspace",
			)
			causes := StatusCausesFromAPIStatus(notFoundError)
			Expect(causes).To(BeNil())
		})

		It("should return nil for a standard non-API error", func() {
			standardError := errors.New("this is a standard error")
			causes := StatusCausesFromAPIStatus(standardError)
			Expect(causes).To(BeNil())
		})
	})

	Describe("ValidateFieldIsNotEmpty", func() {
		path := field.NewPath("test")

		It("should return no errors for a non-empty value", func() {
			errs := ValidateFieldIsNotEmpty(path, "some-value")
			Expect(errs).To(BeEmpty())
		})

		It("should return a required error for an empty value", func() {
			errs := ValidateFieldIsNotEmpty(path, "")
			Expect(errs).To(HaveLen(1))
			Expect(errs[0].Type).To(Equal(field.ErrorTypeRequired))
		})
	})

	Describe("ValidateFieldIsDNS1123Subdomain", func() {
		path := field.NewPath("metadata", "name")

		DescribeTable("should validate DNS1123 subdomain",
			func(value string, expectErr bool) {
				errs := ValidateFieldIsDNS1123Subdomain(path, value)
				if expectErr {
					Expect(errs).NotTo(BeEmpty())
				} else {
					Expect(errs).To(BeEmpty())
				}
			},
			Entry("valid subdomain", "my-valid-subdomain", false),
			Entry("valid subdomain with dots", "my.valid.subdomain", false),
			Entry("empty value", "", true),
			Entry("value with uppercase", "Invalid-Name", true),
			Entry("value starting with hyphen", "-invalid", true),
		)
	})

	Describe("ValidateFieldIsDNS1123Label", func() {
		path := field.NewPath("metadata", "namespace")

		DescribeTable("should validate DNS1123 label",
			func(value string, expectErr bool) {
				errs := ValidateFieldIsDNS1123Label(path, value)
				if expectErr {
					Expect(errs).NotTo(BeEmpty())
				} else {
					Expect(errs).To(BeEmpty())
				}
			},
			Entry("valid label", "my-valid-label", false),
			Entry("empty value", "", true),
			Entry("value with dots", "invalid.label", true),
			Entry("value with uppercase", "Invalid-Label", true),
		)
	})
})
