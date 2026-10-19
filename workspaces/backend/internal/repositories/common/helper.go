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

package common

import (
	"context"
	"fmt"
	"maps"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"sigs.k8s.io/controller-runtime/pkg/client"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
)

// ResolveNamespaceLabels fetches the labels of the namespace with the given name, used to evaluate
// `matchNamespace` conditions in filterRules.
//
// It returns nil (and no error) when the name is empty, so that matchNamespace conditions are
// conservatively treated as non-matching. When a name is given but the namespace does not exist,
// it returns an internal validation error so the caller can surface a 422 to the client.
//
// fieldPath identifies the caller's user-facing input (e.g. the `namespace` path param, the
// `namespaceFilter` query param, or `context.namespace.name` in the request body) so the
// validation error points at the right field.
func ResolveNamespaceLabels(ctx context.Context, k8sClient client.Client, namespaceName string, fieldPath *field.Path) (map[string]string, error) {
	if namespaceName == "" {
		return nil, nil
	}

	namespace := &corev1.Namespace{}
	if err := k8sClient.Get(ctx, client.ObjectKey{Name: namespaceName}, namespace); err != nil {
		if apierrors.IsNotFound(err) {
			errDetail := fmt.Sprintf("namespace %q not found", namespaceName)
			valErrs := field.ErrorList{field.Invalid(fieldPath, namespaceName, errDetail)}
			return nil, helper.NewInternalValidationError(valErrs)
		}
		return nil, err
	}

	// copy the labels into a map we own; also ensures a non-nil map so matchNamespace conditions
	// are evaluated (namespace present) even when the namespace has no labels.
	labels := make(map[string]string, len(namespace.Labels))
	maps.Copy(labels, namespace.Labels)
	return labels, nil
}
