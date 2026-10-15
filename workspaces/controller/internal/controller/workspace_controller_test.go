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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/client"

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
				PodExec: &kubefloworgv1beta1.ActivityProbePodExec{
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
			Expect(k8sClient.Create(ctx, pod)).To(Succeed())
			pod.Status.Phase = corev1.PodRunning
			pod.Status.PodIP = "10.0.0.1"
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
				Expect(roleBinding.Name).To(Equal(generateRoleBindingName(workspaceName, roleBinding.RoleRef.Name)))
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

	Context("When generating the RoleBinding name for a Workspace", func() {

		It("should be stable across calls", func() {
			Expect(generateRoleBindingName("my-workspace", "kubeflow-edit")).
				To(Equal(generateRoleBindingName("my-workspace", "kubeflow-edit")))
		})

		It("should differ for different ClusterRoles", func() {
			Expect(generateRoleBindingName("my-workspace", "kubeflow-edit")).
				NotTo(Equal(generateRoleBindingName("my-workspace", "kubeflow-view")))
		})

		It("should not collide when the Workspace/ClusterRole split is ambiguous", func() {
			Expect(generateRoleBindingName("a", "b-c")).NotTo(Equal(generateRoleBindingName("a-b", "c")))
		})

		It("should fit within the max RoleBinding name length", func() {
			for _, workspaceName := range []string{"a", strings.Repeat("a", 253)} {
				name := generateRoleBindingName(workspaceName, strings.Repeat("b", 253))
				Expect(len(name)).To(BeNumerically("<=", maxRoleBindingNameLength))
				Expect(name).To(MatchRegexp(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`))
			}
		})
	})

	Context("When generating a ServiceAccount for a Workspace", func() {

		It("should use `generateName` with the Workspace name prefix", func() {
			workspace := NewExampleWorkspace1("my-workspace", namespaceName, "my-workspacekind")
			serviceAccount := generateServiceAccount(workspace)
			Expect(serviceAccount.Name).To(BeEmpty())
			Expect(serviceAccount.GenerateName).To(Equal("ws-my-workspace-"))
			Expect(serviceAccount.Labels).To(HaveKeyWithValue(workspaceNameLabel, "my-workspace"))
		})

		It("should leave room for the `generateName` suffix within the max ServiceAccount name length", func() {
			workspace := NewExampleWorkspace1(strings.Repeat("a", 253), namespaceName, "my-workspacekind")
			serviceAccount := generateServiceAccount(workspace)
			Expect(len(serviceAccount.GenerateName)).To(BeNumerically("<=", maxServiceAccountNameLength-generateNameSuffixLength))
			Expect(serviceAccount.GenerateName).To(HaveSuffix("-"))
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
		)

		BeforeEach(func() {
			uniqueName := "ws-statefulset-metadata-test"
			workspaceName := fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName := fmt.Sprintf("workspacekind-%s", uniqueName)

			workspaceKind = NewExampleWorkspaceKind1(workspaceKindName)
			workspace = NewExampleWorkspace1(workspaceName, namespaceName, workspaceKindName)
			imageConfigSpec = workspaceKind.Spec.PodTemplate.Options.ImageConfig.Values[0].Spec
			podConfigSpec = workspaceKind.Spec.PodTemplate.Options.PodConfig.Values[0].Spec

			// ensure the field starts unset, so each test only sets what it exercises
			workspaceKind.Spec.PodTemplate.StatefulSetMetadata = nil
		})

		It("should set only the controller-managed label when `statefulSetMetadata` is unset", func() {
			By("generating the StatefulSet")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
		)

		BeforeEach(func() {
			uniqueName := "ws-statefulset-test"
			workspaceName := fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName := fmt.Sprintf("workspacekind-%s", uniqueName)

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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template has no `schedulerName`, so the API server applies its default")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(BeEmpty())
		})

		It("should use the WorkspaceKind `schedulerName` when the podConfig does not set one", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.SchedulerName = new("workspacekind-scheduler")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template uses the WorkspaceKind `schedulerName`")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(Equal("workspacekind-scheduler"))
		})

		It("should use the podConfig `schedulerName` when the WorkspaceKind does not set one", func() {
			By("generating the StatefulSet")
			podConfigSpec.SchedulerName = new("podconfig-scheduler")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template uses the podConfig `schedulerName`")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(Equal("podconfig-scheduler"))
		})

		It("should prefer the podConfig `schedulerName` over the WorkspaceKind one", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.SchedulerName = new("workspacekind-scheduler")
			podConfigSpec.SchedulerName = new("podconfig-scheduler")
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
			Expect(err).NotTo(HaveOccurred())

			By("checking the pod template uses the podConfig `schedulerName`")
			Expect(statefulSet.Spec.Template.Spec.SchedulerName).To(Equal("podconfig-scheduler"))
		})

		It("should leave container env empty when `extraEnv` is unset on both the WorkspaceKind and the podConfig", func() {
			By("generating the StatefulSet")
			workspaceKind.Spec.PodTemplate.PodSpec.MainContainer.ExtraEnv = nil
			podConfigSpec.ExtraEnv = nil
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			_, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			Expect(result).To(Equal(ctrl.Result{}))
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
			Expect(message).To(Equal(stateMsgWaitingStatefulSetReconcile))
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
			Expect(result).To(Equal(ctrl.Result{}))
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
			Expect(message).To(Equal(stateMsgWaitingStatefulSetReconcile))
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
			Expect(result).To(Equal(ctrl.Result{}))
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePaused))
			Expect(message).To(Equal(stateMsgPaused))
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
			Expect(result).To(Equal(ctrl.Result{}))
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStatePending))
			Expect(message).To(Equal(stateMsgWaitingPodUpdate))
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
			Expect(result).To(Equal(ctrl.Result{}))
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
			Expect(result).To(Equal(ctrl.Result{}))
			Expect(state).To(Equal(kubefloworgv1beta1.WorkspaceStateRunning))
			Expect(message).To(Equal(stateMsgRunning))
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
		)

		BeforeEach(func() {
			uniqueName := "ws-podconfig-metadata-test"
			workspaceName := fmt.Sprintf("workspace-%s", uniqueName)
			workspaceKindName := fmt.Sprintf("workspacekind-%s", uniqueName)

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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
			statefulSetA, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigA, exampleServiceAccountName)
			Expect(err).NotTo(HaveOccurred())
			Expect(statefulSetA.Spec.Template.Labels).To(HaveKeyWithValue("tier", "gpu"))

			By("generating a StatefulSet from a podConfig that does not contribute that key")
			podConfigB := podConfigSpec
			podConfigB.PodMetadata = nil
			statefulSetB, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigB, exampleServiceAccountName)
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
			statefulSet, err := generateStatefulSet(workspace, workspaceKind, &imageConfigSpec, &podConfigSpec, exampleServiceAccountName)
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
