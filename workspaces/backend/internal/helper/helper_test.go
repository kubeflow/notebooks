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
	"testing"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func TestBuildScheme(t *testing.T) {
	scheme, err := BuildScheme()

	require.NoError(t, err, "BuildScheme should not return an error")
	require.NotNil(t, scheme, "The returned scheme should not be nil")

	podGVK := corev1.SchemeGroupVersion.WithKind("Pod")
	assert.True(t, scheme.Recognizes(podGVK), "Scheme should recognize core Kubernetes types like Pod")

	workspaceGVK := schema.GroupVersionKind{
		Group:   "kubeflow.org",
		Version: "v1beta1",
		Kind:    "Workspace",
	}
	assert.True(t, scheme.Recognizes(workspaceGVK), "Scheme should recognize Kubeflow Workspace type")
}

// Tests for the validation helper functions
func TestStatusCausesFromAPIStatus(t *testing.T) {
	sampleCauses := []metav1.StatusCause{
		{
			Type:    metav1.CauseTypeFieldValueInvalid,
			Message: "Invalid value",
			Field:   "spec.name",
		},
	}

	t.Run("should extract causes from a valid validation error", func(t *testing.T) {
		validationError := apierrors.NewInvalid(
			kubefloworgv1beta1.GroupVersion.WithKind("Workspace").GroupKind(),
			"my-workspace",
			field.ErrorList{
				field.Invalid(field.NewPath("spec", "name"), "my-workspace-!@#", "invalid name"),
			},
		)
		validationError.ErrStatus.Details.Causes = sampleCauses

		causes := StatusCausesFromAPIStatus(validationError)
		assert.Equal(t, sampleCauses, causes)
	})

	t.Run("should return nil for a non-validation APIStatus error", func(t *testing.T) {
		notFoundError := apierrors.NewNotFound(
			kubefloworgv1beta1.GroupVersion.WithResource("Workspace").GroupResource(),
			"my-workspace",
		)
		causes := StatusCausesFromAPIStatus(notFoundError)
		assert.Nil(t, causes)
	})

	t.Run("should return nil for a standard non-API error", func(t *testing.T) {
		standardError := errors.New("this is a standard error")
		causes := StatusCausesFromAPIStatus(standardError)
		assert.Nil(t, causes)
	})
}

func TestValidateFieldIsNotEmpty(t *testing.T) {
	path := field.NewPath("test")

	t.Run("should return no errors for a non-empty value", func(t *testing.T) {
		errs := ValidateFieldIsNotEmpty(path, "some-value")
		assert.Empty(t, errs)
	})

	t.Run("should return a required error for an empty value", func(t *testing.T) {
		errs := ValidateFieldIsNotEmpty(path, "")
		assert.Len(t, errs, 1)
		assert.Equal(t, field.ErrorTypeRequired, errs[0].Type)
	})
}

func TestValidateFieldIsDNS1123Subdomain(t *testing.T) {
	path := field.NewPath("metadata", "name")
	testCases := []struct {
		name      string
		value     string
		expectErr bool
	}{
		{"valid subdomain", "my-valid-subdomain", false},
		{"valid subdomain with dots", "my.valid.subdomain", false},
		{"empty value", "", true},
		{"value with uppercase", "Invalid-Name", true},
		{"value starting with hyphen", "-invalid", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			errs := ValidateFieldIsDNS1123Subdomain(path, tc.value)
			if tc.expectErr {
				assert.NotEmpty(t, errs)
			} else {
				assert.Empty(t, errs)
			}
		})
	}
}

func TestValidateFieldIsDNS1123Label(t *testing.T) {
	path := field.NewPath("metadata", "namespace")
	testCases := []struct {
		name      string
		value     string
		expectErr bool
	}{
		{"valid label", "my-valid-label", false},
		{"empty value", "", true},
		{"value with dots", "invalid.label", true},
		{"value with uppercase", "Invalid-Label", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			errs := ValidateFieldIsDNS1123Label(path, tc.value)
			if tc.expectErr {
				assert.NotEmpty(t, errs)
			} else {
				assert.Empty(t, errs)
			}
		})
	}
}
