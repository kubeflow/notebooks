package controllers

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"reflect"
	"testing"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/yaml"

	"sigs.k8s.io/controller-runtime/pkg/client/fake"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/kubernetes/scheme"

	nbv1beta1 "github.com/kubeflow/notebooks/components/notebook-controller/api/v1beta1"
	ctrl "sigs.k8s.io/controller-runtime"

	_ "embed"
)

func TestNbNameFromInvolvedObject(t *testing.T) {
	testPod := &corev1.Pod{
		ObjectMeta: v1.ObjectMeta{
			Name:      "test-notebook-0",
			Namespace: "test-namespace",
			Labels: map[string]string{
				"notebook-name": "test-notebook",
			},
		},
	}

	podEvent := &corev1.Event{
		ObjectMeta: v1.ObjectMeta{
			Name: "pod-event",
		},
		InvolvedObject: corev1.ObjectReference{
			Kind:      "Pod",
			Name:      "test-notebook-0",
			Namespace: "test-namespace",
		},
	}

	testSts := &appsv1.StatefulSet{
		ObjectMeta: v1.ObjectMeta{
			Name:      "test-notebook",
			Namespace: "test",
		},
	}

	stsEvent := &corev1.Event{
		ObjectMeta: v1.ObjectMeta{
			Name: "sts-event",
		},
		InvolvedObject: corev1.ObjectReference{
			Kind:      "StatefulSet",
			Name:      "test-notebook",
			Namespace: "test-namespace",
		},
	}

	tests := []struct {
		name           string
		event          *corev1.Event
		expectedNbName string
	}{
		{
			name:           "pod event",
			event:          podEvent,
			expectedNbName: "test-notebook",
		},
		{
			name:           "statefulset event",
			event:          stsEvent,
			expectedNbName: "test-notebook",
		},
	}
	objects := []runtime.Object{testPod, testSts}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c := fake.NewFakeClientWithScheme(scheme.Scheme, objects...)
			nbName, err := nbNameFromInvolvedObject(c, &test.event.InvolvedObject)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if nbName != test.expectedNbName {
				t.Fatalf("Got %v, Expected %v", nbName, test.expectedNbName)
			}
		})
	}
}

func TestCreateNotebookStatus(t *testing.T) {

	tests := []struct {
		name             string
		currentNb        nbv1beta1.Notebook
		pod              corev1.Pod
		sts              appsv1.StatefulSet
		expectedNbStatus nbv1beta1.NotebookStatus
	}{
		{
			name: "NotebookStatusInitialization",
			currentNb: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			pod: corev1.Pod{},
			sts: appsv1.StatefulSet{},
			expectedNbStatus: nbv1beta1.NotebookStatus{
				Conditions:     []nbv1beta1.NotebookCondition{},
				ReadyReplicas:  int32(0),
				ContainerState: corev1.ContainerState{},
			},
		},
		{
			name: "NotebookStatusReadyReplicas",
			currentNb: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			pod: corev1.Pod{},
			sts: appsv1.StatefulSet{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: appsv1.StatefulSetStatus{
					ReadyReplicas: int32(1),
				},
			},
			expectedNbStatus: nbv1beta1.NotebookStatus{
				Conditions:     []nbv1beta1.NotebookCondition{},
				ReadyReplicas:  int32(1),
				ContainerState: corev1.ContainerState{},
			},
		},
		{
			name: "NotebookContainerState",
			currentNb: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			pod: corev1.Pod{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: corev1.PodStatus{
					ContainerStatuses: []corev1.ContainerStatus{
						{
							Name: "test",
							State: corev1.ContainerState{
								Running: &corev1.ContainerStateRunning{
									StartedAt: v1.Time{},
								},
							},
						},
					},
				},
			},
			sts: appsv1.StatefulSet{},
			expectedNbStatus: nbv1beta1.NotebookStatus{
				Conditions:    []nbv1beta1.NotebookCondition{},
				ReadyReplicas: int32(0),
				ContainerState: corev1.ContainerState{
					Running: &corev1.ContainerStateRunning{
						StartedAt: v1.Time{},
					},
				},
			},
		},
		{
			name: "mirroringPodConditions",
			pod: corev1.Pod{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: corev1.PodStatus{
					Conditions: []corev1.PodCondition{
						{
							Type:               "Running",
							LastProbeTime:      v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
							LastTransitionTime: v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
						},
						{
							Type:               "Waiting",
							LastProbeTime:      v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
							LastTransitionTime: v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
							Reason:             "PodInitializing",
						},
					},
				},
			},
			sts: appsv1.StatefulSet{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: appsv1.StatefulSetStatus{
					ReadyReplicas: int32(1),
				},
			},
			expectedNbStatus: nbv1beta1.NotebookStatus{
				Conditions: []nbv1beta1.NotebookCondition{
					{
						Type:               "Running",
						LastProbeTime:      v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
						LastTransitionTime: v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
					},
					{
						Type:               "Waiting",
						LastProbeTime:      v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
						LastTransitionTime: v1.Date(2022, time.Month(8), 30, 1, 10, 30, 0, time.UTC),
						Reason:             "PodInitializing",
					},
				},
				ReadyReplicas:  int32(1),
				ContainerState: corev1.ContainerState{},
			},
		},
		{
			name: "unschedulablePod",
			pod: corev1.Pod{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: corev1.PodStatus{
					Conditions: []corev1.PodCondition{
						{
							Type:               "PodScheduled",
							LastProbeTime:      v1.Date(2022, time.Month(4), 21, 1, 10, 30, 0, time.UTC),
							LastTransitionTime: v1.Date(2022, time.Month(4), 21, 1, 10, 30, 0, time.UTC),
							Message:            "0/1 nodes are available: 1 Insufficient cpu.",
							Status:             "false",
							Reason:             "Unschedulable",
						},
					},
				},
			},
			sts: appsv1.StatefulSet{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: appsv1.StatefulSetStatus{},
			},
			expectedNbStatus: nbv1beta1.NotebookStatus{
				Conditions: []nbv1beta1.NotebookCondition{
					{
						Type:               "PodScheduled",
						LastProbeTime:      v1.Date(2022, time.Month(4), 21, 1, 10, 30, 0, time.UTC),
						LastTransitionTime: v1.Date(2022, time.Month(4), 21, 1, 10, 30, 0, time.UTC),
						Message:            "0/1 nodes are available: 1 Insufficient cpu.",
						Status:             "false",
						Reason:             "Unschedulable",
					},
				},
				ReadyReplicas:  int32(0),
				ContainerState: corev1.ContainerState{},
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			r := createMockReconciler()
			req := ctrl.Request{}
			status, err := createNotebookStatus(r, &test.currentNb, &test.sts, &test.pod, req)
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			if !reflect.DeepEqual(status, test.expectedNbStatus) {
				t.Errorf("\nExpect: %v; \nOutput: %v", test.expectedNbStatus, status)
			}
		})
	}

}

