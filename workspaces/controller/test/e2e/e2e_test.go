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

package e2e

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/kubeflow/notebooks/workspaces/controller/test/utils"

	corev1 "k8s.io/api/core/v1"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

const (
	// controller configs
	controllerNamespace = "kubeflow-workspaces"
	controllerImage     = "ghcr.io/kubeflow/notebooks/workspaces-controller:latest"

	// workspace configs
	workspaceNamespace = "workspace-test"
	workspaceName      = "jupyterlab-workspace"
	workspacePortInt   = 8888
	workspacePortId    = "jupyterlab"

	// workspacekind configs
	workspaceKindName = "jupyterlab"

	// curl image
	curlImage = "curlimages/curl:8.9.1"

	// how long to wait in "Eventually" blocks
	timeout = time.Second * 180

	// how long to wait in "Consistently" blocks
	duration = time.Second * 10 //nolint:unused

	// how frequently to poll for conditions
	interval = time.Second * 1

	// activity rules test configs
	//  - we use a dedicated WorkspaceKind/Workspace with a short probe interval and a
	//    podExec probe that always reports inactivity, so that pause triggers quickly
	activityWorkspaceKindName = "jupyterlab-activity"
	activityWorkspaceName     = "jupyterlab-workspace-activity"

	// how long to wait for the workspace to be paused
	//  - the podExec probe reports an old last_activity, so the workspace becomes eligible
	//    shortly after minRunningSeconds elapses (subject to minProbeIntervalSeconds)
	activityTimeout = time.Second * 300

	// exemption test configs
	exemptionWorkspaceKindName = "jupyterlab-exemption"
	exemptionWorkspaceName     = "jupyterlab-workspace-exemption"

	// failing probe test configs
	failingProbeWorkspaceKindName = "jupyterlab-failing-probe"
	failingProbeWorkspaceName     = "jupyterlab-workspace-failing-probe"

	// stale activity test configs
	staleWorkspaceKindName = "jupyterlab-stale"
	staleWorkspaceName     = "jupyterlab-workspace-stale"

	// probe test configs
	probeWorkspaceKindName = "jupyterlab-probe"
	probeWorkspaceName     = "jupyterlab-workspace-probe"
)

var (
	projectDir = ""
)

