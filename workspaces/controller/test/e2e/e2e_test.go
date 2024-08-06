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

	// curl image
	curlImage = "curlimages/curl:8.9.1"

	// how long to wait in "Eventually" blocks
	timeout = time.Second * 60

	// how long to wait in "Consistently" blocks
	duration = time.Second * 10

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
		_, _ = utils.Run(cmd)

		By("creating the workspace namespace")
		cmd = exec.Command("kubectl", "create", "ns", workspaceNamespace)
		_, _ = utils.Run(cmd)

		By("creating common workspace resources")
		cmd = exec.Command("kubectl", "apply",
			"-k", filepath.Join(projectDir, "config/samples/common"),
			"-n", workspaceNamespace,
		)
		_, _ = utils.Run(cmd)
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

		By("deleting the controller")
		cmd = exec.Command("make", "undeploy")
		_, _ = utils.Run(cmd)

		By("deleting CRDs")
		cmd = exec.Command("make", "uninstall")
		_, _ = utils.Run(cmd)
	})

	Context("Operator", func() {

		It("should run successfully", func() {
			var controllerPodName string
			var err error

			By("building the controller image")
			cmd := exec.Command("make", "docker-build", fmt.Sprintf("IMG=%s", controllerImage))
			_, err = utils.Run(cmd)
			ExpectWithOffset(1, err).NotTo(HaveOccurred())

			By("loading the controller image on Kind")
			err = utils.LoadImageToKindClusterWithName(controllerImage)
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
			verifyControllerUp := func() error {
				// Get controller pod name
				cmd = exec.Command("kubectl", "get", "pods",
					"-l", "control-plane=controller-manager",
					"-n", controllerNamespace,
					"-o", "go-template={{ range .items }}"+
						"{{ if not .metadata.deletionTimestamp }}"+
						"{{ .metadata.name }}"+
						"{{ \"\\n\" }}{{ end }}{{ end }}",
				)
				podOutput, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())

				// Ensure only 1 controller pod is running
				podNames := utils.GetNonEmptyLines(string(podOutput))
				if len(podNames) != 1 {
					return fmt.Errorf("expect 1 controller pods running, but got %d", len(podNames))
				}
				controllerPodName = podNames[0]
				ExpectWithOffset(2, controllerPodName).Should(ContainSubstring("controller-manager"))

				// Validate controller pod status
				cmd = exec.Command("kubectl", "get", "pods",
					controllerPodName,
					"-n", controllerNamespace,
					"-o", "jsonpath={.status.phase}",
				)
				statusPhase, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())
				if string(statusPhase) != string(corev1.PodRunning) {
					return fmt.Errorf("controller pod in %s phase", statusPhase)
				}
				return nil
			}
			EventuallyWithOffset(1, verifyControllerUp, timeout, interval).Should(Succeed())

			By("creating an instance of the WorkspaceKind CR")
			EventuallyWithOffset(1, func() error {
				cmd = exec.Command("kubectl", "apply",
					"-f", filepath.Join(projectDir, "config/samples/jupyterlab_v1beta1_workspacekind.yaml"),
				)
				_, err = utils.Run(cmd)
				return err
			}, timeout, interval).Should(Succeed())

			By("creating an instance of the Workspace CR")
			EventuallyWithOffset(1, func() error {
				cmd = exec.Command("kubectl", "apply",
					"-f", filepath.Join(projectDir, "config/samples/jupyterlab_v1beta1_workspace.yaml"),
					"-n", workspaceNamespace,
				)
				_, err = utils.Run(cmd)
				return err
			}, timeout, interval).Should(Succeed())

			By("validating that the workspace has 'Running' state")
			verifyWorkspaceState := func() error {
				cmd = exec.Command("kubectl", "get", "workspaces",
					workspaceName,
					"-n", workspaceNamespace,
					"-o", "jsonpath={.status.state}",
				)
				statusState, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())

				// If the workspace is not in the "Running" state get the state message
				if string(statusState) != string(kubefloworgv1beta1.WorkspaceStateRunning) {
					cmd = exec.Command("kubectl", "get", "workspaces",
						workspaceName,
						"-n", workspaceNamespace,
						"-o", "jsonpath={.status.stateMessage}",
					)
					statusStateMessage, err := utils.Run(cmd)
					ExpectWithOffset(2, err).NotTo(HaveOccurred())
					return fmt.Errorf("workspace in %s state with message: %s", statusState, statusStateMessage)
				}
				return nil
			}
			EventuallyWithOffset(1, verifyWorkspaceState, timeout, interval).Should(Succeed())

			By("validating that the workspace pod is running as expected")
			verifyWorkspacePod := func() error {
				// Get workspace pod name
				cmd = exec.Command("kubectl", "get", "pods",
					"-l", fmt.Sprintf("notebooks.kubeflow.org/workspace-name=%s", workspaceName),
					"-n", workspaceNamespace,
					"-o", "go-template={{ range .items }}"+
						"{{ if not .metadata.deletionTimestamp }}"+
						"{{ .metadata.name }}"+
						"{{ \"\\n\" }}{{ end }}{{ end }}",
				)
				podOutput, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())

				// Ensure only 1 workspace pod is running
				podNames := utils.GetNonEmptyLines(string(podOutput))
				if len(podNames) != 1 {
					return fmt.Errorf("expect 1 workspace pod running, but got %d", len(podNames))
				}
				workspacePodName := podNames[0]
				ExpectWithOffset(2, workspacePodName).Should(ContainSubstring(fmt.Sprintf("ws-%s", workspaceName)))

				// Validate workspace pod status
				cmd = exec.Command("kubectl", "get", "pods",
					workspacePodName,
					"-n", workspaceNamespace,
					"-o", "jsonpath={.status.phase}",
				)
				statusPhase, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())
				if string(statusPhase) != string(corev1.PodRunning) {
					return fmt.Errorf("workspace pod in %s phase", statusPhase)
				}
				return nil
			}
			EventuallyWithOffset(1, verifyWorkspacePod, timeout, interval).Should(Succeed())

			By("validating that the workspace service was created")
			getServiceName := func() (string, error) {
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
				ExpectWithOffset(2, err).NotTo(HaveOccurred())

				// Ensure only 1 service is found
				svcNames := utils.GetNonEmptyLines(string(svcOutput))
				if len(svcNames) != 1 {
					return "", fmt.Errorf("expect 1 service found, but got %d", len(svcNames))
				}
				workspaceSvcName := svcNames[0]
				ExpectWithOffset(2, workspaceSvcName).Should(ContainSubstring(fmt.Sprintf("ws-%s", workspaceName)))

				return workspaceSvcName, nil
			}
			serviceName, err := getServiceName()
			ExpectWithOffset(1, err).NotTo(HaveOccurred())

			By("validating that the workspace service endpoint is reachable")
			serviceEndpoint := fmt.Sprintf("http://%s:%d/workspace/%s/%s/%s/lab",
				serviceName, workspacePortInt, workspaceNamespace, workspaceName, workspacePortId,
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
		})
	})
})
