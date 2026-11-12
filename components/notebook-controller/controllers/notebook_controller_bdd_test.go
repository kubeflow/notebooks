/*

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

package controllers

import (
	"context"
	"time"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
	appsv1 "k8s.io/api/apps/v1"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"sigs.k8s.io/controller-runtime/pkg/client"

	nbv1beta1 "github.com/kubeflow/notebooks/components/notebook-controller/api/v1beta1"
)

var _ = Describe("Notebook controller", func() {

	// Define utility constants for object names and testing timeouts/durations and intervals.
	const (
		Name      = "test-notebook"
		Namespace = "default"
		timeout   = time.Second * 10
		interval  = time.Millisecond * 250
	)

	Context("When validating the notebook controller", func() {
		It("Should create replicas", func() {
			By("By creating a new Notebook")
			ctx := context.Background()
			notebook := &nbv1beta1.Notebook{
				ObjectMeta: metav1.ObjectMeta{
					Name:      Name,
					Namespace: Namespace,
				},
				Spec: nbv1beta1.NotebookSpec{
					Template: nbv1beta1.NotebookTemplateSpec{
						Spec: v1.PodSpec{Containers: []v1.Container{{
							Name:  "busybox",
							Image: "busybox",
						}}}},
				}}
			Expect(k8sClient.Create(ctx, notebook)).Should(Succeed())

			notebookLookupKey := types.NamespacedName{Name: Name, Namespace: Namespace}
			createdNotebook := &nbv1beta1.Notebook{}

			Eventually(func() bool {
				err := k8sClient.Get(ctx, notebookLookupKey, createdNotebook)
				if err != nil {
					return false
				}
				return true
			}, timeout, interval).Should(BeTrue())
			/*
				Checking for the underlying statefulset.
				The satefulset controllers aren't running within envtest, when env test's aren't pointing to the live cluster.
				Only the API server is running within envtest. So cannot check actual pods / replicas.
			*/
			By("By checking that the Notebook has statefulset")
			Eventually(func() (bool, error) {
				sts := &appsv1.StatefulSet{ObjectMeta: metav1.ObjectMeta{
					Name:      Name,
					Namespace: Namespace,
				}}
				err := k8sClient.Get(ctx, notebookLookupKey, sts)
				if err != nil {
					return false, err
				}
				return true, nil
			}, timeout, interval).Should(BeTrue())

			By("Checking that idle status updates stabilize")
			apiClient, err := client.New(testEnv.Config, client.Options{Scheme: k8sClient.Scheme()})
			Expect(err).NotTo(HaveOccurred())
			statefulSet := &appsv1.StatefulSet{}
			Expect(apiClient.Get(ctx, notebookLookupKey, statefulSet)).To(Succeed())
			pod := &v1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name: Name + "-0", Namespace: Namespace,
					Labels: map[string]string{"notebook-name": Name},
					OwnerReferences: []metav1.OwnerReference{
						*metav1.NewControllerRef(statefulSet, appsv1.SchemeGroupVersion.WithKind("StatefulSet")),
					},
				},
				Spec: v1.PodSpec{Containers: []v1.Container{{Name: Name, Image: "busybox"}}},
			}
			Expect(apiClient.Create(ctx, pod)).To(Succeed())
			transitionTime := metav1.NewTime(time.Now().UTC().Truncate(time.Second))
			pod.Status = v1.PodStatus{
				Phase: v1.PodRunning,
				Conditions: []v1.PodCondition{{
					Type: v1.PodReady, Status: v1.ConditionTrue, LastTransitionTime: transitionTime,
				}},
				ContainerStatuses: []v1.ContainerStatus{{
					Name: Name, Image: "busybox", Ready: true,
					State: v1.ContainerState{Running: &v1.ContainerStateRunning{StartedAt: transitionTime}},
				}},
			}
			Expect(apiClient.Status().Update(ctx, pod)).To(Succeed())
			transitionTime = pod.Status.Conditions[0].LastTransitionTime
			Eventually(func() []nbv1beta1.NotebookCondition {
				Expect(apiClient.Get(ctx, notebookLookupKey, createdNotebook)).To(Succeed())
				return createdNotebook.Status.Conditions
			}, timeout, interval).Should(Equal([]nbv1beta1.NotebookCondition{{
				Type: "Ready", Status: "True", LastTransitionTime: transitionTime,
			}}))
			Expect(createdNotebook.Status.ContainerState.Running).NotTo(BeNil())
			notebookVersion := createdNotebook.ResourceVersion
			Expect(apiClient.Get(ctx, notebookLookupKey, statefulSet)).To(Succeed())
			statefulSetVersion := statefulSet.ResourceVersion
			Consistently(func() []string {
				Expect(apiClient.Get(ctx, notebookLookupKey, createdNotebook)).To(Succeed())
				Expect(apiClient.Get(ctx, notebookLookupKey, statefulSet)).To(Succeed())
				return []string{createdNotebook.ResourceVersion, statefulSet.ResourceVersion}
			}, 3*time.Second, interval).Should(Equal([]string{notebookVersion, statefulSetVersion}))

			By("Propagating a subsequent Pod status change")
			pod.Status.Conditions[0].Status = v1.ConditionFalse
			pod.Status.Conditions[0].Reason = "NotReady"
			Expect(apiClient.Status().Update(ctx, pod)).To(Succeed())
			Eventually(func() []nbv1beta1.NotebookCondition {
				Expect(apiClient.Get(ctx, notebookLookupKey, createdNotebook)).To(Succeed())
				return createdNotebook.Status.Conditions
			}, timeout, interval).Should(Equal([]nbv1beta1.NotebookCondition{{
				Type: "Ready", Status: "False", Reason: "NotReady", LastTransitionTime: transitionTime,
			}}))
		})
	})
})