var _ = Describe("controller", Ordered, func() {

	BeforeAll(func() {
		projectDir, _ = utils.GetProjectDir()

		By("creating the controller namespace")
		cmd := exec.Command("kubectl", "create", "ns", controllerNamespace)
		_, _ = utils.Run(cmd) // ignore errors because namespace may already exist

		By("creating the workspace namespace")
		cmd = exec.Command("kubectl", "create", "ns", workspaceNamespace)
		_, _ = utils.Run(cmd) // ignore errors because namespace may already exist

		By("labeling namespaces for Istio injection")
		err := utils.LabelNamespaceForIstioInjection(controllerNamespace)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		err = utils.LabelNamespaceForIstioInjection(workspaceNamespace)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		By("creating common workspace resources")
		cmd = exec.Command("kubectl", "apply",
			"-k", filepath.Join(projectDir, "manifests/kustomize/samples/common"),
			"-n", workspaceNamespace,
		)
		_, err = utils.Run(cmd)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		By("installing CRDs")
		cmd = exec.Command("make", "install")
		_, err = utils.Run(cmd)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		By("deploying the workspaces-controller")
		cmd = exec.Command("make", "deploy", fmt.Sprintf("IMG=%s", controllerImage))
		_, err = utils.Run(cmd)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		By("waiting for the webhook certificate to be ready")
		waitForWebhookCert := func(g Gomega) {
			// First check if cert-manager has processed the Certificate resource
			cmd := exec.Command("kubectl", "wait", "certificate",
				"workspaces-serving-cert",
				"-n", controllerNamespace,
				"--for=condition=Ready",
				fmt.Sprintf("--timeout=%s", timeout),
			)
			_, err := utils.Run(cmd)
			g.Expect(err).NotTo(HaveOccurred(), "Certificate resource not ready")

			// Also verify the secret was created
			cmd = exec.Command("kubectl", "get", "secret",
				"webhook-server-cert",
				"-n", controllerNamespace,
			)
			_, err = utils.Run(cmd)
			g.Expect(err).NotTo(HaveOccurred(), "webhook-server-cert secret not found")
		}
		Eventually(waitForWebhookCert, timeout, interval).Should(Succeed())

		By("validating that the workspaces-controller pod is running as expected")
		var controllerPodName string
		verifyControllerUp := func(g Gomega) {
			// Get controller pod name
			cmd := exec.Command("kubectl", "get", "pods",
				"-l", "app.kubernetes.io/component=controller-manager",
				"-n", controllerNamespace,
				"-o", "go-template={{ range .items }}"+
					"{{ if not .metadata.deletionTimestamp }}"+
					"{{ .metadata.name }}"+
					"{{ \"\\n\" }}{{ end }}{{ end }}",
			)
			podOutput, err := utils.Run(cmd)
			g.Expect(err).NotTo(HaveOccurred(), "failed to get workspaces-controller pod")

			// Ensure only 1 controller pod is running
			podNames := utils.GetNonEmptyLines(podOutput)
			g.Expect(podNames).To(HaveLen(1), "expected 1 controller pod running")
			controllerPodName = podNames[0]
			g.Expect(controllerPodName).To(ContainSubstring("workspaces-controller"))

			// Validate controller pod status
			cmd = exec.Command("kubectl", "get", "pods",
				controllerPodName,
				"-n", controllerNamespace,
				"-o", "jsonpath={.status.phase}",
			)
			statusPhase, err := utils.Run(cmd)
			g.Expect(err).NotTo(HaveOccurred())
			g.Expect(statusPhase).To(BeEquivalentTo(corev1.PodRunning), "Incorrect workspaces-controller pod phase")
		}
		Eventually(verifyControllerUp, timeout, interval).Should(Succeed())

	})

	AfterAll(func() {
		By("deleting sample Workspace")
		cmd := exec.Command("kubectl", "delete", "-f",
			filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml"),
			"-n", workspaceNamespace,
			"--wait",
			fmt.Sprintf("--timeout=%s", timeout),
		)
		_, _ = utils.Run(cmd)

		By("deleting sample WorkspaceKind")
		cmd = exec.Command("kubectl", "delete",
			"-f", filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml"),
		)
		_, _ = utils.Run(cmd)

		By("deleting common workspace resources")
		cmd = exec.Command("kubectl", "delete",
			"-k", filepath.Join(projectDir, "manifests/kustomize/samples/common"),
			"-n", workspaceNamespace,
		)
		_, _ = utils.Run(cmd)

		By("deleting the controller")
		cmd = exec.Command("make", "undeploy")
		_, _ = utils.Run(cmd)

		By("deleting controller namespace")
		cmd = exec.Command("kubectl", "delete", "ns", controllerNamespace)
		_, _ = utils.Run(cmd)

		By("deleting workspace namespace")
		cmd = exec.Command("kubectl", "delete", "ns", workspaceNamespace)
		_, _ = utils.Run(cmd)

		By("deleting CRDs")
		cmd = exec.Command("make", "uninstall")
		_, _ = utils.Run(cmd)

	})

	Context("Operator", func() {

		It("should run successfully", func() {

			By("creating an instance of WorkspaceKind")
			createWorkspaceKindSample := func() error {
				cmd := exec.Command("kubectl", "apply",
					"-f", filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(createWorkspaceKindSample, timeout, interval).Should(Succeed())

			By("creating an instance of Workspace")
			createWorkspaceSample := func() error {
				cmd := exec.Command("kubectl", "apply",
					"-f", filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml"),
					"-n", workspaceNamespace,
				)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(createWorkspaceSample, timeout, interval).Should(Succeed())

			By("validating that the workspace has 'Running' state")
			verifyWorkspaceState := func(g Gomega) error {
				cmd := exec.Command("kubectl", "get", "workspaces",
					workspaceName,
					"-n", workspaceNamespace,
					"-o", "jsonpath={.status.state}",
				)
				statusState, err := utils.Run(cmd)
				g.Expect(err).NotTo(HaveOccurred())

				// If the workspace is not in the "Running" state get the state message
				if statusState != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					cmd = exec.Command("kubectl", "get", "workspaces",
						workspaceName,
						"-n", workspaceNamespace,
						"-o", "jsonpath={.status.stateMessage}",
					)
					statusStateMessage, err := utils.Run(cmd)
					g.Expect(err).NotTo(HaveOccurred())
					return fmt.Errorf("workspace in %s state with message: %s", statusState, statusStateMessage)
				}
				return nil
			}
			startTime := time.Now()
			Eventually(verifyWorkspaceState, timeout, interval).Should(Succeed())
			_, _ = fmt.Fprintf(GinkgoWriter, "workspace reached 'Running' state in %v\n", time.Since(startTime))

			By("validating that the workspace pod is running as expected")
			verifyWorkspacePod := func(g Gomega) {
				// Get workspace pod name
				cmd := exec.Command("kubectl", "get", "pods",
					"-l", fmt.Sprintf("notebooks.kubeflow.org/workspace-name=%s", workspaceName),
					"-n", workspaceNamespace,
					"-o", "go-template={{ range .items }}"+
						"{{ if not .metadata.deletionTimestamp }}"+
						"{{ .metadata.name }}"+
						"{{ \"\\n\" }}{{ end }}{{ end }}",
				)
				podOutput, err := utils.Run(cmd)
				g.Expect(err).NotTo(HaveOccurred())

				// Ensure only 1 workspace pod is running
				podNames := utils.GetNonEmptyLines(podOutput)
				g.Expect(podNames).To(HaveLen(1), "expected 1 workspace pod running")
				workspacePodName := podNames[0]
				g.Expect(workspacePodName).To(ContainSubstring(fmt.Sprintf("ws-%s", workspaceName)))

				// Validate workspace pod status
				cmd = exec.Command("kubectl", "get", "pods",
					workspacePodName,
					"-n", workspaceNamespace,
					"-o", "jsonpath={.status.phase}",
				)
				statusPhase, err := utils.Run(cmd)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(statusPhase).To(BeEquivalentTo(corev1.PodRunning), "Incorrect workspace pod phase")
			}
			Eventually(verifyWorkspacePod, timeout, interval).Should(Succeed())

			By("validating that the workspace service was created")
			var workspaceSvcName string
			getServiceName := func(g Gomega) {
				// Get the workspace service name
				cmd := exec.Command("kubectl", "get", "services",
					"-l", fmt.Sprintf("notebooks.kubeflow.org/workspace-name=%s", workspaceName),
					"-n", workspaceNamespace,
					"-o", "go-template={{ range .items }}"+
						"{{ if not .metadata.deletionTimestamp }}"+
						"{{ .metadata.name }}"+
						"{{ \"\\n\" }}{{ end }}{{ end }}",
				)
				svcOutput, err := utils.Run(cmd)
				g.Expect(err).NotTo(HaveOccurred())

				// Ensure only 1 service is found
				svcNames := utils.GetNonEmptyLines(svcOutput)
				g.Expect(svcNames).To(HaveLen(1), "expected 1 service found")
				workspaceSvcName = svcNames[0]
				g.Expect(workspaceSvcName).To(ContainSubstring(fmt.Sprintf("ws-%s", workspaceName)))
			}
			Eventually(getServiceName, timeout, interval).Should(Succeed())

			By("validating that the workspace service endpoint is reachable")
			serviceEndpoint := fmt.Sprintf("http://%s:%d/workspace/connect/%s/%s/%s/lab",
				workspaceSvcName, workspacePortInt, workspaceNamespace, workspaceName, workspacePortId,
			)
			curlService := func() error {
				// NOTE: this command should exit with a non-zero status code if the HTTP status code is >= 400
				cmd := exec.Command("kubectl", "run",
					"tmp-curl", "-n", workspaceNamespace, "--labels", "sidecar.istio.io/inject=false",
					"--attach", "--command", fmt.Sprintf("--image=%s", curlImage), "--rm", "--restart=Never", "--",
					"curl", "-sSL", "-o", "/dev/null", "--fail-with-body", serviceEndpoint,
				)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(curlService, timeout, interval).Should(Succeed())

			By("validating that the workspace virtual service was created")
			var workspaceVirtualServiceName string
			verifyWorkspaceVirtualService := func(g Gomega) {
				cmd := exec.Command("kubectl", "get", "virtualservices",
					"-l", fmt.Sprintf("notebooks.kubeflow.org/workspace-name=%s", workspaceName),
					"-n", workspaceNamespace,
					"-o", "go-template={{ range .items }}"+
						"{{ if not .metadata.deletionTimestamp }}"+
						"{{ .metadata.name }}"+
						"{{ \"\\n\" }}{{ end }}{{ end }}",
				)
				vsOutput, err := utils.Run(cmd)
				g.Expect(err).NotTo(HaveOccurred())

				// Ensure only 1 virtual service is found
				vsNames := utils.GetNonEmptyLines(vsOutput)
				g.Expect(vsNames).To(HaveLen(1), "expected 1 virtual service found")
				workspaceVirtualServiceName = vsNames[0]
				g.Expect(workspaceVirtualServiceName).To(ContainSubstring(fmt.Sprintf("ws-%s", workspaceName)))
			}
			Eventually(verifyWorkspaceVirtualService, timeout, interval).Should(Succeed())

			By("ensuring in-use imageConfig values cannot be removed from WorkspaceKind")
			removeInUseImageConfig := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", workspaceKindName,
					"--type=json", "-p", `[{"op": "remove", "path": "/spec/podTemplate/options/imageConfig/values/1"}]`)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(removeInUseImageConfig, timeout, interval).ShouldNot(Succeed())

			By("ensuring unused imageConfig values can be removed from WorkspaceKind")
			removeUnusedImageConfig := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", workspaceKindName,
					"--type=json", "-p", `[{"op": "remove", "path": "/spec/podTemplate/options/imageConfig/values/0"}]`)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(removeUnusedImageConfig, timeout, interval).Should(Succeed())

			By("ensuring in-use podConfig values cannot be removed from WorkspaceKind")
			removeInUsePodConfig := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", workspaceKindName,
					"--type=json", "-p", `[{"op": "remove", "path": "/spec/podTemplate/options/podConfig/values/0"}]`)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(removeInUsePodConfig, timeout, interval).ShouldNot(Succeed())

			By("ensuring unused podConfig values can be removed from WorkspaceKind")
			removeUnusedPodConfig := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", workspaceKindName,
					"--type=json", "-p", `[{"op": "remove", "path": "/spec/podTemplate/options/podConfig/values/1"}]`)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(removeUnusedPodConfig, timeout, interval).Should(Succeed())

			By("failing to delete an in-use WorkspaceKind")
			deleteInUseWorkspaceKind := func() error {
				cmd := exec.Command("kubectl", "delete", "workspacekind", workspaceKindName)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(deleteInUseWorkspaceKind, timeout, interval).ShouldNot(Succeed())

			By("deleting a Workspace")
			deleteWorkspace := func() error {
				cmd := exec.Command("kubectl", "delete", "workspace", workspaceName, "-n", workspaceNamespace)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(deleteWorkspace, timeout, interval).Should(Succeed())

			By("deleting an unused WorkspaceKind")
			deleteWorkspaceKind := func() error {
				cmd := exec.Command("kubectl", "delete", "workspacekind", workspaceKindName)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(deleteWorkspaceKind, timeout, interval).Should(Succeed())
		})
	})

	Context("Activity Rules", func() {

		AfterAll(func() {
			By("deleting the activity Workspace")
			cmd := exec.Command("kubectl", "delete", "workspace", activityWorkspaceName,
				"-n", workspaceNamespace, "--ignore-not-found=true", "--wait",
				fmt.Sprintf("--timeout=%s", timeout),
			)
			_, _ = utils.Run(cmd)

			By("deleting the activity WorkspaceKind")
			cmd = exec.Command("kubectl", "delete", "workspacekind", activityWorkspaceKindName,
				"--ignore-not-found=true",
			)
			_, _ = utils.Run(cmd)

			By("deleting the exemption Workspace")
			cmd = exec.Command("kubectl", "delete", "workspace", exemptionWorkspaceName,
				"-n", workspaceNamespace, "--ignore-not-found=true", "--wait",
				fmt.Sprintf("--timeout=%s", timeout),
			)
			_, _ = utils.Run(cmd)

			By("deleting the exemption WorkspaceKind")
			cmd = exec.Command("kubectl", "delete", "workspacekind", exemptionWorkspaceKindName,
				"--ignore-not-found=true",
			)
			_, _ = utils.Run(cmd)

			By("deleting the failing probe Workspace")
			cmd = exec.Command("kubectl", "delete", "workspace", failingProbeWorkspaceName,
				"-n", workspaceNamespace, "--ignore-not-found=true", "--wait",
				fmt.Sprintf("--timeout=%s", timeout),
			)
			_, _ = utils.Run(cmd)

			By("deleting the failing probe WorkspaceKind")
			cmd = exec.Command("kubectl", "delete", "workspacekind", failingProbeWorkspaceKindName,
				"--ignore-not-found=true",
			)
			_, _ = utils.Run(cmd)

			By("deleting the stale activity Workspace")
			cmd = exec.Command("kubectl", "delete", "workspace", staleWorkspaceName,
				"-n", workspaceNamespace, "--ignore-not-found=true", "--wait",
				fmt.Sprintf("--timeout=%s", timeout),
			)
			_, _ = utils.Run(cmd)

			By("deleting the stale activity WorkspaceKind")
			cmd = exec.Command("kubectl", "delete", "workspacekind", staleWorkspaceKindName,
				"--ignore-not-found=true",
			)
			_, _ = utils.Run(cmd)
		})

		It("should automatically pause an inactive Workspace", func() {

			By("creating an activity-rules-enabled WorkspaceKind (podExec probe reporting inactivity)")
			// derive a dedicated WorkspaceKind from the sample so we get valid imageConfig/podConfig/ports,
			// then override its name so it does not clash with the sample used by the Operator context
			activityWorkspaceKindYAML, err := utils.RenderActivityWorkspaceKind(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				activityWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyActivityWorkspaceKind := func() error {
				cmd := exec.Command("kubectl", "apply", "-f", "-")
				cmd.Stdin = strings.NewReader(activityWorkspaceKindYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyActivityWorkspaceKind, timeout, interval).Should(Succeed())

			By("overriding the activityProbe with a fast podExec probe reporting inactivity")
			// - minProbeIntervalSeconds/probeIntervalSeconds are set low so the probe runs quickly
			// - the podExec script reports an old last_activity, making the
			//   Workspace eligible for pause as soon as the first probe succeeds
			// NOTE: the script JSON is escaped twice: once for the shell/JSON output, once for the patch body
			const inactiveProbeScript = `#!/usr/bin/env bash\n` +
				`echo '{\"last_activity\": \"2000-01-01T00:00:00Z\"}' > \"$OUTPUT_JSON_PATH\"\nexit 0\n`
			probePatch := `[` +
				`{"op":"replace","path":"/spec/podTemplate/activityProbe","value":{` +
				`"minProbeIntervalSeconds":1,` +
				`"probeIntervalSeconds":10,` +
				`"podExec":{"timeoutSeconds":30,"script":"` + inactiveProbeScript + `"}` +
				`}}]`
			patchProbe := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", activityWorkspaceKindName,
					"--type=json", "-p", probePatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchProbe, timeout, interval).Should(Succeed())

			By("overriding the activityRules with a single fast catch-all pause rule")
			// - secondsSinceActive=16 is the minimum allowed by the CRD validation
			// - minRunningSeconds=60 ensures the Workspace stays Running long enough for the
			//   test to observe its Running state and status before pausing triggers
			// - an empty match makes this a catch-all rule that applies to all Workspaces
			rulesPatch := `[` +
				`{"op":"replace","path":"/spec/activityRules","value":[` +
				`{"config":{"secondsSinceActive":16,"minRunningSeconds":60},"match":{},"effect":{"pauseWorkspace":true}}` +
				`]}]`
			patchRules := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", activityWorkspaceKindName,
					"--type=json", "-p", rulesPatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchRules, timeout, interval).Should(Succeed())

			By("creating a Workspace of the activity WorkspaceKind")
			activityWorkspaceYAML, err := utils.RenderActivityWorkspace(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml"),
				activityWorkspaceName,
				activityWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyActivityWorkspace := func() error {
				cmd := exec.Command("kubectl", "apply", "-n", workspaceNamespace, "-f", "-")
				cmd.Stdin = strings.NewReader(activityWorkspaceYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyActivityWorkspace, timeout, interval).Should(Succeed())

			By("waiting for the activity Workspace to reach 'Running' state")
			verifyRunning := func(g Gomega) error {
				statusState, err := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, "{.status.state}")
				g.Expect(err).NotTo(HaveOccurred())
				if statusState != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					return fmt.Errorf("workspace not running yet, current state: %q", statusState)
				}
				return nil
			}
			Eventually(verifyRunning, timeout, interval).Should(Succeed())

			By("validating that the activity probe runs successfully and updates status")
			const (
				probeResultPath    = "{.status.activity.lastProbe.result}"
				probeMessagePath   = "{.status.activity.lastProbe.message}"
				probeStartTimePath = "{.status.activity.lastProbe.startTime}"
				eligiblePath       = "{.status.activity.rules.pauseWorkspace.eligibleAfter}"
			)
			verifyProbeRan := func(g Gomega) error {
				probeResult, err := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, probeResultPath)
				g.Expect(err).NotTo(HaveOccurred())
				if probeResult != string(kubefloworgv1beta1.WorkspaceProbeResultSuccess) {
					// surface the probe message to aid debugging
					msg, _ := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, probeMessagePath)
					return fmt.Errorf("probe result is %q (not Success), message: %q", probeResult, msg)
				}
				return nil
			}
			Eventually(verifyProbeRan, activityTimeout, interval).Should(Succeed())

			By("verifying that the activity probe does not re-fire too frequently before probeIntervalSeconds")
			initialProbeStartTime, err := utils.GetWorkspaceJSONPath(
				activityWorkspaceName, workspaceNamespace, probeStartTimePath)
			Expect(err).NotTo(HaveOccurred())
			Expect(initialProbeStartTime).NotTo(BeEmpty())

			// probeIntervalSeconds is set to 10s for this test. We verify for 5s (shorter than probeIntervalSeconds)
			// that the probe startTime remains unchanged, confirming no overly frequent re-probing occurs.
			verifyNoFrequentProbing := func(g Gomega) {
				currentProbeStartTime, err := utils.GetWorkspaceJSONPath(
					activityWorkspaceName, workspaceNamespace, probeStartTimePath)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(currentProbeStartTime).To(
					Equal(initialProbeStartTime), "probe re-fired earlier than probeIntervalSeconds!")
			}
			Consistently(verifyNoFrequentProbing, 5*time.Second, interval).Should(Succeed())

			By("validating that the eligibleAfter time is populated")
			verifyEligibleAfter := func(g Gomega) error {
				eligibleAfter, err := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, eligiblePath)
				g.Expect(err).NotTo(HaveOccurred())
				if eligibleAfter == "" || eligibleAfter == "0" {
					return fmt.Errorf("eligibleAfter not populated yet, got: %q", eligibleAfter)
				}
				return nil
			}
			Eventually(verifyEligibleAfter, activityTimeout, interval).Should(Succeed())

			By("validating that the Workspace is automatically paused due to inactivity")
			verifyPaused := func(g Gomega) error {
				paused, err := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, "{.spec.paused}")
				g.Expect(err).NotTo(HaveOccurred())
				if paused != "true" {
					return fmt.Errorf("workspace not paused yet, spec.paused=%q", paused)
				}
				return nil
			}
			Eventually(verifyPaused, activityTimeout, interval).Should(Succeed())

			By("validating that the Workspace reaches the 'Paused' state")
			verifyPausedState := func(g Gomega) error {
				statusState, err := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, "{.status.state}")
				g.Expect(err).NotTo(HaveOccurred())
				if statusState != string(kubefloworgv1beta1.WorkspaceStatePaused) {
					return fmt.Errorf("workspace not in Paused state yet, current state: %q", statusState)
				}
				return nil
			}
			Eventually(verifyPausedState, activityTimeout, interval).Should(Succeed())

			By("unpausing/restarting the paused Workspace")
			unpauseWorkspace := func() error {
				cmd := exec.Command("kubectl", "patch", "workspace", activityWorkspaceName,
					"-n", workspaceNamespace, "--type=merge", "-p", `{"spec":{"paused":false}}`)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(unpauseWorkspace, timeout, interval).Should(Succeed())

			By("waiting for the restarted Workspace to reach 'Running' state again")
			Eventually(verifyRunning, timeout, interval).Should(Succeed())

			By("verifying that the restarted Workspace stays Running and is not immediately paused")
			verifyStaysRunning := func(g Gomega) error {
				paused, err := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, "{.spec.paused}")
				g.Expect(err).NotTo(HaveOccurred())
				if paused == "true" {
					return fmt.Errorf("workspace was immediately paused after restart")
				}
				statusState, err := utils.GetWorkspaceJSONPath(activityWorkspaceName, workspaceNamespace, "{.status.state}")
				g.Expect(err).NotTo(HaveOccurred())
				if statusState != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					return fmt.Errorf("workspace state is %q, expected Running", statusState)
				}
				return nil
			}
			Consistently(verifyStaysRunning, 10*time.Second, interval).Should(Succeed())
		})

		It("should NOT pause a Workspace that matches an exemption rule (pauseWorkspace: false)", func() {

			By("creating an activity-rules-enabled WorkspaceKind with an exemption rule matching namespace labels")
			// derive a dedicated WorkspaceKind from the sample
			exemptionWorkspaceKindYAML, err := utils.RenderActivityWorkspaceKind(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				exemptionWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyExemptionWorkspaceKind := func() error {
				cmd := exec.Command("kubectl", "apply", "-f", "-")
				cmd.Stdin = strings.NewReader(exemptionWorkspaceKindYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyExemptionWorkspaceKind, timeout, interval).Should(Succeed())

			By("overriding the activityProbe with a fast podExec probe reporting inactivity")
			const inactiveProbeScript = `#!/usr/bin/env bash\n` +
				`echo '{\"last_activity\": \"2000-01-01T00:00:00Z\"}' > \"$OUTPUT_JSON_PATH\"\nexit 0\n`
			probePatch := `[` +
				`{"op":"replace","path":"/spec/podTemplate/activityProbe","value":{` +
				`"minProbeIntervalSeconds":1,` +
				`"probeIntervalSeconds":10,` +
				`"podExec":{"timeoutSeconds":30,"script":"` + inactiveProbeScript + `"}` +
				`}}]`
			patchProbe := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", exemptionWorkspaceKindName,
					"--type=json", "-p", probePatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchProbe, timeout, interval).Should(Succeed())

			By("overriding the activityRules with an exemption rule followed by a catch-all pause rule")
			// - first rule: matches namespace label "exempt: true" and has pauseWorkspace: false
			// - second rule: catch-all with pauseWorkspace: true
			rulesPatch := `[` +
				`{"op":"replace","path":"/spec/activityRules","value":[` +
				`{"config":{"secondsSinceActive":16},"match":{"matchNamespace":` +
				`{"selector":{"matchLabels":{"exempt":"true"}}}},"effect":{"pauseWorkspace":false}},` +
				`{"config":{"secondsSinceActive":16},"match":{},"effect":{"pauseWorkspace":true}}` +
				`]}]`
			patchRules := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", exemptionWorkspaceKindName,
					"--type=json", "-p", rulesPatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchRules, timeout, interval).Should(Succeed())

			By("labeling the test namespace for exemption")
			labelNamespace := func() error {
				cmd := exec.Command("kubectl", "label", "ns", workspaceNamespace, "exempt=true", "--overwrite")
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(labelNamespace, timeout, interval).Should(Succeed())

			By("creating a Workspace of the exemption WorkspaceKind")
			exemptionWorkspaceYAML, err := utils.RenderActivityWorkspace(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml"),
				exemptionWorkspaceName,
				exemptionWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyExemptionWorkspace := func() error {
				cmd := exec.Command("kubectl", "apply", "-n", workspaceNamespace, "-f", "-")
				cmd.Stdin = strings.NewReader(exemptionWorkspaceYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyExemptionWorkspace, timeout, interval).Should(Succeed())

			By("waiting for the exemption Workspace to reach 'Running' state")
			verifyRunning := func(g Gomega) error {
				statusState, err := utils.GetWorkspaceJSONPath(exemptionWorkspaceName, workspaceNamespace, "{.status.state}")
				g.Expect(err).NotTo(HaveOccurred())
				if statusState != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					return fmt.Errorf("workspace not running yet, current state: %q", statusState)
				}
				return nil
			}
			Eventually(verifyRunning, timeout, interval).Should(Succeed())

			By("validating that the activity probe runs successfully and updates status")
			verifyProbeRan := func(g Gomega) error {
				probeResult, err := utils.GetWorkspaceJSONPath(
					exemptionWorkspaceName, workspaceNamespace, "{.status.activity.lastProbe.result}")
				g.Expect(err).NotTo(HaveOccurred())
				if probeResult != string(kubefloworgv1beta1.WorkspaceProbeResultSuccess) {
					return fmt.Errorf("probe result is %q (not Success)", probeResult)
				}
				return nil
			}
			Eventually(verifyProbeRan, activityTimeout, interval).Should(Succeed())

			By("validating that the eligibleAfter time is NOT populated (showing the exemption rule matched and opted out)")
			verifyEligibleNotSet := func(g Gomega) error {
				eligibleAfter, err := utils.GetWorkspaceJSONPath(
					exemptionWorkspaceName, workspaceNamespace, "{.status.activity.rules.pauseWorkspace.eligibleAfter}")
				g.Expect(err).NotTo(HaveOccurred())
				if eligibleAfter != "" && eligibleAfter != "0" {
					return fmt.Errorf("eligibleAfter should not be populated for exempted workspace, got: %q", eligibleAfter)
				}
				return nil
			}
			Eventually(verifyEligibleNotSet, activityTimeout, interval).Should(Succeed())

			By("verifying that the Workspace is NOT paused even after its hypothetical eligibility time")
			// we use Consistently to ensure it stays unpaused for a short duration
			checkNotPaused := func(g Gomega) {
				paused, err := utils.GetWorkspaceJSONPath(exemptionWorkspaceName, workspaceNamespace, "{.spec.paused}")
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(paused).To(SatisfyAny(BeEmpty(), Equal("false")), "workspace should not be paused")
			}
			// Wait a bit first to ensure we are past the eligibility time (16s + buffers)
			time.Sleep(20 * time.Second)
			Consistently(checkNotPaused, 30*time.Second, 5*time.Second).Should(Succeed())

			By("cleaning up the exemption workspace labels")
			unlabelNamespace := func() error {
				cmd := exec.Command("kubectl", "label", "ns", workspaceNamespace, "exempt-")
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(unlabelNamespace, timeout, interval).Should(Succeed())
		})

		It("should NOT pause a Workspace when the activity probe fails", func() {

			By("creating a WorkspaceKind with a failing podExec activity probe")
			failingWorkspaceKindYAML, err := utils.RenderActivityWorkspaceKind(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				failingProbeWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyFailingWorkspaceKind := func() error {
				cmd := exec.Command("kubectl", "apply", "-f", "-")
				cmd.Stdin = strings.NewReader(failingWorkspaceKindYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyFailingWorkspaceKind, timeout, interval).Should(Succeed())

			By("overriding the activityProbe with a failing podExec probe")
			const failingProbeScript = `#!/usr/bin/env bash\nexit 1\n`
			probePatch := `[` +
				`{"op":"replace","path":"/spec/podTemplate/activityProbe","value":{` +
				`"minProbeIntervalSeconds":1,` +
				`"probeIntervalSeconds":10,` +
				`"podExec":{"timeoutSeconds":30,"script":"` + failingProbeScript + `"}` +
				`}}]`
			patchProbe := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", failingProbeWorkspaceKindName,
					"--type=json", "-p", probePatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchProbe, timeout, interval).Should(Succeed())

			By("overriding the activityRules with a single fast catch-all pause rule")
			rulesPatch := `[` +
				`{"op":"replace","path":"/spec/activityRules","value":[` +
				`{"config":{"secondsSinceActive":16,"minRunningSeconds":0},"match":{},"effect":{"pauseWorkspace":true}}` +
				`]}]`
			patchRules := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", failingProbeWorkspaceKindName,
					"--type=json", "-p", rulesPatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchRules, timeout, interval).Should(Succeed())

			By("creating a Workspace of the failing probe WorkspaceKind")
			failingWorkspaceYAML, err := utils.RenderActivityWorkspace(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml"),
				failingProbeWorkspaceName,
				failingProbeWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyFailingWorkspace := func() error {
				cmd := exec.Command("kubectl", "apply", "-n", workspaceNamespace, "-f", "-")
				cmd.Stdin = strings.NewReader(failingWorkspaceYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyFailingWorkspace, timeout, interval).Should(Succeed())

			By("waiting for the Workspace to reach 'Running' state")
			verifyRunning := func(g Gomega) error {
				statusState, err := utils.GetWorkspaceJSONPath(failingProbeWorkspaceName, workspaceNamespace, "{.status.state}")
				g.Expect(err).NotTo(HaveOccurred())
				if statusState != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					return fmt.Errorf("workspace not running yet, current state: %q", statusState)
				}
				return nil
			}
			Eventually(verifyRunning, timeout, interval).Should(Succeed())

			By("validating that the activity probe runs and records a Failure result")
			verifyProbeFailed := func(g Gomega) error {
				probeResult, err := utils.GetWorkspaceJSONPath(
					failingProbeWorkspaceName, workspaceNamespace, "{.status.activity.lastProbe.result}")
				g.Expect(err).NotTo(HaveOccurred())
				if probeResult != string(kubefloworgv1beta1.WorkspaceProbeResultFailure) {
					return fmt.Errorf("probe result is %q, expected Failure", probeResult)
				}
				return nil
			}
			Eventually(verifyProbeFailed, activityTimeout, interval).Should(Succeed())

			By("verifying that the Workspace is NOT paused, because a failing probe does not trigger pause")
			checkNotPaused := func(g Gomega) {
				paused, err := utils.GetWorkspaceJSONPath(failingProbeWorkspaceName, workspaceNamespace, "{.spec.paused}")
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(paused).To(SatisfyAny(BeEmpty(), Equal("false")), "workspace should not be paused when probe fails")
			}
			Consistently(checkNotPaused, 15*time.Second, interval).Should(Succeed())
		})

		It("should NOT pause a Workspace when eligibleAfter arrives before the next probe is due", func() {

			By("creating a WorkspaceKind with probeInterval=30s and minRunningSeconds=15s")
			staleWorkspaceKindYAML, err := utils.RenderActivityWorkspaceKind(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				staleWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyStaleWorkspaceKind := func() error {
				cmd := exec.Command("kubectl", "apply", "-f", "-")
				cmd.Stdin = strings.NewReader(staleWorkspaceKindYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyStaleWorkspaceKind, timeout, interval).Should(Succeed())

			By("overriding the activityProbe with inactivity script and 30s probeInterval")
			const inactiveProbeScript = `#!/usr/bin/env bash\n` +
				`echo '{\"last_activity\": \"2000-01-01T00:00:00Z\"}' > \"$OUTPUT_JSON_PATH\"\nexit 0\n`
			probePatch := `[` +
				`{"op":"replace","path":"/spec/podTemplate/activityProbe","value":{` +
				`"minProbeIntervalSeconds":1,` +
				`"probeIntervalSeconds":30,` +
				`"podExec":{"timeoutSeconds":30,"script":"` + inactiveProbeScript + `"}` +
				`}}]`
			patchProbe := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", staleWorkspaceKindName,
					"--type=json", "-p", probePatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchProbe, timeout, interval).Should(Succeed())

			By("overriding activityRules with secondsSinceActive=16 and minRunningSeconds=15")
			rulesPatch := `[` +
				`{"op":"replace","path":"/spec/activityRules","value":[` +
				`{"config":{"secondsSinceActive":16,"minRunningSeconds":15},"match":{},"effect":{"pauseWorkspace":true}}` +
				`]}]`
			patchRules := func() error {
				cmd := exec.Command("kubectl", "patch", "workspacekind", staleWorkspaceKindName,
					"--type=json", "-p", rulesPatch)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchRules, timeout, interval).Should(Succeed())

			By("creating a Workspace of the stale activity WorkspaceKind")
			staleWorkspaceYAML, err := utils.RenderActivityWorkspace(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml"),
				staleWorkspaceName,
				staleWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyStaleWorkspace := func() error {
				cmd := exec.Command("kubectl", "apply", "-n", workspaceNamespace, "-f", "-")
				cmd.Stdin = strings.NewReader(staleWorkspaceYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyStaleWorkspace, timeout, interval).Should(Succeed())

			By("waiting for the Workspace to reach 'Running' state")
			verifyRunning := func(g Gomega) error {
				statusState, err := utils.GetWorkspaceJSONPath(staleWorkspaceName, workspaceNamespace, "{.status.state}")
				g.Expect(err).NotTo(HaveOccurred())
				if statusState != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					return fmt.Errorf("workspace not running yet, current state: %q", statusState)
				}
				return nil
			}
			Eventually(verifyRunning, timeout, interval).Should(Succeed())

			By("validating that the initial probe runs and populates eligibleAfter based on stale inactivity")
			const staleEligibleAfter = "946684816000" // 2000-01-01T00:00:00Z + 16s
			verifyEligiblePopulated := func(g Gomega) error {
				eligibleAfterStr, err := utils.GetWorkspaceJSONPath(
					staleWorkspaceName, workspaceNamespace, "{.status.activity.rules.pauseWorkspace.eligibleAfter}")
				g.Expect(err).NotTo(HaveOccurred())
				if eligibleAfterStr != staleEligibleAfter {
					return fmt.Errorf("eligibleAfter is %q, expected %q", eligibleAfterStr, staleEligibleAfter)
				}
				return nil
			}
			Eventually(verifyEligiblePopulated, activityTimeout, interval).Should(Succeed())

			By("triggering intermediate reconciles after minRunningSeconds (15s) " +
				"has passed but before the next probe (30s) is due")
			time.Sleep(18 * time.Second)
			patchAnnotation := func() error {
				cmd := exec.Command("kubectl", "annotate", "workspace", staleWorkspaceName,
					"-n", workspaceNamespace, fmt.Sprintf("test.reconcile=%d", time.Now().UnixNano()), "--overwrite")
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(patchAnnotation, timeout, interval).Should(Succeed())

			By("verifying that the Workspace is NOT paused at eligibleAfter because a fresh probe has not run yet")
			checkNotPausedYet := func(g Gomega) {
				paused, err := utils.GetWorkspaceJSONPath(staleWorkspaceName, workspaceNamespace, "{.spec.paused}")
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(paused).To(SatisfyAny(BeEmpty(), Equal("false")), "workspace should not be paused before fresh probe runs")

				eligibleAfterStr, err := utils.GetWorkspaceJSONPath(
					staleWorkspaceName, workspaceNamespace, "{.status.activity.rules.pauseWorkspace.eligibleAfter}")
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(eligibleAfterStr).To(Equal(staleEligibleAfter), "eligibleAfter should be preserved during !due reconciles")

				eligibleAfter, err := strconv.ParseInt(eligibleAfterStr, 10, 64)
				g.Expect(err).NotTo(HaveOccurred())
				g.Expect(time.Now().UnixMilli()).To(BeNumerically(">", eligibleAfter), "current time should be past eligibleAfter")
			}
			Consistently(checkNotPausedYet, 5*time.Second, interval).Should(Succeed())

			By("waiting for the fresh probe (at ~30s) to run and confirm inactivity, which triggers pausing")
			verifyPaused := func(g Gomega) error {
				paused, err := utils.GetWorkspaceJSONPath(staleWorkspaceName, workspaceNamespace, "{.spec.paused}")
				g.Expect(err).NotTo(HaveOccurred())
				if paused != "true" {
					return fmt.Errorf("workspace not paused yet, spec.paused=%q", paused)
				}
				return nil
			}
			Eventually(verifyPaused, activityTimeout, interval).Should(Succeed())
		})
	})

	Context("Activity Probes", func() {

		AfterAll(func() {
			By("deleting the probe Workspace")
			cmd := exec.Command("kubectl", "delete", "workspace", probeWorkspaceName,
				"-n", workspaceNamespace, "--ignore-not-found=true", "--wait",
				fmt.Sprintf("--timeout=%s", timeout),
			)
			_, _ = utils.Run(cmd)

			By("deleting the probe WorkspaceKind")
			cmd = exec.Command("kubectl", "delete", "workspacekind", probeWorkspaceKindName,
				"--ignore-not-found=true",
			)
			_, _ = utils.Run(cmd)
		})

		It("should update activity status using Jupyter probe", func() {
			By("creating a WorkspaceKind with short Jupyter probe intervals")
			// We use a very short probe interval to verify the status updates quickly.
			kindYAML, err := utils.RenderActivityWorkspaceKind(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				probeWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			// Patch the intervals to be very short for the test
			kindYAML = strings.Replace(kindYAML, "minProbeIntervalSeconds: 300", "minProbeIntervalSeconds: 5", 1)
			kindYAML = strings.Replace(kindYAML, "probeIntervalSeconds: 3600", "probeIntervalSeconds: 10", 1)

			applyKind := func() error {
				cmd := exec.Command("kubectl", "apply", "-f", "-")
				cmd.Stdin = strings.NewReader(kindYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyKind, timeout, interval).Should(Succeed())

			By("creating a Workspace using the Jupyter probe WorkspaceKind")
			workspaceYAML, err := utils.RenderActivityWorkspace(
				filepath.Join(projectDir, "manifests/kustomize/samples/jupyterlab_v1beta1_workspace.yaml"),
				probeWorkspaceName,
				probeWorkspaceKindName,
			)
			Expect(err).NotTo(HaveOccurred())

			applyWorkspace := func() error {
				cmd := exec.Command("kubectl", "apply", "-f", "-", "-n", workspaceNamespace)
				cmd.Stdin = strings.NewReader(workspaceYAML)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(applyWorkspace, timeout, interval).Should(Succeed())

			By("waiting for the workspace to be Running")
			verifyRunning := func(g Gomega) error {
				statusState, err := utils.GetWorkspaceJSONPath(probeWorkspaceName, workspaceNamespace, "{.status.state}")
				g.Expect(err).NotTo(HaveOccurred())
				if statusState != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					return fmt.Errorf("workspace not Running yet, state=%q", statusState)
				}
				return nil
			}
			Eventually(verifyRunning, timeout, interval).Should(Succeed())

			By("verifying that lastProbe and lastActivity are updated")
			verifyActivityUpdated := func(g Gomega) error {
				lastProbeResult, err := utils.GetWorkspaceJSONPath(
					probeWorkspaceName, workspaceNamespace, "{.status.activity.lastProbe.result}")
				g.Expect(err).NotTo(HaveOccurred())

				if lastProbeResult != string(kubefloworgv1beta1.WorkspaceProbeResultSuccess) {
					lastProbeMessage, _ := utils.GetWorkspaceJSONPath(
						probeWorkspaceName, workspaceNamespace, "{.status.activity.lastProbe.message}")
					return fmt.Errorf("last probe not successful yet, result=%q, message=%q", lastProbeResult, lastProbeMessage)
				}

				lastActivity, err := utils.GetWorkspaceJSONPath(
					probeWorkspaceName, workspaceNamespace, "{.status.activity.lastActivity}")
				g.Expect(err).NotTo(HaveOccurred())
				if lastActivity == "" || lastActivity == "0" {
					return fmt.Errorf("lastActivity not updated yet")
				}

				return nil
			}
			// It might take a few seconds for the first probe to run after reaching Running state
			Eventually(verifyActivityUpdated, time.Minute, interval).Should(Succeed())
		})
	})
})