func TestGenerateVirtualServices(t *testing.T) {

	tests := []struct {
		name                    string
		notebook                nbv1beta1.Notebook
		expectedVirtualServices []*unstructured.Unstructured
		expectedErrorState      error
		testEnv                 map[string]string
	}{
		{
			name: "Default config",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_default_config.yaml"),
			testEnv:                 map[string]string{},
		},
		{
			name: "Istio host set",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_istio_host_set.yaml"),
			testEnv: map[string]string{
				"ISTIO_HOST": "kubeflow.example.org",
			},
		},
		{
			name: "Istio gateway set",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_istio_gateway_set.yaml"),
			testEnv: map[string]string{
				"ISTIO_GATEWAY": "test/test-gateway",
			},
		},
		{
			name: "Cluster domain set",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_cluster_domain_set.yaml"),
			testEnv: map[string]string{
				"CLUSTER_DOMAIN": "example.local",
			},
		},
		{
			name: "Notebooks subdomain configured",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_subdomains.yaml"),
			testEnv: map[string]string{
				"ISTIO_USE_NOTEBOOK_SUBDOMAINS": "true",
				"ISTIO_HOST_NOTEBOOK":           "${NAMESPACE}-notebook.kubeflow.example.org",
				"ISTIO_HOST_AUTH":               "kubeflow.example.org",
			},
		},
		{
			name: "Notebooks subdomain configured with different auth path",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_subdomains_different_auth_path.yaml"),
			testEnv: map[string]string{
				"ISTIO_USE_NOTEBOOK_SUBDOMAINS": "true",
				"ISTIO_HOST_NOTEBOOK":           "${NAMESPACE}-notebook.kubeflow.example.org",
				"ISTIO_HOST_AUTH":               "kubeflow.example.org",
				"ISTIO_AUTH_PATH":               "/different-auth/",
			},
		},
		{
			name: "Notebooks invalid subdomain configuration: missing ISTIO_HOST_AUTH",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedErrorState: fmt.Errorf("generate virtual service for auth redirect error: invalid ISTIO_HOST_AUTH: When ISTIO_USE_NOTEBOOK_SUBDOMAINS is set, the ISTIO_HOST_AUTH environment variable must be defined."),
			testEnv: map[string]string{
				"ISTIO_USE_NOTEBOOK_SUBDOMAINS": "true",
				"ISTIO_HOST_NOTEBOOK":           "${NAMESPACE}-notebook.kubeflow.example.org",
			},
		},
		{
			name: "Notebooks invalid subdomain configuration: missing ISTIO_HOST_NOTEBOOK",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedErrorState: fmt.Errorf("invalid ISTIO_HOST_NOTEBOOK: When ISTIO_USE_NOTEBOOK_SUBDOMAINS is set, the placeholder ${NAMESPACE} must be defined in ISTIO_HOST_NOTEBOOK."),
			testEnv: map[string]string{
				"ISTIO_USE_NOTEBOOK_SUBDOMAINS": "true",
				"ISTIO_HOST_AUTH":               "kubeflow.example.org",
			},
		},
		{
			name: "Notebooks invalid subdomain configuration: invalid ISTIO_HOST_NOTEBOOK",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedErrorState: fmt.Errorf("invalid ISTIO_HOST_NOTEBOOK: When ISTIO_USE_NOTEBOOK_SUBDOMAINS is set, the placeholder ${NAMESPACE} must be defined in ISTIO_HOST_NOTEBOOK."),
			testEnv: map[string]string{
				"ISTIO_USE_NOTEBOOK_SUBDOMAINS": "true",
				"ISTIO_HOST_NOTEBOOK":           "${NAMESPACE-notebook.kubeflow.example.org",
				"ISTIO_HOST_AUTH":               "kubeflow.example.org",
			},
		},
		{
			name: "Notebooks header annotation configured",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
					Annotations: map[string]string{
						"notebooks.kubeflow.org/http-headers-request-set": `{"ExampleHeader": "Example-Value", "ExampleHeader2": "Example-Value2"}`,
					},
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_headers.yaml"),
			testEnv:                 map[string]string{},
		},
		{
			name: "Notebooks invalid header annotation configured",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
					Annotations: map[string]string{
						"notebooks.kubeflow.org/http-headers-request-set": `{"ExampleHeader": "Example-INVALID_JSON}`,
					},
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_default_config.yaml"),
			testEnv:                 map[string]string{},
		},
		{
			name: "Notebooks rewrite annotation configured",
			notebook: nbv1beta1.Notebook{
				ObjectMeta: v1.ObjectMeta{
					Name:      "test",
					Namespace: "kubeflow-user",
					Annotations: map[string]string{
						"notebooks.kubeflow.org/http-rewrite-uri": `/foo/bar`,
					},
				},
				Status: nbv1beta1.NotebookStatus{},
			},
			expectedVirtualServices: decodeUnstructuredFixture(t, "notebook_controller_virtualservice_test_rewrite.yaml"),
			testEnv:                 map[string]string{},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			prepareTestEnvironment(t, test.testEnv)

			actualVirtualServices, actualErrorState := generateVirtualServices(&test.notebook)

			if test.expectedErrorState != nil {
				if test.expectedErrorState.Error() != actualErrorState.Error() {
					t.Errorf("Unexpected error: %v\nExpected: %v", actualErrorState, test.expectedErrorState.Error())
				}
			} else {
				if actualErrorState != nil {
					t.Errorf("Unexpected error: %v", actualErrorState)
				}

				if len(actualVirtualServices) != len(test.expectedVirtualServices) {
					t.Errorf("\nExpect: len()=%v; \nOutput: len()=%v", len(test.expectedVirtualServices), len(actualVirtualServices))
				}

				for i, expected := range test.expectedVirtualServices {
					var actual *unstructured.Unstructured
					if len(actualVirtualServices) > i {
						actual = actualVirtualServices[i]
					}
					if !apiequality.Semantic.DeepEqual(expected, actual) {
						t.Errorf("\nExpect: %v; \nOutput: %v", expected, actual)
					}
				}
			}
		})
	}

}

