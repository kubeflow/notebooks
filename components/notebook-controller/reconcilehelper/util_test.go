package reconcile

import (
	"reflect"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
)

func TestCopyStatefulSetFieldsPodSpecification(t *testing.T) {
	tests := []struct {
		name                     string
		previousPodSpecification corev1.PodSpec
		desiredPodSpecification  corev1.PodSpec
		storedPodSpecification   corev1.PodSpec
		requiresUpdate           bool
	}{
		{
			name: "IgnoresStoredDefaults",
			previousPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:1"}},
			},
			desiredPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:1"}},
			},
			storedPodSpecification: corev1.PodSpec{
				Containers:    []corev1.Container{{Name: "notebook", Image: "notebook:1"}},
				RestartPolicy: corev1.RestartPolicyAlways,
				DNSPolicy:     corev1.DNSClusterFirst,
			},
			requiresUpdate: false,
		},
		{
			name: "IgnoresStoredAdditionalEnvironmentVariable",
			previousPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{
					Name: "notebook",
					Env:  []corev1.EnvVar{{Name: "CONFIGURED"}},
				}},
			},
			desiredPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{
					Name: "notebook",
					Env:  []corev1.EnvVar{{Name: "CONFIGURED"}},
				}},
			},
			storedPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{
					Name: "notebook",
					Env: []corev1.EnvVar{
						{Name: "CONFIGURED"},
						{Name: "ADDED"},
					},
				}},
			},
			requiresUpdate: false,
		},
		{
			name: "DetectsDesiredFieldChange",
			previousPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:1"}},
			},
			desiredPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:2"}},
			},
			storedPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:1"}},
			},
			requiresUpdate: true,
		},
		{
			name: "DetectsRemovedDesiredListEntry",
			previousPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{
					Name: "notebook",
					Env: []corev1.EnvVar{
						{Name: "RETAINED"},
						{Name: "REMOVED"},
					},
				}},
			},
			desiredPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{
					Name: "notebook",
					Env:  []corev1.EnvVar{{Name: "RETAINED"}},
				}},
			},
			storedPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{
					Name: "notebook",
					Env: []corev1.EnvVar{
						{Name: "RETAINED"},
						{Name: "REMOVED"},
					},
				}},
			},
			requiresUpdate: true,
		},
		{
			name: "DetectsStoredDesiredFieldDrift",
			previousPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:1"}},
			},
			desiredPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:1"}},
			},
			storedPodSpecification: corev1.PodSpec{
				Containers: []corev1.Container{{Name: "notebook", Image: "notebook:modified"}},
			},
			requiresUpdate: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			desiredReplicas := int32(1)
			storedReplicas := int32(1)
			previousStatefulSet := &appsv1.StatefulSet{
				Spec: appsv1.StatefulSetSpec{
					Template: corev1.PodTemplateSpec{Spec: test.previousPodSpecification},
				},
			}
			desiredStatefulSet := &appsv1.StatefulSet{
				Spec: appsv1.StatefulSetSpec{
					Replicas: &desiredReplicas,
					Template: corev1.PodTemplateSpec{Spec: test.desiredPodSpecification},
				},
			}
			storedStatefulSet := &appsv1.StatefulSet{
				Spec: appsv1.StatefulSetSpec{
					Replicas: &storedReplicas,
					Template: corev1.PodTemplateSpec{Spec: test.storedPodSpecification},
				},
			}
			if err := SetStatefulSetTemplateHash(previousStatefulSet); err != nil {
				t.Fatalf("could not hash previous StatefulSet template: %v", err)
			}
			if err := SetStatefulSetTemplateHash(desiredStatefulSet); err != nil {
				t.Fatalf("could not hash desired StatefulSet template: %v", err)
			}
			storedStatefulSet.Annotations = previousStatefulSet.Annotations

			if requiresUpdate := CopyStatefulSetFields(desiredStatefulSet, storedStatefulSet); requiresUpdate != test.requiresUpdate {
				t.Fatalf("expected requiresUpdate %t, got %t", test.requiresUpdate, requiresUpdate)
			}
			if test.requiresUpdate && !reflect.DeepEqual(storedStatefulSet.Spec.Template, desiredStatefulSet.Spec.Template) {
				t.Fatalf("expected desired pod template to be copied")
			}
		})
	}
}

func TestCopyStatefulSetFieldsAddsTemplateHashToExistingStatefulSet(t *testing.T) {
	replicas := int32(1)
	desiredStatefulSet := &appsv1.StatefulSet{
		Spec: appsv1.StatefulSetSpec{
			Replicas: &replicas,
			Template: corev1.PodTemplateSpec{
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{Name: "notebook"}},
				},
			},
		},
	}
	storedStatefulSet := desiredStatefulSet.DeepCopy()
	if err := SetStatefulSetTemplateHash(desiredStatefulSet); err != nil {
		t.Fatalf("could not hash desired StatefulSet template: %v", err)
	}

	if !CopyStatefulSetFields(desiredStatefulSet, storedStatefulSet) {
		t.Fatal("expected existing StatefulSet without template hash to require update")
	}
	if storedStatefulSet.Annotations[StatefulSetTemplateHashAnnotation] == "" {
		t.Fatal("expected template hash annotation to be copied")
	}
	if CopyStatefulSetFields(desiredStatefulSet, storedStatefulSet) {
		t.Fatal("expected StatefulSet to converge after template hash migration")
	}
}
