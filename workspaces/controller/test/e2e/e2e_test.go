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
	"time"

	"github.com/kubeflow/notebooks/workspaces/controller/test/utils"

	corev1 "k8s.io/api/core/v1"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
)

const (
	// controller configs
	controllerNamespace = "workspace-controller-system"
	controllerImage     = "ghcr.io/kubeflow/notebooks/workspace-controller:latest"

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
	timeout = time.Second * 60

	// how long to wait in "Consistently" blocks
	duration = time.Second * 10 //nolint:unused

	// how frequently to poll for conditions
	interval = time.Second * 1
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

		By("creating common workspace resources")
		cmd = exec.Command("kubectl", "apply",
			"-k", filepath.Join(projectDir, "config/samples/common"),
			"-n", workspaceNamespace,
		)
		_, err := utils.Run(cmd)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		By("installing CRDs")
		cmd = exec.Command("make", "install")
		_, err = utils.Run(cmd)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		By("deploying the controller-manager")
		cmd = exec.Command("make", "deploy", fmt.Sprintf("IMG=%s", controllerImage))
		_, err = utils.Run(cmd)
		ExpectWithOffset(1, err).NotTo(HaveOccurred())

		By("validating that the controller-manager pod is running as expected")
		var controllerPodName string
		verifyControllerUp := func(g Gomega) {
			// Get controller pod name
			cmd := exec.Command("kubectl", "get", "pods",
				"-l", "control-plane=controller-manager",
				"-n", controllerNamespace,
				"-o", "go-template={{ range .items }}"+
					"{{ if not .metadata.deletionTimestamp }}"+
					"{{ .metadata.name }}"+
					"{{ \"\\n\" }}{{ end }}{{ end }}",
			)
			podOutput, err := utils.Run(cmd)
			g.Expect(err).NotTo(HaveOccurred(), "failed to get controller-manager pod")

			// Ensure only 1 controller pod is running
			podNames := utils.GetNonEmptyLines(podOutput)
			g.Expect(podNames).To(HaveLen(1), "expected 1 controller pod running")
			controllerPodName = podNames[0]
			g.Expect(controllerPodName).To(ContainSubstring("controller-manager"))

			// Validate controller pod status
			cmd = exec.Command("kubectl", "get", "pods",
				controllerPodName,
				"-n", controllerNamespace,
				"-o", "jsonpath={.status.phase}",
			)
			statusPhase, err := utils.Run(cmd)
			g.Expect(err).NotTo(HaveOccurred())
			g.Expect(statusPhase).To(BeEquivalentTo(corev1.PodRunning), "Incorrect controller-manager pod phase")
		}
		Eventually(verifyControllerUp, timeout, interval).Should(Succeed())

	})

	AfterAll(func() {
		By("deleting sample Workspace")
		cmd := exec.Command("kubectl", "delete", "-f",
			filepath.Join(projectDir, "config/samples/jupyterlab_v1beta1_workspace.yaml"),
			"-n", workspaceNamespace,
		)
		_, _ = utils.Run(cmd)

		By("deleting sample WorkspaceKind")
		cmd = exec.Command("kubectl", "delete",
			"-f", filepath.Join(projectDir, "config/samples/jupyterlab_v1beta1_workspacekind.yaml"),
		)
		_, _ = utils.Run(cmd)

		By("deleting the controller")
		cmd = exec.Command("make", "undeploy")
		_, _ = utils.Run(cmd)

		By("deleting common workspace resources")
		cmd = exec.Command("kubectl", "delete",
			"-k", filepath.Join(projectDir, "config/samples/common"),
			"-n", workspaceNamespace,
		)
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
					"-f", filepath.Join(projectDir, "config/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(createWorkspaceKindSample, timeout, interval).Should(Succeed())

			By("creating an instance of Workspace")
			createWorkspaceSample := func() error {
				cmd := exec.Command("kubectl", "apply",
					"-f", filepath.Join(projectDir, "config/samples/jupyterlab_v1beta1_workspace.yaml"),
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
			Eventually(verifyWorkspaceState, timeout, interval).Should(Succeed())

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
			serviceEndpoint := fmt.Sprintf("http://%s:%d/workspace/%s/%s/%s/lab",
				workspaceSvcName, workspacePortInt, workspaceNamespace, workspaceName, workspacePortId,
			)
			curlService := func() error {
				// NOTE: this command should exit with a non-zero status code if the HTTP status code is >= 400
				cmd := exec.Command("kubectl", "run",
					"tmp-curl", "-n", workspaceNamespace,
					"--attach", "--command", fmt.Sprintf("--image=%s", curlImage), "--rm", "--restart=Never", "--",
					"curl", "-sSL", "-o", "/dev/null", "--fail-with-body", serviceEndpoint,
				)
				_, err := utils.Run(cmd)
				return err
			}
			Eventually(curlService, timeout, interval).Should(Succeed())

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
})