func createMockReconciler() *NotebookReconciler {
	reconciler := &NotebookReconciler{
		Scheme: runtime.NewScheme(),
		Log:    ctrl.Log,
	}
	return reconciler
}

func prepareTestEnvironment(t *testing.T, testEnv map[string]string) {
	// save old environment & set test environment
	oldEnv := make(map[string]string)
	for key, value := range testEnv {
		oldValue, hadValue := os.LookupEnv(key)
		if hadValue {
			oldEnv[key] = oldValue
			t.Cleanup(func() {
				os.Setenv(key, oldValue)
			})
		} else {
			t.Cleanup(func() {
				os.Unsetenv(key)
			})
		}
		os.Setenv(key, value)
	}

}

//go:embed test_fixtures/*.yaml
var fixtures embed.FS

func decodeUnstructuredFixture(t *testing.T, name string) []*unstructured.Unstructured {
	t.Helper()

	data, err := fixtures.ReadFile(path.Join("test_fixtures", name))
	if err != nil {
		t.Fatalf("failed to read fixture: %v", err)
	}

	var objects []*unstructured.Unstructured

	decoder := yaml.NewYAMLOrJSONDecoder(bytes.NewReader(data), 4096)

	for {
		var obj unstructured.Unstructured

		err := decoder.Decode(&obj)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			t.Fatalf("failed to decode YAML fixture: %v", err)
		}

		// Skip empty YAML documents.
		if len(obj.Object) == 0 {
			continue
		}

		objects = append(objects, &obj)
	}

	return objects
}
