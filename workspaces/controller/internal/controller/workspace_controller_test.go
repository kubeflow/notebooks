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
	"fmt"
	"strings"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	rbacv1 "k8s.io/api/rbac/v1"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
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
			serviceAccountName := generateServiceAccountName(workspaceName)
			serviceAccount := &corev1.ServiceAccount{}
			Eventually(func() error {
				return k8sClient.Get(ctx, types.NamespacedName{Name: serviceAccountName, Namespace: namespaceName}, serviceAccount)
			}, timeout, interval).Should(Succeed())
			Expect(serviceAccount.Labels).To(HaveKeyWithValue(workspaceNameLabel, workspaceName))
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
			//         - the go templates in WorkspaceKind `spec.podTemplate.extraEnv[].value` should work properly
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
					Match:  &kubefloworgv1beta1.ActivityRuleMatch{},
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
			statefulSetName := statefulSetList.Items[0].Name
			podName := fmt.Sprintf("%s-0", statefulSetName)

			pod := &corev1.Pod{
				ObjectMeta: metav1.ObjectMeta{
					Name:      podName,
					Namespace: namespaceName,
					Labels: map[string]string{
						workspaceNameLabel: workspaceName,
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
			serviceAccountName = generateServiceAccountName(workspaceName)

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
				return workspace.Status.PodTemplatePod.ServiceAccountName, nil
			}, timeout, interval).Should(Equal(serviceAccountName))

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

	Context("When generating the ServiceAccount name for a Workspace", func() {

		It("should be the Workspace name with a `ws-` prefix", func() {
			Expect(generateServiceAccountName("my-workspace")).To(Equal("ws-my-workspace"))
		})

		It("should be stable across calls", func() {
			longName := strings.Repeat("a", 253)
			Expect(generateServiceAccountName(longName)).To(Equal(generateServiceAccountName(longName)))
		})

		It("should fit within the max ServiceAccount name length", func() {
			for _, workspaceName := range []string{"a", strings.Repeat("a", 250), strings.Repeat("a", 253)} {
				name := generateServiceAccountName(workspaceName)
				Expect(len(name)).To(BeNumerically("<=", maxServiceAccountNameLength))
				Expect(name).To(MatchRegexp(`^[a-z0-9]([-a-z0-9]*[a-z0-9])?$`))
			}
		})

		It("should not collide for Workspace names that share a truncated prefix", func() {
			nameA := strings.Repeat("a", 252) + "1"
			nameB := strings.Repeat("a", 252) + "2"
			Expect(generateServiceAccountName(nameA)).NotTo(Equal(generateServiceAccountName(nameB)))
		})
	})
})
