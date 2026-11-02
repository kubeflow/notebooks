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

package controller

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/go-logr/logr"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/event"
	logf "sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/controller-runtime/pkg/reconcile"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/kubeflow/notebooks/workspaces/controller/internal/config"
)

var _ = Describe("Workspace Controller", func() {

	// Define utility constants for object names and testing timeouts/durations and intervals.
	const (
		namespaceName = "default"

		// how long to wait in "Eventually" blocks
		timeout = time.Second * 10

		// how long to wait in "Consistently" blocks
		duration = time.Second * 10 //nolint:unused

		// how frequently to poll for conditions
		interval = time.Millisecond * 250

		// tolerance for timestamp comparisons (in milliseconds)
		tolerance = int64(5000)

		// the ServiceAccount name passed to generators in tests which do not create a ServiceAccount
		exampleServiceAccountName = "ws-example-abcde"
	)

	Context("When updating a Workspace", Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := "ws-update-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Name:      workspaceName,
					Namespace: namespaceName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{
					Name: workspaceKindName,
				},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should not allow updating immutable fields", func() {
			By("getting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())

			By("failing to update the `spec.kind` field")
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.Kind = "new-kind"
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).NotTo(Succeed())
		})
	})

	Context("When reconciling a Workspace", Serial, Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
		)

		BeforeAll(func() {
			uniqueName := "ws-reconcile-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
		})

		It("should successfully reconcile the Workspace", func() {

			By("creating a WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("pausing the Workspace")
			patch := client.MergeFrom(workspace.DeepCopy())
			newWorkspace := workspace.DeepCopy()
			newWorkspace.Spec.Paused = true
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())

			By("setting the Workspace `status.pauseTime` to the current time")
			currentTime := time.Now().UnixMilli()
			Eventually(func() (int64, error) {
				err := k8sClient.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespaceName}, workspace)
				if err != nil {
					return 0, err
				}
				return workspace.Status.PauseTime, nil
			}, timeout, interval).Should(BeNumerically("~", currentTime, tolerance))

			By("un-pausing the Workspace")
			patch = client.MergeFrom(workspace.DeepCopy())
			newWorkspace = workspace.DeepCopy()
			newWorkspace.Spec.Paused = false
			Expect(k8sClient.Patch(ctx, newWorkspace, patch)).To(Succeed())

			By("setting the Workspace `status.pauseTime` to 0")
			Eventually(func() (int64, error) {
				err := k8sClient.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespaceName}, workspace)
				if err != nil {
					return 0, err
				}
				return workspace.Status.PauseTime, nil
			}, timeout, interval).Should(BeZero())

			By("creating a ServiceAccount owned by the Workspace")
			serviceAccountList := &corev1.ServiceAccountList{}
			Eventually(func() ([]corev1.ServiceAccount, error) {
				err := k8sClient.List(ctx, serviceAccountList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return serviceAccountList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			serviceAccount := serviceAccountList.Items[0]
			serviceAccountName := serviceAccount.Name
			Expect(serviceAccountName).To(HavePrefix(generateNamePrefix(workspaceName, maxServiceAccountNameLength)))
			Expect(serviceAccount.OwnerReferences).To(HaveLen(1))
			Expect(serviceAccount.OwnerReferences[0].Kind).To(Equal("Workspace"))
			Expect(serviceAccount.OwnerReferences[0].Name).To(Equal(workspaceName))
			Expect(serviceAccount.OwnerReferences[0].Controller).To(HaveValue(BeTrue()))

			By("reporting the ServiceAccount name in the Workspace status")
			Eventually(func() (string, error) {
				err := k8sClient.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespaceName}, workspace)
				if err != nil {
					return "", err
				}
				return workspace.Status.PodTemplatePod.ServiceAccountName, nil
			}, timeout, interval).Should(Equal(serviceAccountName))

			By("creating a StatefulSet")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			statefulSet := statefulSetList.Items[0]

			By("running the Workspace Pods as the Workspace's own ServiceAccount")
			Expect(statefulSet.Spec.Template.Spec.ServiceAccountName).To(Equal(serviceAccountName))

			By("creating a Service")
			serviceList := &corev1.ServiceList{}
			Eventually(func() ([]corev1.Service, error) {
				err := k8sClient.List(ctx, serviceList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return serviceList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			// TODO: use this to get the Service
			// service := serviceList.Items[0]

			//
			// TODO: populate these tests
			//  - use the CronJob controller tests as a reference
			//    https://github.com/kubernetes-sigs/kubebuilder/blob/master/docs/book/src/cronjob-tutorial/testdata/project/internal/controller/cronjob_controller_test.go
			//  - notes:
			//     - it may make sense to split some of these up into at least separate `It(` specs
			//       or even separate `Context(` scopes so we can run them in parallel
			//  - key things to test:
			//     - core behavior:
			//         - resources like Service/StatefulSet/VirtualService/etc are created when the Workspace is created
			//         - even if the Workspace has a >64 character name, everything still works
			//         - deleting the reconciled resources, and ensuring they are recreated
			//         - updating the reconciled resources, and ensuring they are reverted
			//         - the go templates in WorkspaceKind `spec.podTemplate.podSpec.mainContainer.extraEnv[].value` should work properly
			//            - succeed for valid portID
			//            - return empty string for invalid portID
			//            - set Workspace to error state for invalid template format (e.g. single quote for portID string)
			//     - workspace update behavior:
			//        - pausing the Workspace results in the StatefulSet being scaled to 0
			//        - updating the selected options results in the correct resources being updated:
			//            - imageConfig - updates the StatefulSet and possibly the Service
			//            - podConfig - updates the StatefulSet
			//     - workspaceKind redirect behavior:
			//        - NO resource changes are made except setting `status.pendingRestart`
			//          and `status.podTemplateOptions` (`desired` along with `redirectChain`)
			//     - error states:
			//        - referencing a missing WorkspaceKind results in error state
			//        - invalid WorkspaceKind (with bad option redirect - circular / missing) results in error state
			//        - multiple owned StatefulSets / Services results in error state
			//
		})
	})

	Context("When the selected podConfig changes", Serial, Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
		)

		// podTemplateLabels lists the current Pod-template labels of the Workspace's StatefulSet.
		podTemplateLabels := func() (map[string]string, error) {
			stsList := &appsv1.StatefulSetList{}
			if err := k8sClient.List(ctx, stsList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err != nil {
				return nil, err
			}
			if len(stsList.Items) != 1 {
				return nil, fmt.Errorf("expected exactly 1 StatefulSet, got %d", len(stsList.Items))
			}
			return stsList.Items[0].Spec.Template.Labels, nil
		}

		BeforeAll(func() {
			uniqueName := fmt.Sprintf("ws-podconfig-switch-%d", time.Now().UnixNano())
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating a WorkspaceKind whose tiny_cpu and small_cpu podConfigs carry distinct podMetadata")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			pods := workspaceKind.Spec.PodTemplate.Options.PodConfig.Values
			for i := range pods {
				switch pods[i].Id {
				case "tiny_cpu":
					pods[i].Spec.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
						Labels: map[string]string{"tier": "tiny", "tiny-exclusive": "yes"},
					}
				case "small_cpu":
					pods[i].Spec.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
						Labels: map[string]string{"tier": "small"},
					}
				}
			}
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace that selects tiny_cpu")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the StatefulSet")
			stsList := &appsv1.StatefulSetList{}
			if err := k8sClient.List(ctx, stsList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err == nil {
				for i := range stsList.Items {
					_ = k8sClient.Delete(ctx, &stsList.Items[i])
				}
			}

			By("deleting the Workspace")
			_ = k8sClient.Delete(ctx, &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			})

			By("deleting the WorkspaceKind")
			_ = k8sClient.Delete(ctx, &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			})
		})

		It("re-derives Pod metadata on the live StatefulSet when the selected podConfig changes", func() {
			By("waiting for the StatefulSet to carry the tiny_cpu podMetadata")
			Eventually(podTemplateLabels, timeout, interval).Should(SatisfyAll(
				HaveKeyWithValue("tier", "tiny"),
				HaveKeyWithValue("tiny-exclusive", "yes"),
			))

			By("switching the Workspace's selected podConfig to small_cpu")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())
			workspace.Spec.PodTemplate.Options.PodConfig = "small_cpu"
			Expect(k8sClient.Patch(ctx, workspace, patch)).To(Succeed())

			By("observing the StatefulSet gain the small_cpu key and drop the tiny_cpu-only key")
			Eventually(podTemplateLabels, timeout, interval).Should(SatisfyAll(
				HaveKeyWithValue("tier", "small"), // added by the newly-selected podConfig
				Not(HaveKey("tiny-exclusive")),    // contributed only by the previous podConfig, now removed
			))
			By("keeping the controller-owned label authoritative throughout")
			labels, err := podTemplateLabels()
			Expect(err).NotTo(HaveOccurred())
			Expect(labels).To(HaveKeyWithValue(workspaceNameLabel, workspaceName))
		})
	})

	Context("When activity rules pause an inactive Workspace", Serial, Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := fmt.Sprintf("ws-activity-pause-%d", time.Now().UnixNano())
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			workspaceReconciler.PodExecutor = &fakePodExecutor{
				stdout: `{"last_activity": "2000-01-01T00:00:00Z"}`,
			}

			By("creating a WorkspaceKind with an activity probe and pause rules")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			workspaceKind.Spec.PodTemplate.ActivityProbe = &kubefloworgv1beta1.ActivityProbe{
				MinProbeIntervalSeconds: new(int32(1)),
				ProbeIntervalSeconds:    new(int32(10)),
				PodExec: kubefloworgv1beta1.ActivityProbePodExec{
					TimeoutSeconds: new(int32(30)),
					Script:         "exit 0",
				},
			}
			workspaceKind.Spec.ActivityRules = []kubefloworgv1beta1.ActivityRule{
				{
					Config: kubefloworgv1beta1.ActivityRuleConfig{
						SecondsSinceActive: 16,
						MinRunningSeconds:  new(int32(0)),
					},
					Match:  []kubefloworgv1beta1.ActivityRuleMatch{},
					Effect: kubefloworgv1beta1.ActivityRuleEffect{PauseWorkspace: new(true)},
				},
			}
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			workspaceReconciler.PodExecutor = nil

			By("deleting the Pod")
			podList := &corev1.PodList{}
			if err := k8sClient.List(ctx, podList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err == nil {
				for _, p := range podList.Items {
					_ = k8sClient.Delete(ctx, &p)
				}
			}

			By("deleting the StatefulSet")
			stsList := &appsv1.StatefulSetList{}
			if err := k8sClient.List(ctx, stsList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err == nil {
				for _, s := range stsList.Items {
					_ = k8sClient.Delete(ctx, &s)
				}
			}

			By("deleting the Service")
			svcList := &corev1.ServiceList{}
			if err := k8sClient.List(ctx, svcList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err == nil {
				for _, s := range svcList.Items {
					_ = k8sClient.Delete(ctx, &s)
				}
			}

			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			_ = k8sClient.Delete(ctx, workspace)

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			_ = k8sClient.Delete(ctx, workspaceKind)
		})

		It("should successfully persist spec.paused=true to the API server even when Status().Update runs in the same reconcile", func() {
			By("waiting for the StatefulSet to be created")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			By("fetching the created StatefulSet and creating a running Pod for it")
			Expect(k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})).To(Succeed())
			statefulSet := &statefulSetList.Items[0]
			statefulSetName := statefulSet.Name
			podName := fmt.Sprintf("%s-0", statefulSetName)

			// envtest does not run a StatefulSet controller, so we simulate one by
			// bumping ObservedGeneration to match Generation and stamping an
			// UpdateRevision. Without this, generateWorkspaceState short-circuits
			// to Pending ("Waiting for Kubernetes to reconcile StatefulSet") on
			// every reconcile and the workspace never reaches Running, so the
			// activity/pause logic under test never triggers.
			const revision = "revision-1"
			statefulSet.Status.ObservedGeneration = statefulSet.Generation
			statefulSet.Status.UpdateRevision = revision
			Expect(k8sClient.Status().Update(ctx, statefulSet)).To(Succeed())

			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      podName,
					Namespace: namespaceName,
					Labels: map[string]string{
						workspaceNameLabel:              workspaceName,
						appsv1.StatefulSetRevisionLabel: revision,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{Name: "main", Image: "busybox"}},
				},
			}
			Expect(ctrl.SetControllerReference(statefulSet, pod, k8sManager.GetScheme())).To(Succeed())
			Expect(k8sClient.Create(ctx, pod)).To(Succeed())
			pod.Status.Phase = corev1.PodRunning
			pod.Status.Conditions = []corev1.PodCondition{
				{Type: corev1.PodReady, Status: corev1.ConditionTrue},
				{Type: corev1.PodScheduled, Status: corev1.ConditionTrue},
			}
			Expect(k8sClient.Status().Update(ctx, pod)).To(Succeed())

			Eventually(func() error {
				p := &corev1.Pod{}
				if err := k8sManager.GetClient().Get(ctx, client.ObjectKey{Name: podName, Namespace: namespaceName}, p); err != nil {
					return err
				}
				if p.Status.Phase != corev1.PodRunning {
					return fmt.Errorf("pod phase is %s, expected Running", p.Status.Phase)
				}
				return nil
			}, timeout, interval).Should(Succeed())

			By("waiting for the controller to persist spec.paused=true to the API server")
			Eventually(func(g Gomega) {
				updatedWS := &kubefloworgv1beta1.Workspace{}
				g.Expect(k8sClient.Get(ctx, workspaceKey, updatedWS)).To(Succeed())
				g.Expect(updatedWS.Spec.Paused).To(BeTrue(), "spec.paused must be persisted to true in the API server")
			}, timeout, interval).Should(Succeed())
		})
	})

	Context("When generating a VirtualService for a Workspace", func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
		)

		// NOTE: these tests call the generate functions directly and do not create any
		//       resources in the cluster, so no teardown is required.
		// TODO: once Istio CRDs are installed in EnvTest (`UseIstio: true` in suite_test.go),
		//       add specs which ensure the VirtualService is actually created by the controller.
		var (
			reconciler      *WorkspaceReconciler
			workspace       *kubefloworgv1beta1.Workspace
			workspaceKind   *kubefloworgv1beta1.WorkspaceKind
			service         *corev1.Service
			imageConfigSpec kubefloworgv1beta1.ImageConfigSpec
		)

		BeforeEach(func() {
			uniqueName := "ws-virtualservice-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)

			reconciler = &WorkspaceReconciler{
				Config: &config.EnvConfig{
					ClusterDomain: "cluster.local",
				},
			}
			workspaceKind = NewExampleWorkspaceKind1(workspaceKindName)
			workspace = NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			service = &corev1.Service{
				ObjectMeta: metav1.ObjectMeta{
					Name:      fmt.Sprintf("ws-%s", workspaceName),
					Namespace: namespaceName,
				},
			}
			imageConfigSpec = workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec
		})

		It("should not rewrite the URI when `removePathPrefix` is false", func() {
			By("generating the VirtualService")
			workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RemovePathPrefix = new(false)
			virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
			Expect(err).NotTo(HaveOccurred())

			By("checking the HTTP route has no rewrite")
			Expect(virtualService.Spec.Http).To(HaveLen(1))
			Expect(virtualService.Spec.Http[0].Rewrite).To(BeNil())
		})

		It("should rewrite the URI to '/' when `removePathPrefix` is true", func() {
			By("generating the VirtualService")
			workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RemovePathPrefix = new(true)
			virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
			Expect(err).NotTo(HaveOccurred())

			By("checking the HTTP route rewrites the URI to '/'")
			Expect(virtualService.Spec.Http).To(HaveLen(1))
			Expect(virtualService.Spec.Http[0].Rewrite).NotTo(BeNil())
			Expect(virtualService.Spec.Http[0].Rewrite.Uri).To(Equal("/"))
		})

		It("should not rewrite the URI when `httpProxy` is not set", func() {
			By("generating the VirtualService")
			workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy = nil
			virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
			Expect(err).NotTo(HaveOccurred())

			By("checking the HTTP route has no rewrite")
			Expect(virtualService.Spec.Http).To(HaveLen(1))
			Expect(virtualService.Spec.Http[0].Rewrite).To(BeNil())
		})

		It("should render go templates in `requestHeaders` values", func() {
			By("generating the VirtualService")
			workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
				Set: map[string]string{
					"X-RStudio-Root-Path": `{{ httpPathPrefix "jupyterlab" }}`,
				},
			}
			virtualService, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
			Expect(err).NotTo(HaveOccurred())

			By("checking the rendered header value")
			Expect(virtualService.Spec.Http).To(HaveLen(1))
			Expect(virtualService.Spec.Http[0].Headers.Request.Set).To(HaveKeyWithValue(
				"X-RStudio-Root-Path", getWorkspaceConnectPath(workspace.Namespace, workspace.Name, "jupyterlab"),
			))
		})

		It("should fail to generate when a `requestHeaders` value has an invalid go template", func() {
			By("generating the VirtualService")
			workspaceKind.Spec.PodTemplate.Ports[0].HTTPProxy.RequestHeaders = &kubefloworgv1beta1.IstioHeaderOperations{
				Set: map[string]string{
					"X-RStudio-Root-Path": `{{ httpPathPrefix 'jupyterlab' }}`,
				},
			}
			_, err := reconciler.generateVirtualService(workspace, workspaceKind, service, imageConfigSpec)
			Expect(err).To(HaveOccurred())
		})
	})

	Context("When a WorkspaceKind grants ClusterRoles to the Workspace ServiceAccount", Serial, Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName      string
			workspaceKindName  string
			workspaceKey       types.NamespacedName
			workspaceKindKey   types.NamespacedName
			serviceAccountName string
		)

		// listOwnedRoleBindings returns the RoleBindings labeled for the Workspace under test.
		listOwnedRoleBindings := func() ([]rbacv1.RoleBinding, error) {
			roleBindingList := &rbacv1.RoleBindingList{}
			err := k8sClient.List(ctx, roleBindingList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
			if err != nil {
				return nil, err
			}
			return roleBindingList.Items, nil
		}

		// setClusterRoles patches the WorkspaceKind `spec.podTemplate.serviceAccount.clusterRoles`.
		setClusterRoles := func(names ...string) {
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
			patch := client.MergeFrom(workspaceKind.DeepCopy())
			clusterRoles := make([]kubefloworgv1beta1.WorkspaceKindClusterRole, len(names))
			for i, name := range names {
				clusterRoles[i] = kubefloworgv1beta1.WorkspaceKindClusterRole{Name: name}
			}
			workspaceKind.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceKindServiceAccount{
				ClusterRoles: clusterRoles,
			}
			Expect(k8sClient.Patch(ctx, workspaceKind, patch)).To(Succeed())
		}

		BeforeAll(func() {
			uniqueName := "ws-clusterroles-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			// NOTE: the default imageConfig of the example Workspace has a redirect, which would make
			//       `status.pendingRestart` true from the start and hide any change caused by `clusterRoles`
			workspace.Spec.PodTemplate.Options.ImageConfig = "jupyterlab_scipy_190"
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should not create any RoleBindings when `clusterRoles` is unset", func() {
			By("waiting for the Workspace to be reconciled")
			Eventually(func() (string, error) {
				workspace := &kubefloworgv1beta1.Workspace{}
				err := k8sClient.Get(ctx, types.NamespacedName{Name: workspaceName, Namespace: namespaceName}, workspace)
				if err != nil {
					return "", err
				}
				serviceAccountName = workspace.Status.PodTemplatePod.ServiceAccountName
				return serviceAccountName, nil
			}, timeout, interval).Should(HavePrefix(generateNamePrefix(workspaceName, maxServiceAccountNameLength)))

			By("checking no RoleBindings exist")
			Consistently(listOwnedRoleBindings, "2s", interval).Should(BeEmpty())
		})

		It("should create a RoleBinding for each `clusterRoles` entry", func() {
			By("adding two ClusterRoles to the WorkspaceKind")
			// NOTE: "system:aggregate-to-view" is included because ClusterRole names may contain
			//       characters which are not valid in a RoleBinding name
			setClusterRoles("kubeflow-edit", "system:aggregate-to-view")

			By("creating a RoleBinding for each ClusterRole")
			Eventually(listOwnedRoleBindings, timeout, interval).Should(HaveLen(2))

			roleBindings, err := listOwnedRoleBindings()
			Expect(err).NotTo(HaveOccurred())
			for _, roleBinding := range roleBindings {
				By(fmt.Sprintf("checking the RoleBinding %q", roleBinding.Name))
				Expect(roleBinding.RoleRef.APIGroup).To(Equal(rbacv1.GroupName))
				Expect(roleBinding.RoleRef.Kind).To(Equal("ClusterRole"))
				Expect(roleBinding.RoleRef.Name).To(BeElementOf("kubeflow-edit", "system:aggregate-to-view"))
				Expect(roleBinding.Subjects).To(ConsistOf(rbacv1.Subject{
					Kind:      rbacv1.ServiceAccountKind,
					Name:      serviceAccountName,
					Namespace: namespaceName,
				}))
				Expect(roleBinding.OwnerReferences).To(HaveLen(1))
				Expect(roleBinding.OwnerReferences[0].Kind).To(Equal("Workspace"))
				Expect(roleBinding.OwnerReferences[0].Name).To(Equal(workspaceName))
			}
		})

		It("should not change `status.pendingRestart` when `clusterRoles` changes", func() {
			pendingRestart := func() (bool, error) {
				workspace := &kubefloworgv1beta1.Workspace{}
				if err := k8sClient.Get(ctx, workspaceKey, workspace); err != nil {
					return false, err
				}
				return workspace.Status.PendingRestart, nil
			}

			By("waiting for `status.pendingRestart` to be false")
			Eventually(pendingRestart, timeout, interval).Should(BeFalse())

			By("adding another ClusterRole to the WorkspaceKind")
			setClusterRoles("kubeflow-edit", "system:aggregate-to-view", "kubeflow-view")
			Eventually(listOwnedRoleBindings, timeout, interval).Should(HaveLen(3))

			By("leaving `status.pendingRestart` false")
			// RBAC is evaluated per request and the ServiceAccount token is unchanged,
			// so granting or revoking a ClusterRole never requires a Workspace restart
			Consistently(pendingRestart, "2s", interval).Should(BeFalse())
		})

		It("should delete the RoleBinding when its `clusterRoles` entry is removed", func() {
			By("removing one ClusterRole from the WorkspaceKind")
			setClusterRoles("kubeflow-edit")

			By("deleting the RoleBinding for the removed ClusterRole")
			Eventually(listOwnedRoleBindings, timeout, interval).Should(HaveLen(1))
			roleBindings, err := listOwnedRoleBindings()
			Expect(err).NotTo(HaveOccurred())
			Expect(roleBindings[0].RoleRef.Name).To(Equal("kubeflow-edit"))
		})

		It("should delete all RoleBindings when `clusterRoles` is emptied", func() {
			By("removing every ClusterRole from the WorkspaceKind")
			setClusterRoles()

			By("deleting all the RoleBindings")
			Eventually(listOwnedRoleBindings, timeout, interval).Should(BeEmpty())
		})

		It("should recreate a RoleBinding which is deleted out of band", func() {
			By("adding a ClusterRole to the WorkspaceKind")
			setClusterRoles("kubeflow-edit")
			Eventually(listOwnedRoleBindings, timeout, interval).Should(HaveLen(1))

			By("deleting the RoleBinding")
			roleBindings, err := listOwnedRoleBindings()
			Expect(err).NotTo(HaveOccurred())
			Expect(k8sClient.Delete(ctx, &roleBindings[0])).To(Succeed())

			By("recreating the RoleBinding")
			Eventually(listOwnedRoleBindings, timeout, interval).Should(HaveLen(1))
		})
	})

	Context("When a WorkspaceKind sets metadata for the Workspace ServiceAccount", Serial, Ordered, func() {

		const (
			roleArnAnnotation = "eks.amazonaws.com/role-arn"
			roleArnV1         = "arn:aws:iam::111122223333:role/my-role-v1"
			roleArnV2         = "arn:aws:iam::111122223333:role/my-role-v2"
		)

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
			workspaceKindKey  types.NamespacedName
		)

		// getServiceAccount returns the ServiceAccount labeled for the Workspace under test.
		getServiceAccount := func(g Gomega) *corev1.ServiceAccount {
			serviceAccountList := &corev1.ServiceAccountList{}
			g.Expect(k8sClient.List(ctx, serviceAccountList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})).To(Succeed())
			g.Expect(serviceAccountList.Items).To(HaveLen(1))
			return &serviceAccountList.Items[0]
		}

		// getStatefulSetGeneration returns the `metadata.generation` of the StatefulSet of the Workspace under test.
		getStatefulSetGeneration := func(g Gomega) int64 {
			statefulSetList := &appsv1.StatefulSetList{}
			g.Expect(k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})).To(Succeed())
			g.Expect(statefulSetList.Items).To(HaveLen(1))
			return statefulSetList.Items[0].Generation
		}

		// pendingRestart returns the `status.pendingRestart` of the Workspace under test.
		pendingRestart := func() (bool, error) {
			workspace := &kubefloworgv1beta1.Workspace{}
			if err := k8sClient.Get(ctx, workspaceKey, workspace); err != nil {
				return false, err
			}
			return workspace.Status.PendingRestart, nil
		}

		// setServiceAccountMetadata patches the WorkspaceKind `spec.podTemplate.serviceAccount.metadata`.
		setServiceAccountMetadata := func(labels, annotations map[string]string) {
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
			patch := client.MergeFrom(workspaceKind.DeepCopy())
			workspaceKind.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceKindServiceAccount{
				Metadata: &kubefloworgv1beta1.WorkspaceKindServiceAccountMetadata{
					Labels:      labels,
					Annotations: annotations,
				},
			}
			Expect(k8sClient.Patch(ctx, workspaceKind, patch)).To(Succeed())
		}

		BeforeAll(func() {
			uniqueName := "ws-sa-metadata-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			workspaceKind.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceKindServiceAccount{
				Metadata: &kubefloworgv1beta1.WorkspaceKindServiceAccountMetadata{
					Labels:      map[string]string{"my-sa-label": "my-value"},
					Annotations: map[string]string{roleArnAnnotation: roleArnV1},
				},
			}
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			// NOTE: the default imageConfig of the example Workspace has a redirect, which would make
			//       `status.pendingRestart` true from the start and hide any change caused by the metadata
			workspace.Spec.PodTemplate.Options.ImageConfig = "jupyterlab_scipy_190"
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should apply the metadata when the ServiceAccount is created", func() {
			Eventually(func(g Gomega) {
				serviceAccount := getServiceAccount(g)
				g.Expect(serviceAccount.Labels).To(HaveKeyWithValue("my-sa-label", "my-value"))
				g.Expect(serviceAccount.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspaceName))
				g.Expect(serviceAccount.Annotations).To(HaveKeyWithValue(roleArnAnnotation, roleArnV1))
			}, timeout, interval).Should(Succeed())
		})

		It("should propagate added keys and changed values to the existing ServiceAccount without a restart", func() {
			By("waiting for `status.pendingRestart` to be false")
			Eventually(pendingRestart, timeout, interval).Should(BeFalse())
			var statefulSetGeneration int64
			Eventually(func(g Gomega) {
				statefulSetGeneration = getStatefulSetGeneration(g)
			}, timeout, interval).Should(Succeed())

			By("adding a new label and annotation, and changing an existing annotation value")
			setServiceAccountMetadata(
				map[string]string{"my-sa-label": "my-value", "my-new-sa-label": "my-value"},
				map[string]string{roleArnAnnotation: roleArnV2, "my-new-sa-annotation": "my-value"},
			)

			By("updating the existing ServiceAccount")
			Eventually(func(g Gomega) {
				serviceAccount := getServiceAccount(g)
				g.Expect(serviceAccount.Labels).To(HaveKeyWithValue("my-new-sa-label", "my-value"))
				g.Expect(serviceAccount.Annotations).To(HaveKeyWithValue("my-new-sa-annotation", "my-value"))
				g.Expect(serviceAccount.Annotations).To(HaveKeyWithValue(roleArnAnnotation, roleArnV2))
			}, timeout, interval).Should(Succeed())

			By("leaving `status.pendingRestart` false and the StatefulSet spec unchanged")
			// the ServiceAccount metadata is not part of the Pod template, so changing it
			// never requires a Workspace restart
			Consistently(pendingRestart, "2s", interval).Should(BeFalse())
			Consistently(getStatefulSetGeneration, "2s", interval).Should(Equal(statefulSetGeneration))
		})

		It("should preserve metadata added to the ServiceAccount out of band", func() {
			By("adding an annotation to the ServiceAccount directly, as another controller would")
			Eventually(func(g Gomega) {
				serviceAccount := getServiceAccount(g)
				if serviceAccount.Annotations == nil {
					serviceAccount.Annotations = map[string]string{}
				}
				serviceAccount.Annotations["other-tool.example.com/annotation"] = "other-value"
				g.Expect(k8sClient.Update(ctx, serviceAccount)).To(Succeed())
			}, timeout, interval).Should(Succeed())

			By("triggering a reconcile with a WorkspaceKind change")
			setServiceAccountMetadata(
				map[string]string{"my-sa-label": "my-value", "my-new-sa-label": "my-value"},
				map[string]string{roleArnAnnotation: roleArnV1, "my-new-sa-annotation": "my-value"},
			)
			Eventually(func(g Gomega) {
				g.Expect(getServiceAccount(g).Annotations).To(HaveKeyWithValue(roleArnAnnotation, roleArnV1))
			}, timeout, interval).Should(Succeed())

			By("keeping the out of band annotation")
			Consistently(func(g Gomega) {
				g.Expect(getServiceAccount(g).Annotations).To(HaveKeyWithValue("other-tool.example.com/annotation", "other-value"))
			}, "2s", interval).Should(Succeed())
		})

		It("should remove keys from the ServiceAccount when they are removed from the WorkspaceKind", func() {
			// NOTE: the controller only removes keys that it owns in the ServiceAccount `metadata.managedFields`,
			//       so the annotation added out of band by the previous test must be kept
			By("removing the new label and annotation, and changing an existing annotation value")
			setServiceAccountMetadata(
				map[string]string{"my-sa-label": "my-value"},
				map[string]string{roleArnAnnotation: roleArnV2},
			)

			By("removing the keys from the ServiceAccount")
			Eventually(func(g Gomega) {
				serviceAccount := getServiceAccount(g)
				g.Expect(serviceAccount.Annotations).To(HaveKeyWithValue(roleArnAnnotation, roleArnV2))
				g.Expect(serviceAccount.Labels).NotTo(HaveKey("my-new-sa-label"))
				g.Expect(serviceAccount.Annotations).NotTo(HaveKey("my-new-sa-annotation"))
			}, timeout, interval).Should(Succeed())

			By("keeping the out of band annotation")
			Consistently(func(g Gomega) {
				g.Expect(getServiceAccount(g).Annotations).To(HaveKeyWithValue("other-tool.example.com/annotation", "other-value"))
			}, "2s", interval).Should(Succeed())
		})

		It("should remove all applied keys from the ServiceAccount when `serviceAccount.metadata` is unset", func() {
			By("unsetting `serviceAccount.metadata` on the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
			patch := client.MergeFrom(workspaceKind.DeepCopy())
			workspaceKind.Spec.PodTemplate.ServiceAccount.Metadata = nil
			Expect(k8sClient.Patch(ctx, workspaceKind, patch)).To(Succeed())

			By("removing the applied keys, but keeping the controller-managed label and the out of band annotation")
			Eventually(func(g Gomega) {
				serviceAccount := getServiceAccount(g)
				g.Expect(serviceAccount.Labels).To(Equal(map[string]string{workspaceNameLabel: workspaceName}))
				g.Expect(serviceAccount.Annotations).To(Equal(map[string]string{"other-tool.example.com/annotation": "other-value"}))
			}, timeout, interval).Should(Succeed())
		})
	})

	Context("When generating a ServiceAccount for a Workspace", func() {

		// NOTE: these tests call generateServiceAccount directly and do not create any
		//       resources in the cluster, so no teardown is required.
		var workspaceKind *kubefloworgv1beta1.WorkspaceKind

		BeforeEach(func() {
			workspaceKind = NewExampleWorkspaceKind1("my-workspacekind")

			// ensure the field starts unset, so each test only sets what it exercises
			workspaceKind.Spec.PodTemplate.ServiceAccount = nil
		})

		It("should use `generateName` with the Workspace name prefix", func() {
			workspace := NewExampleWorkspace1("my-workspace", namespaceName, "my-workspacekind")
			serviceAccount := generateServiceAccount(workspace, workspaceKind)
			Expect(serviceAccount.Name).To(BeEmpty())
			Expect(serviceAccount.GenerateName).To(Equal("ws-my-workspace-"))
			Expect(serviceAccount.Labels).To(HaveKeyWithValue(workspaceNameLabel, "my-workspace"))
		})

		It("should leave room for the `generateName` suffix within the max ServiceAccount name length", func() {
			workspace := NewExampleWorkspace1(strings.Repeat("a", 253), namespaceName, "my-workspacekind")
			serviceAccount := generateServiceAccount(workspace, workspaceKind)
			Expect(len(serviceAccount.GenerateName)).To(BeNumerically("<=", maxServiceAccountNameLength-generateNameSuffixLength))
			Expect(serviceAccount.GenerateName).To(HaveSuffix("-"))
		})

		It("should set only the controller-managed label when `serviceAccount.metadata` is unset", func() {
			workspace := NewExampleWorkspace1("my-workspace", namespaceName, "my-workspacekind")

			By("generating the ServiceAccount with `serviceAccount` unset")
			serviceAccount := generateServiceAccount(workspace, workspaceKind)
			Expect(serviceAccount.Labels).To(Equal(map[string]string{workspaceNameLabel: "my-workspace"}))
			Expect(serviceAccount.Annotations).To(BeEmpty())

			By("generating the ServiceAccount with `serviceAccount` set but `metadata` unset")
			workspaceKind.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceKindServiceAccount{}
			serviceAccount = generateServiceAccount(workspace, workspaceKind)
			Expect(serviceAccount.Labels).To(Equal(map[string]string{workspaceNameLabel: "my-workspace"}))
			Expect(serviceAccount.Annotations).To(BeEmpty())
		})

		It("should apply the WorkspaceKind `serviceAccount.metadata` labels and annotations", func() {
			workspace := NewExampleWorkspace1("my-workspace", namespaceName, "my-workspacekind")
			workspaceKind.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceKindServiceAccount{
				Metadata: &kubefloworgv1beta1.WorkspaceKindServiceAccountMetadata{
					Labels:      map[string]string{"my-label": "my-value"},
					Annotations: map[string]string{"eks.amazonaws.com/role-arn": "arn:aws:iam::111122223333:role/my-role"},
				},
			}
			serviceAccount := generateServiceAccount(workspace, workspaceKind)

			By("checking the admin labels/annotations are present alongside the controller label")
			Expect(serviceAccount.Labels).To(HaveKeyWithValue("my-label", "my-value"))
			Expect(serviceAccount.Labels).To(HaveKeyWithValue(workspaceNameLabel, "my-workspace"))
			Expect(serviceAccount.Annotations).To(HaveKeyWithValue("eks.amazonaws.com/role-arn", "arn:aws:iam::111122223333:role/my-role"))

			By("checking the generated maps do not alias the WorkspaceKind maps")
			serviceAccount.Annotations["eks.amazonaws.com/role-arn"] = "mutated"
			Expect(workspaceKind.Spec.PodTemplate.ServiceAccount.Metadata.Annotations).To(HaveKeyWithValue("eks.amazonaws.com/role-arn", "arn:aws:iam::111122223333:role/my-role"))
		})

		It("should not let `serviceAccount.metadata` override the controller-managed label", func() {
			workspace := NewExampleWorkspace1("my-workspace", namespaceName, "my-workspacekind")
			workspaceKind.Spec.PodTemplate.ServiceAccount = &kubefloworgv1beta1.WorkspaceKindServiceAccount{
				Metadata: &kubefloworgv1beta1.WorkspaceKindServiceAccountMetadata{
					Labels: map[string]string{workspaceNameLabel: "hijacked"},
				},
			}
			serviceAccount := generateServiceAccount(workspace, workspaceKind)

			By("checking the controller value wins over the admin-provided one")
			Expect(serviceAccount.Labels).To(HaveKeyWithValue(workspaceNameLabel, "my-workspace"))
		})
	})

	Context("When generating a StatefulSet for a Workspace", func() {

		// NOTE: these tests call generateStatefulSet directly and do not create any
		//       resources in the cluster, so no teardown is required.
		var (
			workspace       *kubefloworgv1beta1.Workspace
			workspaceKind   *kubefloworgv1beta1.WorkspaceKind
			imageConfigSpec kubefloworgv1beta1.ImageConfigSpec
			podConfigSpec   kubefloworgv1beta1.PodConfigSpec
			serviceAccount  *corev1.ServiceAccount
		)

		BeforeEach(func() {
			uniqueName := "ws-statefulset-metadata-test"
			workspaceName := fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName := fmt.Sprintf("workspacekind-%s", uniqueName)

			serviceAccount = &corev1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{
					Name:      exampleServiceAccountName,
					Namespace: namespaceName,
				},
			}
			workspaceKind = NewExampleWorkspaceKind1(workspaceKindName)
			workspace = NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			imageConfigSpec = workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec
			podConfigSpec = workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec

			// ensure the field starts unset, so each test only sets what it exercises
			workspaceKind.Spec.PodTemplate.StatefulSetMetadata = nil
		})

		It("should set only the controller-managed label when `statefulSetMetadata` is unset", func() {
			By("generating the StatefulSet")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the StatefulSet carries only the `workspace-name` label and no annotations")
			Expect(statefulSet.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspace.Name))
			Expect(statefulSet.Labels).To(HaveLen(1))
			Expect(statefulSet.Annotations).To(BeEmpty())
		})

		It("should apply the WorkspaceKind `statefulSetMetadata` labels and annotations", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Labels:      map[string]string{"my-label": "my-value"},
				Annotations: map[string]string{"my-annotation": "my-value"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the admin labels/annotations are present alongside the controller label")
			Expect(statefulSet.Labels).To(HaveKeyWithValue("my-label", "my-value"))
			Expect(statefulSet.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspace.Name))
			Expect(statefulSet.Annotations).To(HaveKeyWithValue("my-annotation", "my-value"))
		})

		It("should not let `statefulSetMetadata` override the controller-managed label", func() {
			By("generating the StatefulSet with an admin label reusing the controller label key")
			workspaceKind.Spec.PodTemplate.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Labels: map[string]string{workspaceNameLabel: "hijacked"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the controller value wins over the admin-provided one")
			Expect(statefulSet.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspace.Name))
		})
	})

	Context("When generating a StatefulSet for a Workspace", func() {

		// NOTE: these tests call the generate functions directly and do not create any
		//       resources in the cluster, so no teardown is required.
		var (
			workspace       *kubefloworgv1beta1.Workspace
			workspaceKind   *kubefloworgv1beta1.WorkspaceKind
			imageConfigSpec kubefloworgv1beta1.ImageConfigSpec
			podConfigSpec   kubefloworgv1beta1.PodConfigSpec
			serviceAccount  *corev1.ServiceAccount
		)

		BeforeEach(func() {
			uniqueName := "ws-statefulset-test"
			workspaceName := fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName := fmt.Sprintf("workspacekind-%s", uniqueName)

			serviceAccount = &corev1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{
					Name:      exampleServiceAccountName,
					Namespace: namespaceName,
				},
			}
			workspaceKind = NewExampleWorkspaceKind1(workspaceKindName)
			workspace = NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			imageConfigSpec = workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec
			podConfigSpec = workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec

			// ensure both levels start unset, so each spec only sets what it tests
			workspaceKind.Spec.PodTemplate.PodSpec.SchedulerName = nil
			podConfigSpec.SchedulerName = nil
		})

		It("should leave `schedulerName` empty when it is unset on both the WorkspaceKind and the podConfig", func() {
			By("generating the StatefulSet")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template has no `schedulerName`, so the API server applies its default")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(BeEmpty())
		})

		It("should use the WorkspaceKind `schedulerName` when the podConfig does not set one", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.SchedulerName = new("workspacekind-scheduler")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template uses the WorkspaceKind `schedulerName`")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(Equal("workspacekind-scheduler"))
		})

		It("should use the podConfig `schedulerName` when the WorkspaceKind does not set one", func() {
			By("generating the StatefulSet")
			podConfigSpec.SchedulerName = new("podconfig-scheduler")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template uses the podConfig `schedulerName`")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(Equal("podconfig-scheduler"))
		})

		It("should prefer the podConfig `schedulerName` over the WorkspaceKind one", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.SchedulerName = new("workspacekind-scheduler")
			podConfigSpec.SchedulerName = new("podconfig-scheduler")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template uses the podConfig `schedulerName`")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(Equal("podconfig-scheduler"))
		})

		It("should leave container env empty when `extraEnv` is unset on both the WorkspaceKind and the podConfig", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = nil
			podConfigSpec.ExtraEnv = nil
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the main container has no environment variables")
			Expect(statefulSet.Spec.Template.Spec.Containers).To(HaveLen(1))
			Expect(statefulSet.Spec.Template.Spec.Containers[0].Env).To(BeEmpty())
		})

		It("should use the WorkspaceKind `extraEnv` when the podConfig does not set any", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = []corev1.EnvVar{
				{Name: "WSK_VAR_1", Value: "wsk-1"},
				{Name: "WSK_VAR_2", Value: "wsk-2"},
			}
			podConfigSpec.ExtraEnv = nil
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the main container uses the WorkspaceKind `extraEnv` in declared order")
			Expect(statefulSet.Spec.Template.Spec.Containers[0].Env).To(Equal([]corev1.EnvVar{
				{Name: "WSK_VAR_1", Value: "wsk-1"},
				{Name: "WSK_VAR_2", Value: "wsk-2"},
			}))
		})

		It("should use the podConfig `extraEnv` when the WorkspaceKind does not set any", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = nil
			podConfigSpec.ExtraEnv = []corev1.EnvVar{
				{Name: "PC_VAR_1", Value: "pc-1"},
				{Name: "PC_VAR_2", Value: "pc-2"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the main container uses the podConfig `extraEnv` in declared order")
			Expect(statefulSet.Spec.Template.Spec.Containers[0].Env).To(Equal([]corev1.EnvVar{
				{Name: "PC_VAR_1", Value: "pc-1"},
				{Name: "PC_VAR_2", Value: "pc-2"},
			}))
		})

		It("should merge podConfig `extraEnv` over WorkspaceKind `extraEnv` by name, replacing overrides in place and appending new variables in declared order", func() {
			By("generating the StatefulSet with overlapping and new env vars")
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = []corev1.EnvVar{
				{Name: "FIRST", Value: "wsk-first"},
				{Name: "BASE_DIR", Value: "/default/base"},
				{Name: "DERIVED_PATH", Value: "$(BASE_DIR)/sub"},
				{
					Name: "FROM_SOURCE",
					ValueFrom: &corev1.EnvVarSource{
						SecretKeyRef: &corev1.SecretKeySelector{
							LocalObjectReference: corev1.LocalObjectReference{Name: "my-secret"},
							Key:                  "my-key",
						},
					},
				},
			}
			podConfigSpec.ExtraEnv = []corev1.EnvVar{
				{Name: "NEW_VAR_1", Value: "pc-new-1"},
				{Name: "BASE_DIR", Value: "/podconfig/base"},
				{Name: "FROM_SOURCE", Value: "plain-override"},
				{Name: "NEW_VAR_2", Value: "pc-new-2"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking overridden variables keep their original position and new variables are appended in declared order")
			Expect(statefulSet.Spec.Template.Spec.Containers[0].Env).To(Equal([]corev1.EnvVar{
				{Name: "FIRST", Value: "wsk-first"},
				{Name: "BASE_DIR", Value: "/podconfig/base"},
				{Name: "DERIVED_PATH", Value: "$(BASE_DIR)/sub"},
				{Name: "FROM_SOURCE", Value: "plain-override"},
				{Name: "NEW_VAR_1", Value: "pc-new-1"},
				{Name: "NEW_VAR_2", Value: "pc-new-2"},
			}))
		})

		It("should render go templates in podConfig `extraEnv` values", func() {
			By("generating the StatefulSet with a go template in podConfig `extraEnv`")
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = []corev1.EnvVar{
				{Name: "NB_PREFIX", Value: "static-prefix"},
			}
			podConfigSpec.ExtraEnv = []corev1.EnvVar{
				{Name: "NB_PREFIX", Value: `{{ httpPathPrefix "jupyterlab" }}`},
				{Name: "POD_CONNECT_PATH", Value: `{{ httpPathPrefix "jupyterlab" }}lab`},
				{Name: "MISSING_PORT_PATH", Value: `{{ httpPathPrefix "unknown-port" }}`},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			expectedPrefix := getWorkspaceConnectPath(workspace.Namespace, workspace.Name, "jupyterlab")
			By("checking the rendered values in the container env")
			Expect(statefulSet.Spec.Template.Spec.Containers[0].Env).To(Equal([]corev1.EnvVar{
				{Name: "NB_PREFIX", Value: expectedPrefix},
				{Name: "POD_CONNECT_PATH", Value: expectedPrefix + "lab"},
				{Name: "MISSING_PORT_PATH", Value: ""},
			}))
		})

		It("should fail to generate when a podConfig `extraEnv` value has an invalid go template", func() {
			By("generating the StatefulSet with an invalid go template in podConfig `extraEnv`")
			podConfigSpec.ExtraEnv = []corev1.EnvVar{
				{Name: "BAD_TEMPLATE", Value: `{{ httpPathPrefix 'jupyterlab' }}`},
			}
			_, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring(`failed to render extraEnv "BAD_TEMPLATE"`))
		})
	})

	Context("When reconciling podConfig `extraEnv` on a Workspace", Serial, Ordered, func() {

		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
			workspaceKindKey  types.NamespacedName
		)

		getMainContainerEnv := func() ([]corev1.EnvVar, error) {
			statefulSetList := &appsv1.StatefulSetList{}
			if err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err != nil {
				return nil, err
			}
			if len(statefulSetList.Items) != 1 {
				return nil, fmt.Errorf("expected 1 StatefulSet, found %d", len(statefulSetList.Items))
			}
			containers := statefulSetList.Items[0].Spec.Template.Spec.Containers
			if len(containers) != 1 {
				return nil, fmt.Errorf("expected 1 container, found %d", len(containers))
			}
			return containers[0].Env, nil
		}

		BeforeAll(func() {
			uniqueName := "ws-podconfig-extraenv-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}
			workspaceKindKey = types.NamespacedName{Name: workspaceKindName}

			By("creating a WorkspaceKind with WorkspaceKind-level and per-podConfig `extraEnv`")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = []corev1.EnvVar{
				{Name: "SHARED_VAR", Value: "from-wsk"},
				{Name: "NB_PREFIX", Value: `{{ httpPathPrefix "jupyterlab" }}`},
				{Name: "WSK_ONLY", Value: "wsk-default"},
			}
			// Values[0] is "tiny_cpu", Values[1] is "small_cpu"
			workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec.ExtraEnv = []corev1.EnvVar{
				{Name: "TINY_NEW_1", Value: "tiny-1"},
				{Name: "SHARED_VAR", Value: "from-tiny-cpu"},
				{Name: "TINY_PREFIX", Value: `{{ httpPathPrefix "jupyterlab" }}tiny`},
			}
			workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[1].Spec.ExtraEnv = []corev1.EnvVar{
				{Name: "SMALL_ONLY", Value: "small-1"},
				{Name: "WSK_ONLY", Value: "from-small-cpu"},
			}
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating a Workspace selecting `tiny_cpu` and a non-redirected imageConfig")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			workspace.Spec.PodTemplate.Options.ImageConfig = "jupyterlab_scipy_190"
			workspace.Spec.PodTemplate.Options.PodConfig = "tiny_cpu"
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())
		})

		It("should apply the merged and rendered `extraEnv` for the initial podConfig", func() {
			expectedPrefix := getWorkspaceConnectPath(namespaceName, workspaceName, "jupyterlab")
			Eventually(getMainContainerEnv, timeout, interval).Should(Equal([]corev1.EnvVar{
				{Name: "SHARED_VAR", Value: "from-tiny-cpu"},
				{Name: "NB_PREFIX", Value: expectedPrefix},
				{Name: "WSK_ONLY", Value: "wsk-default"},
				{Name: "TINY_NEW_1", Value: "tiny-1"},
				{Name: "TINY_PREFIX", Value: expectedPrefix + "tiny"},
			}))
		})

		It("should remove variables from the previous podConfig and apply the new podConfig's `extraEnv` when switching podConfig", func() {
			By("updating the Workspace to select `small_cpu`")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())
			patch := client.MergeFrom(workspace.DeepCopy())
			workspace.Spec.PodTemplate.Options.PodConfig = "small_cpu"
			Expect(k8sClient.Patch(ctx, workspace, patch)).To(Succeed())

			expectedPrefix := getWorkspaceConnectPath(namespaceName, workspaceName, "jupyterlab")
			By("checking the StatefulSet container env drops `tiny_cpu` vars, restores `SHARED_VAR`, overrides `WSK_ONLY`, and adds `SMALL_ONLY`")
			Eventually(getMainContainerEnv, timeout, interval).Should(Equal([]corev1.EnvVar{
				{Name: "SHARED_VAR", Value: "from-wsk"},
				{Name: "NB_PREFIX", Value: expectedPrefix},
				{Name: "WSK_ONLY", Value: "from-small-cpu"},
				{Name: "SMALL_ONLY", Value: "small-1"},
			}))
		})

		// NOTE: the podConfig `spec` (including `extraEnv`) can NOT be changed while it is used by a Workspace
		//       (enforced by the WorkspaceKind webhook), so we only test changes to the WorkspaceKind-level `extraEnv`,
		//       which is MUTABLE, and check that the podConfig `extraEnv` is still layered on top of it.
		It("should keep applying the podConfig `extraEnv` when the WorkspaceKind-level `extraEnv` changes", func() {
			By("updating the WorkspaceKind-level `extraEnv` (changing `SHARED_VAR` and `WSK_ONLY`, and adding `WSK_NEW`)")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
			Expect(k8sClient.Get(ctx, workspaceKindKey, workspaceKind)).To(Succeed())
			patch := client.MergeFrom(workspaceKind.DeepCopy())
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = []corev1.EnvVar{
				{Name: "SHARED_VAR", Value: "from-wsk-v2"},
				{Name: "NB_PREFIX", Value: `{{ httpPathPrefix "jupyterlab" }}`},
				{Name: "WSK_ONLY", Value: "wsk-v2"},
				{Name: "WSK_NEW", Value: "wsk-new"},
			}
			Expect(k8sClient.Patch(ctx, workspaceKind, patch)).To(Succeed())

			expectedPrefix := getWorkspaceConnectPath(namespaceName, workspaceName, "jupyterlab")
			By("checking the `small_cpu` override of `WSK_ONLY` still wins in place, and `SMALL_ONLY` stays after all WorkspaceKind-level variables")
			Eventually(getMainContainerEnv, timeout, interval).Should(Equal([]corev1.EnvVar{
				{Name: "SHARED_VAR", Value: "from-wsk-v2"},
				{Name: "NB_PREFIX", Value: expectedPrefix},
				{Name: "WSK_ONLY", Value: "from-small-cpu"},
				{Name: "WSK_NEW", Value: "wsk-new"},
				{Name: "SMALL_ONLY", Value: "small-1"},
			}))

			By("leaving `status.pendingRestart` false, consistent with `podTemplate.podSpec.mainContainer.extraEnv`")
			Consistently(func() (bool, error) {
				workspace := &kubefloworgv1beta1.Workspace{}
				if err := k8sClient.Get(ctx, workspaceKey, workspace); err != nil {
					return false, err
				}
				return workspace.Status.PendingRestart, nil
			}, "2s", interval).Should(BeFalse())
		})
	})

	Context("When mounting Secrets with a `defaultMode` in a Workspace", Serial, Ordered, func() {

		// Define utility variables for object names.
		// NOTE: to avoid conflicts between parallel tests, resource names are unique to each test
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
			serviceAccount    *corev1.ServiceAccount
		)

		// the Workspace mounts one Secret with `defaultMode` unset, and one with an explicit `defaultMode` of 0,
		// which the controller mounts as the StatefulSet volumes `secret-volume-0` and `secret-volume-1`
		const (
			unsetModeVolumeName = "secret-volume-0"
			zeroModeVolumeName  = "secret-volume-1"
		)

		BeforeAll(func() {
			uniqueName := "ws-secret-defaultmode-test"
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating the ServiceAccount")
			serviceAccount = &corev1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{
					Name:      exampleServiceAccountName,
					Namespace: namespaceName,
				},
			}
			Expect(k8sClient.Create(ctx, serviceAccount)).To(Succeed())

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			workspace.Spec.PodTemplate.Volumes.Secrets = []kubefloworgv1beta1.PodSecretMount{
				{
					SecretName: "my-secret-unset-mode",
					MountPath:  "/secrets/unset-mode",
				},
				{
					SecretName:  "my-secret-zero-mode",
					MountPath:   "/secrets/zero-mode",
					DefaultMode: new(int32(0)),
				},
			}
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			Expect(k8sClient.Delete(ctx, workspace)).To(Succeed())

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			Expect(k8sClient.Delete(ctx, workspaceKind)).To(Succeed())

			By("deleting the ServiceAccount")
			Expect(k8sClient.Delete(ctx, serviceAccount)).To(Succeed())
		})

		It("should default an unset `defaultMode` to 420 and keep an explicit `defaultMode` of 0", func() {
			By("getting the Workspace from the API server")
			workspace := &kubefloworgv1beta1.Workspace{}
			Expect(k8sClient.Get(ctx, workspaceKey, workspace)).To(Succeed())

			By("checking the CRD default was applied only to the Secret without a `defaultMode`")
			Expect(workspace.Spec.PodTemplate.Volumes.Secrets).To(HaveLen(2))
			Expect(workspace.Spec.PodTemplate.Volumes.Secrets[0].DefaultMode).To(HaveValue(Equal(int32(420))))
			Expect(workspace.Spec.PodTemplate.Volumes.Secrets[1].DefaultMode).To(HaveValue(Equal(int32(0))))
		})

		It("should pass each `defaultMode` through to the StatefulSet Secret volumes", func() {
			By("waiting for the StatefulSet to be created")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			By("checking the Secret volumes carry the `defaultMode` of the Workspace")
			volumes := statefulSetList.Items[0].Spec.Template.Spec.Volumes
			Expect(volumes).To(ContainElement(And(
				HaveField("Name", unsetModeVolumeName),
				HaveField("VolumeSource.Secret.DefaultMode", HaveValue(Equal(int32(420)))),
			)))
			Expect(volumes).To(ContainElement(And(
				HaveField("Name", zeroModeVolumeName),
				HaveField("VolumeSource.Secret.DefaultMode", HaveValue(Equal(int32(0)))),
			)))
		})

		It("should leave the Secret volume `defaultMode` unset when the Workspace does not set one", func() {
			// NOTE: the API server always defaults `defaultMode`, so a nil value can only reach
			//       generateStatefulSet from an object built in Go, which bypasses admission
			By("generating the StatefulSet for a Workspace with a nil `defaultMode`")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			workspace.Spec.PodTemplate.Volumes.Secrets = []kubefloworgv1beta1.PodSecretMount{
				{
					SecretName: "my-secret-unset-mode",
					MountPath:  "/secrets/unset-mode",
				},
			}
			imageConfigSpec := workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec
			podConfigSpec := workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the Secret volume has no `defaultMode`, so the API server applies its default")
			Expect(statefulSet.Spec.Template.Spec.Volumes).To(ContainElement(And(
				HaveField("Name", unsetModeVolumeName),
				HaveField("VolumeSource.Secret.DefaultMode", BeNil()),
			)))
		})
	})

	Context("When re-adopting owned resources after Workspace recreation", Serial, Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
		)

		BeforeAll(func() {
			uniqueName := fmt.Sprintf("ws-readopt-%d", time.Now().UnixNano())
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())
		})

		AfterAll(func() {
			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			_ = k8sClient.Delete(ctx, workspace)

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			_ = k8sClient.Delete(ctx, workspaceKind)
		})

		It("should update controller references when owned resources retain an old Workspace UID", func() {
			workspace := &kubefloworgv1beta1.Workspace{}
			Eventually(func() error {
				return k8sClient.Get(ctx, workspaceKey, workspace)
			}, timeout, interval).Should(Succeed())

			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			serviceList := &corev1.ServiceList{}
			Eventually(func() ([]corev1.Service, error) {
				err := k8sClient.List(ctx, serviceList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return serviceList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			serviceAccountList := &corev1.ServiceAccountList{}
			Eventually(func() ([]corev1.ServiceAccount, error) {
				err := k8sClient.List(ctx, serviceAccountList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return serviceAccountList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			currentSts := &statefulSetList.Items[0]
			currentSvc := &serviceList.Items[0]
			currentSa := &serviceAccountList.Items[0]

			Expect(metav1.IsControlledBy(currentSts, workspace)).To(BeTrue())
			Expect(metav1.IsControlledBy(currentSvc, workspace)).To(BeTrue())
			Expect(metav1.IsControlledBy(currentSa, workspace)).To(BeTrue())

			By("simulating old Workspace controller reference on StatefulSet, Service and ServiceAccount")
			oldUID := types.UID("old-workspace-uid-12345")
			isController := true
			blockOwnerDeletion := true

			stsPatch := client.MergeFrom(currentSts.DeepCopy())
			currentSts.OwnerReferences = []metav1.OwnerReference{
				{
					APIVersion:         kubefloworgv1beta1.GroupVersion.String(),
					Kind:               "Workspace",
					Name:               workspaceName,
					UID:                oldUID,
					Controller:         &isController,
					BlockOwnerDeletion: &blockOwnerDeletion,
				},
			}
			Expect(k8sClient.Patch(ctx, currentSts, stsPatch)).To(Succeed())

			svcPatch := client.MergeFrom(currentSvc.DeepCopy())
			currentSvc.OwnerReferences = []metav1.OwnerReference{
				{
					APIVersion:         kubefloworgv1beta1.GroupVersion.String(),
					Kind:               "Workspace",
					Name:               workspaceName,
					UID:                oldUID,
					Controller:         &isController,
					BlockOwnerDeletion: &blockOwnerDeletion,
				},
			}
			Expect(k8sClient.Patch(ctx, currentSvc, svcPatch)).To(Succeed())

			saPatch := client.MergeFrom(currentSa.DeepCopy())
			currentSa.OwnerReferences = []metav1.OwnerReference{
				{
					APIVersion:         kubefloworgv1beta1.GroupVersion.String(),
					Kind:               "Workspace",
					Name:               workspaceName,
					UID:                oldUID,
					Controller:         &isController,
					BlockOwnerDeletion: &blockOwnerDeletion,
				},
			}
			Expect(k8sClient.Patch(ctx, currentSa, saPatch)).To(Succeed())

			By("triggering reconciliation of the Workspace")
			wsPatch := client.MergeFrom(workspace.DeepCopy())
			if workspace.Annotations == nil {
				workspace.Annotations = make(map[string]string)
			}
			workspace.Annotations["test-reconcile-trigger"] = fmt.Sprintf("%d", time.Now().UnixNano())
			Expect(k8sClient.Patch(ctx, workspace, wsPatch)).To(Succeed())

			By("verifying the StatefulSet controller reference is updated to current Workspace UID")
			Eventually(func() (types.UID, error) {
				sts := &appsv1.StatefulSet{}
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: currentSts.Name, Namespace: namespaceName}, sts); err != nil {
					return "", err
				}
				ctrlRef := metav1.GetControllerOf(sts)
				if ctrlRef == nil {
					return "", fmt.Errorf("no controller reference")
				}
				return ctrlRef.UID, nil
			}, timeout, interval).Should(Equal(workspace.UID))

			By("verifying the Service controller reference is updated to current Workspace UID")
			Eventually(func() (types.UID, error) {
				svc := &corev1.Service{}
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: currentSvc.Name, Namespace: namespaceName}, svc); err != nil {
					return "", err
				}
				ctrlRef := metav1.GetControllerOf(svc)
				if ctrlRef == nil {
					return "", fmt.Errorf("no controller reference")
				}
				return ctrlRef.UID, nil
			}, timeout, interval).Should(Equal(workspace.UID))

			By("verifying the ServiceAccount controller reference is updated to current Workspace UID")
			Eventually(func() (types.UID, error) {
				sa := &corev1.ServiceAccount{}
				if err := k8sClient.Get(ctx, types.NamespacedName{Name: currentSa.Name, Namespace: namespaceName}, sa); err != nil {
					return "", err
				}
				ctrlRef := metav1.GetControllerOf(sa)
				if ctrlRef == nil {
					return "", fmt.Errorf("no controller reference")
				}
				return ctrlRef.UID, nil
			}, timeout, interval).Should(Equal(workspace.UID))

			By("keeping the same ServiceAccount for the Workspace")
			Consistently(func() ([]string, error) {
				saList := &corev1.ServiceAccountList{}
				if err := k8sClient.List(ctx, saList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err != nil {
					return nil, err
				}
				names := make([]string, len(saList.Items))
				for i, sa := range saList.Items {
					names[i] = sa.Name
				}
				return names, nil
			}, "2s", interval).Should(ConsistOf(currentSa.Name))
		})
	})

	Context("When generating Workspace status for owned Pod and StatefulSet", func() {
		It("should generate empty WorkspaceStatefulSetStatus when StatefulSet is nil", func() {
			stsStatus := generateWorkspaceStatefulSetStatus(nil)
			Expect(stsStatus.Name).To(BeEmpty())
			Expect(stsStatus.UID).To(BeEmpty())
		})

		It("should generate populated WorkspaceStatefulSetStatus when StatefulSet is provided", func() {
			sts := &appsv1.StatefulSet{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-sts",
					UID:  types.UID("test-sts-uid-123"),
				},
			}
			stsStatus := generateWorkspaceStatefulSetStatus(sts)
			Expect(stsStatus.Name).To(Equal("test-sts"))
			Expect(stsStatus.UID).To(Equal(types.UID("test-sts-uid-123")))
		})

		It("should generate empty WorkspacePodStatus when Pod is nil", func() {
			podStatus := generateWorkspacePodStatus(nil)
			Expect(podStatus.Name).To(BeEmpty())
			Expect(podStatus.UID).To(BeEmpty())
			Expect(podStatus.NodeName).To(BeEmpty())
			Expect(podStatus.Containers).To(BeEmpty())
			Expect(podStatus.InitContainers).To(BeEmpty())
		})

		It("should generate populated WorkspacePodStatus with UID when Pod is provided", func() {
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-pod",
					UID:  types.UID("test-pod-uid-456"),
				},
				Spec: corev1.PodSpec{
					NodeName: "node-1",
					Containers: []corev1.Container{
						{Name: "container-1"},
					},
					InitContainers: []corev1.Container{
						{Name: "init-1"},
					},
				},
			}
			podStatus := generateWorkspacePodStatus(pod)
			Expect(podStatus.Name).To(Equal("test-pod"))
			Expect(podStatus.UID).To(Equal(types.UID("test-pod-uid-456")))
			Expect(podStatus.NodeName).To(Equal("node-1"))
			Expect(podStatus.Containers).To(HaveLen(1))
			Expect(podStatus.Containers[0].Name).To(Equal("container-1"))
			Expect(podStatus.InitContainers).To(HaveLen(1))
			Expect(podStatus.InitContainers[0].Name).To(Equal("init-1"))
		})

		It("should leave podTemplatePod and podTemplateStatefulSet empty when resources do not exist", func() {
			ws := NewExampleWorkspace1("test-ws-empty-status", namespaceName, "test-wsk")
			ws.Spec.Paused = true
			status, _, err := workspaceReconciler.generateWorkspaceStatus(ctx, logf.Log, ws, nil, nil, nil)
			Expect(err).NotTo(HaveOccurred())
			Expect(status.PodTemplatePod.Name).To(BeEmpty())
			Expect(status.PodTemplatePod.UID).To(BeEmpty())
			Expect(status.PodTemplateStatefulSet.Name).To(BeEmpty())
			Expect(status.PodTemplateStatefulSet.UID).To(BeEmpty())
		})

		It("should populate podTemplatePod and podTemplateStatefulSet when resources exist", func() {
			ws := NewExampleWorkspace1("test-ws-populated-status", namespaceName, "test-wsk")
			sts := &appsv1.StatefulSet{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-sts",
					UID:  types.UID("sts-uid-999"),
				},
			}
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-pod",
					UID:  types.UID("pod-uid-999"),
				},
			}
			sa := &corev1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test-sa",
					UID:  types.UID("sa-uid-999"),
				},
			}
			status, _, err := workspaceReconciler.generateWorkspaceStatus(ctx, logf.Log, ws, pod, sts, sa)
			Expect(err).NotTo(HaveOccurred())
			Expect(status.PodTemplatePod.Name).To(Equal("test-pod"))
			Expect(status.PodTemplatePod.UID).To(Equal(types.UID("pod-uid-999")))
			Expect(status.PodTemplateStatefulSet.Name).To(Equal("test-sts"))
			Expect(status.PodTemplateStatefulSet.UID).To(Equal(types.UID("sts-uid-999")))
		})
	})

	Context("When evaluating the Warning Event predicate", func() {
		It("should accept Warning Events for Pod and StatefulSet on Create only, and reject Update, Delete, and Generic", func() {
			podWarningEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "pod-warning-evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Kind: "Pod",
					Name: "pod-1",
				},
				Type: corev1.EventTypeWarning,
			}
			stsWarningEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "sts-warning-evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Kind: "StatefulSet",
					Name: "sts-1",
				},
				Type: corev1.EventTypeWarning,
			}

			// Pod Warning Event
			Expect(isWarningEvent(podWarningEvent)).To(BeTrue())
			Expect(predWarningEvent.Create(event.CreateEvent{Object: podWarningEvent})).To(BeTrue())
			Expect(predWarningEvent.Update(event.UpdateEvent{ObjectOld: podWarningEvent, ObjectNew: podWarningEvent})).To(BeTrue())
			Expect(predWarningEvent.Delete(event.DeleteEvent{Object: podWarningEvent})).To(BeFalse())
			Expect(predWarningEvent.Generic(event.GenericEvent{Object: podWarningEvent})).To(BeFalse())

			// StatefulSet Warning Event
			Expect(isWarningEvent(stsWarningEvent)).To(BeTrue())
			Expect(predWarningEvent.Create(event.CreateEvent{Object: stsWarningEvent})).To(BeTrue())
			Expect(predWarningEvent.Update(event.UpdateEvent{ObjectOld: stsWarningEvent, ObjectNew: stsWarningEvent})).To(BeTrue())
			Expect(predWarningEvent.Delete(event.DeleteEvent{Object: stsWarningEvent})).To(BeFalse())
			Expect(predWarningEvent.Generic(event.GenericEvent{Object: stsWarningEvent})).To(BeFalse())
		})

		It("should reject Warning Events for other kinds (e.g. Node)", func() {
			nodeWarningEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "node-warning-evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Kind: "Node",
					Name: "node-1",
				},
				Type: corev1.EventTypeWarning,
			}
			Expect(isWarningEvent(nodeWarningEvent)).To(BeFalse())
			Expect(predWarningEvent.Create(event.CreateEvent{Object: nodeWarningEvent})).To(BeFalse())
		})

		It("should reject Normal Events", func() {
			normalEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "normal-evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Kind: "Pod",
					Name: "pod-1",
				},
				Type:  corev1.EventTypeNormal,
				Count: 1,
			}
			Expect(isWarningEvent(normalEvent)).To(BeFalse())
			Expect(predWarningEvent.Create(event.CreateEvent{Object: normalEvent})).To(BeFalse())
			Expect(predWarningEvent.Update(event.UpdateEvent{
				ObjectOld: normalEvent,
				ObjectNew: normalEvent,
			})).To(BeFalse())
			Expect(predWarningEvent.Delete(event.DeleteEvent{Object: normalEvent})).To(BeFalse())
			Expect(predWarningEvent.Generic(event.GenericEvent{Object: normalEvent})).To(BeFalse())
		})

		It("should reject Events with empty or unrecognized type", func() {
			unknownEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "unknown-evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Kind: "Pod",
					Name: "pod-1",
				},
			}
			Expect(isWarningEvent(unknownEvent)).To(BeFalse())
			Expect(predWarningEvent.Create(event.CreateEvent{Object: unknownEvent})).To(BeFalse())
		})
	})

	Context("When mapping Events to Workspace reconcile requests", func() {
		It("should return nil for non-Event objects", func() {
			Expect(workspaceReconciler.mapEventToRequest(ctx, &corev1.Pod{})).To(BeNil())
		})

		It("should return nil when event InvolvedObject UID is empty", func() {
			evt := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Name:      "some-pod",
					Namespace: namespaceName,
				},
				Type: corev1.EventTypeWarning,
			}
			Expect(workspaceReconciler.mapEventToRequest(ctx, evt)).To(BeNil())
		})

		It("should return empty slice when InvolvedObject UID does not match any Workspace", func() {
			evt := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "unmatched-evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "Pod",
					UID:       types.UID("non-existent-uid"),
					Namespace: namespaceName,
				},
				Type: corev1.EventTypeWarning,
			}
			requests := workspaceReconciler.mapEventToRequest(ctx, evt)
			Expect(requests).To(BeEmpty())
		})

		It("should return nil when event InvolvedObject Kind is neither Pod nor StatefulSet", func() {
			evt := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{Name: "node-evt", Namespace: namespaceName},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "Node",
					Name:      "some-node",
					Namespace: namespaceName,
					UID:       types.UID("some-uid"),
				},
				Type: corev1.EventTypeWarning,
			}
			Expect(workspaceReconciler.mapEventToRequest(ctx, evt)).To(BeNil())
		})
	})

	Context("When watching Warning Events for owned Pod and StatefulSet", Serial, Ordered, func() {
		var (
			workspaceName     string
			workspaceKindName string
			workspaceKey      types.NamespacedName
			stsUID            types.UID
			podUID            types.UID
			podName           string
			stsName           string
		)

		BeforeAll(func() {
			uniqueName := fmt.Sprintf("ws-event-watch-%d", time.Now().UnixNano())
			workspaceName = fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName = fmt.Sprintf("workspacekind-%s", uniqueName)
			workspaceKey = types.NamespacedName{Name: workspaceName, Namespace: namespaceName}

			By("creating the WorkspaceKind")
			workspaceKind := NewExampleWorkspaceKind1(workspaceKindName)
			Expect(k8sClient.Create(ctx, workspaceKind)).To(Succeed())

			By("creating the Workspace")
			workspace := NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			Expect(k8sClient.Create(ctx, workspace)).To(Succeed())

			By("waiting for the StatefulSet to be created")
			statefulSetList := &appsv1.StatefulSetList{}
			Eventually(func() ([]appsv1.StatefulSet, error) {
				err := k8sClient.List(ctx, statefulSetList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName})
				if err != nil {
					return nil, err
				}
				return statefulSetList.Items, nil
			}, timeout, interval).Should(HaveLen(1))

			sts := statefulSetList.Items[0]
			stsName = sts.Name
			stsUID = sts.UID
			podName = fmt.Sprintf("%s-0", stsName)

			// NOTE: envtest does not run a StatefulSet controller, so we simulate one by
			//       bumping ObservedGeneration to match Generation and stamping an
			//       UpdateRevision. Without this, `generateWorkspaceState()` short-circuits
			//       to Pending ("Waiting for Kubernetes to reconcile StatefulSet") and the
			//       Warning Event handling under test is never reached.
			const stsRevision = "revision-1"
			sts.Status.ObservedGeneration = sts.Generation
			sts.Status.UpdateRevision = stsRevision
			Expect(k8sClient.Status().Update(ctx, &sts)).To(Succeed())

			By("creating the Pod for the StatefulSet in Pending phase")
			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      podName,
					Namespace: namespaceName,
					Labels: map[string]string{
						workspaceNameLabel:              workspaceName,
						appsv1.StatefulSetRevisionLabel: stsRevision,
					},
				},
				Spec: corev1.PodSpec{
					Containers: []corev1.Container{{Name: "main", Image: "busybox"}},
				},
			}
			Expect(ctrl.SetControllerReference(&sts, pod, k8sManager.GetScheme())).To(Succeed())
			Expect(k8sClient.Create(ctx, pod)).To(Succeed())
			pod.Status.Phase = corev1.PodPending
			pod.Status.Conditions = []corev1.PodCondition{
				{Type: corev1.PodScheduled, Status: corev1.ConditionTrue},
			}
			Expect(k8sClient.Status().Update(ctx, pod)).To(Succeed())

			// Fetch the created pod to get its UID
			createdPod := &corev1.Pod{}
			Expect(k8sClient.Get(ctx, types.NamespacedName{Name: podName, Namespace: namespaceName}, createdPod)).To(Succeed())
			podUID = createdPod.UID
			Expect(podUID).NotTo(BeEmpty())

			By("waiting for Workspace status to reflect both Pod and StatefulSet UIDs")
			Eventually(func(g Gomega) {
				ws := &kubefloworgv1beta1.Workspace{}
				g.Expect(k8sClient.Get(ctx, workspaceKey, ws)).To(Succeed())
				g.Expect(ws.Status.State).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
				g.Expect(ws.Status.PodTemplateStatefulSet.Name).To(Equal(stsName))
				g.Expect(ws.Status.PodTemplateStatefulSet.UID).To(Equal(stsUID))
				g.Expect(ws.Status.PodTemplatePod.Name).To(Equal(podName))
				g.Expect(ws.Status.PodTemplatePod.UID).To(Equal(podUID))
			}, timeout, interval).Should(Succeed())
		})

		AfterAll(func() {
			By("deleting created Events")
			eventList := &corev1.EventList{}
			if err := k8sClient.List(ctx, eventList, client.InNamespace(namespaceName)); err == nil {
				for _, e := range eventList.Items {
					_ = k8sClient.Delete(ctx, &e)
				}
			}

			By("deleting the Pod")
			pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: podName, Namespace: namespaceName}}
			_ = k8sClient.Delete(ctx, pod)

			By("deleting the StatefulSet")
			sts := &appsv1.StatefulSet{ObjectMeta: metav1.ObjectMeta{Name: stsName, Namespace: namespaceName}}
			_ = k8sClient.Delete(ctx, sts)

			By("deleting the Service")
			svcList := &corev1.ServiceList{}
			if err := k8sClient.List(ctx, svcList, client.InNamespace(namespaceName), client.MatchingLabels{workspaceNameLabel: workspaceName}); err == nil {
				for _, s := range svcList.Items {
					_ = k8sClient.Delete(ctx, &s)
				}
			}

			By("deleting the Workspace")
			workspace := &kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceName, Namespace: namespaceName},
			}
			_ = k8sClient.Delete(ctx, workspace)

			By("deleting the WorkspaceKind")
			workspaceKind := &kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: workspaceKindName},
			}
			_ = k8sClient.Delete(ctx, workspaceKind)
		})

		It("should resolve the owning Workspace via the field indexer when mapping an event", func() {
			podEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-pod-map-evt",
					Namespace: namespaceName,
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "Pod",
					Name:      podName,
					Namespace: namespaceName,
					UID:       podUID,
				},
				Type: corev1.EventTypeWarning,
			}
			Eventually(func() []reconcile.Request {
				return workspaceReconciler.mapEventToRequest(ctx, podEvent)
			}, timeout, interval).Should(ConsistOf(reconcile.Request{NamespacedName: workspaceKey}))

			stsEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-sts-map-evt",
					Namespace: namespaceName,
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "StatefulSet",
					Name:      stsName,
					Namespace: namespaceName,
					UID:       stsUID,
				},
				Type: corev1.EventTypeWarning,
			}
			Expect(workspaceReconciler.mapEventToRequest(ctx, stsEvent)).To(ConsistOf(reconcile.Request{NamespacedName: workspaceKey}))
		})

		It("should not match events across namespaces even if UID matches", func() {
			crossNsEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-cross-ns-evt",
					Namespace: "other-namespace",
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "Pod",
					Name:      podName,
					Namespace: "other-namespace",
					UID:       podUID,
				},
				Type: corev1.EventTypeWarning,
			}
			Expect(workspaceReconciler.mapEventToRequest(ctx, crossNsEvent)).To(BeEmpty())
		})

		It("should not reconcile Workspace into Error when a Normal Event is posted", func() {
			normalEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      fmt.Sprintf("normal-event-%d", time.Now().UnixNano()),
					Namespace: namespaceName,
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "Pod",
					Name:      podName,
					Namespace: namespaceName,
					UID:       podUID,
				},
				Type:          corev1.EventTypeNormal,
				Reason:        "Scheduled",
				Message:       "Successfully assigned pod to node",
				LastTimestamp: metav1.Now(),
			}
			Expect(k8sClient.Create(ctx, normalEvent)).To(Succeed())

			// State should remain Pending
			Consistently(func(g Gomega) {
				ws := &kubefloworgv1beta1.Workspace{}
				g.Expect(k8sClient.Get(ctx, workspaceKey, ws)).To(Succeed())
				g.Expect(ws.Status.State).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
			}, time.Second*3, interval).Should(Succeed())
		})

		It("should reconcile Workspace into Error state when a Warning Event is posted for the Pod", func() {
			warningMsg := "MountVolume.SetUp failed for volume 'data': mount timed out"
			warningEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      fmt.Sprintf("pod-warning-%d", time.Now().UnixNano()),
					Namespace: namespaceName,
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "Pod",
					Name:      podName,
					Namespace: namespaceName,
					UID:       podUID,
				},
				Type:          corev1.EventTypeWarning,
				Reason:        "FailedMount",
				Message:       warningMsg,
				LastTimestamp: metav1.Now(),
			}
			Expect(k8sClient.Create(ctx, warningEvent)).To(Succeed())

			Eventually(func(g Gomega) {
				ws := &kubefloworgv1beta1.Workspace{}
				g.Expect(k8sClient.Get(ctx, workspaceKey, ws)).To(Succeed())
				g.Expect(ws.Status.State).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
				g.Expect(ws.Status.StateMessage).To(ContainSubstring(warningMsg))
			}, timeout, interval).Should(Succeed())
		})

		It("should reconcile Workspace into Error state when a Warning Event is posted for the StatefulSet", func() {
			By("deleting the Pod so StatefulSet events are evaluated")
			podToDelete := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: podName, Namespace: namespaceName}}
			Expect(k8sClient.Delete(ctx, podToDelete)).To(Succeed())

			Eventually(func() bool {
				p := &corev1.Pod{}
				err := k8sClient.Get(ctx, types.NamespacedName{Name: podName, Namespace: namespaceName}, p)
				return apierrors.IsNotFound(err)
			}, timeout, interval).Should(BeTrue())

			stsWarningMsg := "create Pod ws-0 in StatefulSet ws failed"
			stsWarningEvent := &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      fmt.Sprintf("sts-warning-%d", time.Now().UnixNano()),
					Namespace: namespaceName,
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "StatefulSet",
					Name:      stsName,
					Namespace: namespaceName,
					UID:       stsUID,
				},
				Type:          corev1.EventTypeWarning,
				Reason:        "FailedCreate",
				Message:       stsWarningMsg,
				LastTimestamp: metav1.Now(),
			}
			Expect(k8sClient.Create(ctx, stsWarningEvent)).To(Succeed())

			Eventually(func(g Gomega) {
				ws := &kubefloworgv1beta1.Workspace{}
				g.Expect(k8sClient.Get(ctx, workspaceKey, ws)).To(Succeed())
				g.Expect(ws.Status.State).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
				g.Expect(ws.Status.StateMessage).To(ContainSubstring(stsWarningMsg))
			}, timeout, interval).Should(Succeed())
		})
	})

	Context("When evaluating Workspace state with WatchWarningEvents configuration", func() {
		var (
			reconcilerDisabled *WorkspaceReconciler
			reconcilerEnabled  *WorkspaceReconciler
			reconcilerNilCfg   *WorkspaceReconciler
			reconcilerUncached *WorkspaceReconciler
			testSts            *appsv1.StatefulSet
			testPod            *corev1.Pod
			stsUID             types.UID
			podUID             types.UID
			podWarningMsg      string
			stsWarningMsg      string
			podWarningEvent    *corev1.Event
			stsWarningEvent    *corev1.Event
		)

		BeforeEach(func() {
			reconcilerDisabled = &WorkspaceReconciler{
				Client: k8sManager.GetClient(),
				Scheme: k8sManager.GetScheme(),
				Config: &config.EnvConfig{WatchWarningEvents: false},
			}
			reconcilerEnabled = &WorkspaceReconciler{
				Client: k8sManager.GetClient(),
				Scheme: k8sManager.GetScheme(),
				Config: &config.EnvConfig{WatchWarningEvents: true},
			}
			reconcilerNilCfg = &WorkspaceReconciler{
				Client: k8sManager.GetClient(),
				Scheme: k8sManager.GetScheme(),
				Config: nil,
			}
			// NOTE: `k8sClient` is a direct (uncached) client, so this reconciler reads Events the
			//       same way the controller does when `--watch-warning-events` is disabled: with the
			//       field selector sent to the API server, rather than resolved against a local
			//       cache index. This is what ensures `IndexEventInvolvedObjectUidField` remains a
			//       valid Kubernetes field label for `v1.Event`.
			reconcilerUncached = &WorkspaceReconciler{
				Client: k8sClient,
				Scheme: k8sManager.GetScheme(),
				Config: &config.EnvConfig{WatchWarningEvents: false},
			}

			stsUID = types.UID(fmt.Sprintf("sts-uid-%d", time.Now().UnixNano()))
			podUID = types.UID(fmt.Sprintf("pod-uid-%d", time.Now().UnixNano()))

			// NOTE: the StatefulSet and Pod must be coherent (matching generations and
			//       revisions), otherwise `generateWorkspaceState()` short-circuits to Pending
			//       before it evaluates any Warning Events.
			const stsRevision = "revision-1"

			testSts = &appsv1.StatefulSet{
				ObjectMeta: metav1.ObjectMeta{
					Name:       "test-sts-eval",
					Namespace:  namespaceName,
					UID:        stsUID,
					Generation: 1,
				},
				Status: appsv1.StatefulSetStatus{
					ObservedGeneration: 1,
					UpdateRevision:     stsRevision,
				},
			}
			testPod = &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      "test-pod-eval-0",
					Namespace: namespaceName,
					UID:       podUID,
					Labels: map[string]string{
						appsv1.StatefulSetRevisionLabel: stsRevision,
					},
				},
				Status: corev1.PodStatus{
					Phase: corev1.PodPending,
				},
			}

			podWarningMsg = fmt.Sprintf("pod warning msg %d", time.Now().UnixNano())
			podWarningEvent = &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      fmt.Sprintf("pod-eval-warning-%d", time.Now().UnixNano()),
					Namespace: namespaceName,
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "Pod",
					Name:      testPod.Name,
					Namespace: namespaceName,
					UID:       podUID,
				},
				Type:          corev1.EventTypeWarning,
				Reason:        "FailedMount",
				Message:       podWarningMsg,
				LastTimestamp: metav1.Now(),
			}
			Expect(k8sClient.Create(ctx, podWarningEvent)).To(Succeed())

			stsWarningMsg = fmt.Sprintf("sts warning msg %d", time.Now().UnixNano())
			stsWarningEvent = &corev1.Event{
				ObjectMeta: metav1.ObjectMeta{
					Name:      fmt.Sprintf("sts-eval-warning-%d", time.Now().UnixNano()),
					Namespace: namespaceName,
				},
				InvolvedObject: corev1.ObjectReference{
					Kind:      "StatefulSet",
					Name:      testSts.Name,
					Namespace: namespaceName,
					UID:       stsUID,
				},
				Type:          corev1.EventTypeWarning,
				Reason:        "FailedCreate",
				Message:       stsWarningMsg,
				LastTimestamp: metav1.Now(),
			}
			Expect(k8sClient.Create(ctx, stsWarningEvent)).To(Succeed())
		})

		AfterEach(func() {
			if podWarningEvent != nil {
				_ = k8sClient.Delete(ctx, podWarningEvent)
			}
			if stsWarningEvent != nil {
				_ = k8sClient.Delete(ctx, stsWarningEvent)
			}
		})

		// NOTE: `--watch-warning-events` only controls whether the controller WATCHES (and therefore
		//       caches) Warning Events, it does NOT control whether they are reported in the
		//       Workspace status. So all of the following cases must behave identically, the only
		//       difference being how quickly a reconcile is triggered in a real cluster.

		It("should detect pod warning event and return Error when WatchWarningEvents is true", func() {
			Eventually(func(g Gomega) {
				state, msg, _, err := reconcilerEnabled.generateWorkspaceState(
					ctx, logf.Log, false, testSts, testPod,
				)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
				g.Expect(msg).To(ContainSubstring(podWarningMsg))
			}, timeout, interval).Should(Succeed())
		})

		It("should detect statefulset warning event and return Error when WatchWarningEvents is true", func() {
			Eventually(func(g Gomega) {
				state, msg, _, err := reconcilerEnabled.generateWorkspaceState(
					ctx, logf.Log, false, testSts, nil,
				)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
				g.Expect(msg).To(ContainSubstring(stsWarningMsg))
			}, timeout, interval).Should(Succeed())
		})

		It("should detect pod warning event and return Error when WatchWarningEvents is false", func() {
			Eventually(func(g Gomega) {
				state, msg, _, err := reconcilerDisabled.generateWorkspaceState(
					ctx, logf.Log, false, testSts, testPod,
				)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
				g.Expect(msg).To(ContainSubstring(podWarningMsg))
			}, timeout, interval).Should(Succeed())
		})

		It("should detect statefulset warning event and return Error when WatchWarningEvents is false", func() {
			Eventually(func(g Gomega) {
				state, msg, _, err := reconcilerDisabled.generateWorkspaceState(
					ctx, logf.Log, false, testSts, nil,
				)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
				g.Expect(msg).To(ContainSubstring(stsWarningMsg))
			}, timeout, interval).Should(Succeed())
		})

		It("should detect pod warning event and return Error when Config is nil", func() {
			Eventually(func(g Gomega) {
				state, msg, _, err := reconcilerNilCfg.generateWorkspaceState(
					ctx, logf.Log, false, testSts, testPod,
				)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
				g.Expect(msg).To(ContainSubstring(podWarningMsg))
			}, timeout, interval).Should(Succeed())
		})

		It("should read warning events from the API server when the Event cache is disabled", func() {
			// NOTE: this uses a direct (uncached) client, so the field selector is sent to the API
			//       server. It fails with "field label not supported" if
			//       `IndexEventInvolvedObjectUidField` is ever changed to a name that is not a real
			//       `v1.Event` field label (e.g. by re-adding the conventional leading dot).
			//       No `Eventually` is needed, because uncached reads are strongly consistent.
			state, msg, _, err := reconcilerUncached.generateWorkspaceState(
				ctx, logf.Log, false, testSts, testPod,
			)
			Expect(err).NotTo(HaveOccurred())
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
			Expect(msg).To(ContainSubstring(podWarningMsg))

			state, msg, _, err = reconcilerUncached.generateWorkspaceState(
				ctx, logf.Log, false, testSts, nil,
			)
			Expect(err).NotTo(HaveOccurred())
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateError))
			Expect(msg).To(ContainSubstring(stsWarningMsg))
		})

		It("should return Pending when the Pod has no warning events", func() {
			podWithoutEvents := testPod.DeepCopy()
			podWithoutEvents.UID = types.UID(fmt.Sprintf("pod-uid-no-events-%d", time.Now().UnixNano()))

			for name, reconciler := range map[string]*WorkspaceReconciler{
				"cached":   reconcilerDisabled,
				"uncached": reconcilerUncached,
			} {
				By(fmt.Sprintf("using the %s client", name))
				state, msg, result, err := reconciler.generateWorkspaceState(
					ctx, logf.Log, false, testSts, podWithoutEvents,
				)
				Expect(err).NotTo(HaveOccurred())
				Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
				Expect(msg).To(Equal(stateMsgPendingPodPending))
				Expect(result.RequeueAfter).To(Equal(15 * time.Second))
			}
		})

		It("should return Pending when the Pod is nil and the StatefulSet has no warning events", func() {
			stsWithoutEvents := testSts.DeepCopy()
			stsWithoutEvents.UID = types.UID(fmt.Sprintf("sts-uid-no-events-%d", time.Now().UnixNano()))

			for name, reconciler := range map[string]*WorkspaceReconciler{
				"cached":   reconcilerDisabled,
				"uncached": reconcilerUncached,
			} {
				By(fmt.Sprintf("using the %s client", name))
				state, msg, _, err := reconciler.generateWorkspaceState(
					ctx, logf.Log, false, stsWithoutEvents, nil,
				)
				Expect(err).NotTo(HaveOccurred())
				Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
				Expect(msg).To(Equal(stateMsgPendingPodCreate))
			}
		})
	})

	Context("When generating the Workspace state", func() {
		var (
			reconciler  *WorkspaceReconciler
			statefulSet *appsv1.StatefulSet
			pod         *corev1.Pod
		)
		BeforeEach(func() {
			const defaultStsRevision = "revision-1"

			reconciler = &WorkspaceReconciler{}

			statefulSet = &appsv1.StatefulSet{
				ObjectMeta: metav1.ObjectMeta{
					Generation: 1,
				},
				Status: appsv1.StatefulSetStatus{
					ObservedGeneration: 1,
					UpdateRevision:     defaultStsRevision,
				},
			}

			pod = &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{
						appsv1.StatefulSetRevisionLabel: defaultStsRevision,
					},
				},
			}
		})

		It("should return Pending when the StatefulSet's ObservedGeneration is behind its Generation", func() {
			statefulSet.Generation = 2
			statefulSet.Status.ObservedGeneration = 1

			state, message, result, err := reconciler.generateWorkspaceState(
				context.Background(),
				logr.Discard(),
				false,
				statefulSet,
				pod,
			)

			Expect(err).NotTo(HaveOccurred())
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
			Expect(message).To(Equal(stateMsgPendingStatefulSetReconcile))
			Expect(result).To(Equal(ctrl.Result{RequeueAfter: 5 * time.Second}))
		})

		It("should return Pending when the StatefulSet's ObservedGeneration is ahead of its Generation", func() {
			statefulSet.Generation = 1
			statefulSet.Status.ObservedGeneration = 2

			state, message, result, err := reconciler.generateWorkspaceState(
				context.Background(),
				logr.Discard(),
				false,
				statefulSet,
				pod,
			)

			Expect(err).NotTo(HaveOccurred())
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
			Expect(message).To(Equal(stateMsgPendingStatefulSetReconcile))
			Expect(result).To(Equal(ctrl.Result{RequeueAfter: 5 * time.Second}))
		})

		It("should return Paused when the workspace is paused and the StatefulSet's Generation and ObservedGeneration match", func() {
			state, message, result, err := reconciler.generateWorkspaceState(
				context.Background(),
				logr.Discard(),
				true,
				statefulSet,
				nil,
			)

			Expect(err).NotTo(HaveOccurred())
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePaused))
			Expect(message).To(Equal(stateMsgPaused))
			Expect(result).To(Equal(ctrl.Result{}))
		})
		It("should return Pending when the Pod's revision does not match the StatefulSet's UpdateRevision", func() {
			pod.Labels[appsv1.StatefulSetRevisionLabel] = "revision-old"

			state, message, result, err := reconciler.generateWorkspaceState(
				context.Background(),
				logr.Discard(),
				false,
				statefulSet,
				pod,
			)
			Expect(err).NotTo(HaveOccurred())
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
			Expect(message).To(Equal(stateMsgPendingPodUpdate))
			Expect(result).To(Equal(ctrl.Result{RequeueAfter: 5 * time.Second}))

		})

		It("should return Terminating for a terminating Pod, even when its revision does not match the StatefulSet's", func() {
			pod.Labels[appsv1.StatefulSetRevisionLabel] = "revision-old"
			now := metav1.Now()
			pod.DeletionTimestamp = &now

			state, message, result, err := reconciler.generateWorkspaceState(
				context.Background(),
				logr.Discard(),
				false,
				statefulSet,
				pod,
			)

			Expect(err).NotTo(HaveOccurred())
			Expect(result).To(Equal(ctrl.Result{RequeueAfter: 5 * time.Second}))
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateTerminating))
			Expect(message).To(Equal(stateMsgTerminating))
		})

		It("should return Running when the Pod is ready and its revision matches the StatefulSet's UpdateRevision", func() {
			pod.Status.Phase = corev1.PodRunning
			pod.Status.Conditions = []corev1.PodCondition{
				{
					Type:   corev1.PodReady,
					Status: corev1.ConditionTrue,
				},
			}

			state, message, result, err := reconciler.generateWorkspaceState(
				context.Background(),
				logr.Discard(),
				false,
				statefulSet,
				pod,
			)

			Expect(err).NotTo(HaveOccurred())
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateRunning))
			Expect(message).To(Equal(stateMsgRunning))
			Expect(result).To(Equal(ctrl.Result{}))
		})
	})

	Context("When generating a StatefulSet with per-podConfig metadata", func() {

		// NOTE: these tests call generateStatefulSet directly and do not create any
		//       resources in the cluster, so no teardown is required.
		var (
			workspace       *kubefloworgv1beta1.Workspace
			workspaceKind   *kubefloworgv1beta1.WorkspaceKind
			imageConfigSpec kubefloworgv1beta1.ImageConfigSpec
			podConfigSpec   kubefloworgv1beta1.PodConfigSpec
			serviceAccount  *corev1.ServiceAccount
		)

		BeforeEach(func() {
			uniqueName := "ws-podconfig-metadata-test"
			workspaceName := fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName := fmt.Sprintf("workspacekind-%s", uniqueName)

			serviceAccount = &corev1.ServiceAccount{
				ObjectMeta: metav1.ObjectMeta{
					Name:      exampleServiceAccountName,
					Namespace: namespaceName,
				},
			}
			workspaceKind = NewExampleWorkspaceKind1(workspaceKindName)
			workspace = NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			imageConfigSpec = workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec
			podConfigSpec = workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec

			// ensure every metadata level starts unset, so each test only sets what it exercises
			workspaceKind.Spec.PodTemplate.PodMetadata = nil
			workspaceKind.Spec.PodTemplate.StatefulSetMetadata = nil
			workspace.Spec.PodTemplate.PodMetadata = nil
			podConfigSpec.PodMetadata = nil
			podConfigSpec.StatefulSetMetadata = nil
		})

		It("should apply the podConfig `podMetadata` to the Pod template and `statefulSetMetadata` to the StatefulSet", func() {
			By("generating the StatefulSet with per-podConfig metadata")
			podConfigSpec.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Labels:      map[string]string{"pod-label": "pod-value"},
				Annotations: map[string]string{"pod-annotation": "pod-value"},
			}
			podConfigSpec.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Labels:      map[string]string{"sts-label": "sts-value"},
				Annotations: map[string]string{"sts-annotation": "sts-value"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the podMetadata lands on the Pod template and not the StatefulSet")
			Expect(statefulSet.Spec.Template.Labels).To(HaveKeyWithValue("pod-label", "pod-value"))
			Expect(statefulSet.Spec.Template.Annotations).To(HaveKeyWithValue("pod-annotation", "pod-value"))
			Expect(statefulSet.Labels).NotTo(HaveKey("pod-label"))

			By("checking the statefulSetMetadata lands on the StatefulSet and not the Pod template")
			Expect(statefulSet.Labels).To(HaveKeyWithValue("sts-label", "sts-value"))
			Expect(statefulSet.Annotations).To(HaveKeyWithValue("sts-annotation", "sts-value"))
			Expect(statefulSet.Spec.Template.Labels).NotTo(HaveKey("sts-label"))
		})

		It("should let podConfig metadata win over WorkspaceKind-level metadata on key conflicts", func() {
			By("setting the same keys at both the WorkspaceKind and podConfig levels")
			workspaceKind.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Labels: map[string]string{"shared": "from-workspacekind"},
			}
			workspaceKind.Spec.PodTemplate.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Labels: map[string]string{"shared": "from-workspacekind"},
			}
			podConfigSpec.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Labels: map[string]string{"shared": "from-podconfig"},
			}
			podConfigSpec.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Labels: map[string]string{"shared": "from-podconfig"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the podConfig value wins on both the Pod template and the StatefulSet")
			Expect(statefulSet.Spec.Template.Labels).To(HaveKeyWithValue("shared", "from-podconfig"))
			Expect(statefulSet.Labels).To(HaveKeyWithValue("shared", "from-podconfig"))
		})

		It("should let Workspace-level `podMetadata` win over the podConfig on the Pod template", func() {
			By("setting the same key at the podConfig and Workspace levels")
			podConfigSpec.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Labels: map[string]string{"shared": "from-podconfig"},
			}
			workspace.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspacePodMetadata{
				Labels: map[string]string{"shared": "from-workspace"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the Workspace value wins on the Pod template")
			Expect(statefulSet.Spec.Template.Labels).To(HaveKeyWithValue("shared", "from-workspace"))
		})

		It("should not let podConfig metadata override the controller-managed labels", func() {
			By("setting podConfig metadata that reuses the controller label keys")
			podConfigSpec.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Labels: map[string]string{workspaceNameLabel: "hijacked", workspaceSelectorLabel: "hijacked"},
			}
			podConfigSpec.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Labels: map[string]string{workspaceNameLabel: "hijacked"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the controller values win on both the Pod template and the StatefulSet")
			Expect(statefulSet.Spec.Template.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspace.Name))
			Expect(statefulSet.Spec.Template.Labels).To(HaveKeyWithValue(workspaceSelectorLabel, workspace.Name))
			Expect(statefulSet.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspace.Name))
		})

		It("should re-derive metadata so keys from a different podConfig are not carried over", func() {
			By("generating a StatefulSet from a podConfig that contributes a key")
			podConfigA := podConfigSpec
			podConfigA.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Labels: map[string]string{"tier": "gpu"},
			}
			statefulSetA, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigA, serviceAccount)
			Expect(err).NotTo(HaveOccurred())
			Expect(statefulSetA.Spec.Template.Labels).To(HaveKeyWithValue("tier", "gpu"))

			By("generating a StatefulSet from a podConfig that does not contribute that key")
			podConfigB := podConfigSpec
			podConfigB.PodMetadata = nil
			statefulSetB, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigB, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the key contributed only by the first podConfig is absent from the second")
			Expect(statefulSetB.Spec.Template.Labels).NotTo(HaveKey("tier"))
		})

		It("should union annotations across layers and prefer the podConfig on key conflicts", func() {
			By("setting overlapping and distinct annotations at the WorkspaceKind and podConfig levels")
			workspaceKind.Spec.PodTemplate.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Annotations: map[string]string{"origin": "workspacekind", "wk-only": "yes"},
			}
			workspaceKind.Spec.PodTemplate.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Annotations: map[string]string{"origin": "workspacekind", "wk-only": "yes"},
			}
			podConfigSpec.PodMetadata = &kubefloworgv1beta1.WorkspaceKindPodMetadata{
				Annotations: map[string]string{"origin": "podconfig", "pod-only": "yes"},
			}
			podConfigSpec.StatefulSetMetadata = &kubefloworgv1beta1.WorkspaceKindStatefulSetMetadata{
				Annotations: map[string]string{"cost-center": "research"},
			}
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, serviceAccount)
			Expect(err).NotTo(HaveOccurred())

			By("checking the Pod template annotations are the union, with the podConfig winning on conflicts")
			Expect(statefulSet.Spec.Template.Annotations).To(HaveKeyWithValue("origin", "podconfig")) // podConfig wins
			Expect(statefulSet.Spec.Template.Annotations).To(HaveKeyWithValue("wk-only", "yes"))      // WorkspaceKind-only, preserved
			Expect(statefulSet.Spec.Template.Annotations).To(HaveKeyWithValue("pod-only", "yes"))     // podConfig-only

			By("checking the StatefulSet annotations union a WorkspaceKind key with a distinct podConfig key")
			Expect(statefulSet.Annotations).To(HaveKeyWithValue("origin", "workspacekind")) // WorkspaceKind value survives (no podConfig conflict)
			Expect(statefulSet.Annotations).To(HaveKeyWithValue("wk-only", "yes"))
			Expect(statefulSet.Annotations).To(HaveKeyWithValue("cost-center", "research")) // podConfig-only
		})
	})
})
