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
	"strings"
	"time"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/kubeflow/notebooks/workspaces/controller/test/utils"
)

const namespace = "workspace-controller-system"

var (
	projectDir = ""
)
var _ = Describe("controller", Ordered, func() {
	BeforeAll(func() {
		projectDir, _ = utils.GetProjectDir()

		By("creating manager namespace")
		cmd := exec.Command("kubectl", "create", "ns", namespace)
		_, _ = utils.Run(cmd)

		By("creating service account")
		cmd = exec.Command("kubectl", "create", "sa", "default-editor")
		_, _ = utils.Run(cmd)

		By("creating workspace home pvc")
		cmd = exec.Command("kubectl", "apply", "-f", filepath.Join(projectDir,
			"config/samples/workspace_home_pvc.yaml"))
		_, _ = utils.Run(cmd)

		By("creating workspace data pvc")
		cmd = exec.Command("kubectl", "apply", "-f", filepath.Join(projectDir,
			"config/samples/workspace_data_pvc.yaml"))
		_, _ = utils.Run(cmd)
	})

	AfterAll(func() {
		By("deleting workspace CR")
		cmd := exec.Command("kubectl", "delete", "-f", filepath.Join(projectDir,
			"config/samples/v1beta1_workspace.yaml"))
		_, _ = utils.Run(cmd)

		By("deleting workspaceKind CR")
		cmd = exec.Command("kubectl", "delete", "-f", filepath.Join(projectDir,
			"config/samples/v1beta1_workspacekind.yaml"))
		_, _ = utils.Run(cmd)

		By("deleting manager namespace")
		cmd = exec.Command("kubectl", "delete", "ns", namespace)
		_, _ = utils.Run(cmd)

		By("deleting service account")
		cmd = exec.Command("kubectl", "delete", "sa", "default-editor")
		_, _ = utils.Run(cmd)

		By("deleting workspace home pvc")
		cmd = exec.Command("kubectl", "delete", "-f", filepath.Join(projectDir,
			"config/samples/workspace_home_pvc.yaml"))
		_, _ = utils.Run(cmd)

		By("deleting workspace data pvc")
		cmd = exec.Command("kubectl", "delete", "-f", filepath.Join(projectDir,
			"config/samples/workspace_data_pvc.yaml"))
		_, _ = utils.Run(cmd)

		By("deleting the controller-manager")
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

			// projectimage stores the name of the image used in the example
			var projectimage = "example.com/workspace-controller:v0.0.1"

			By("building the manager(Operator) image")
			cmd := exec.Command("make", "docker-build", fmt.Sprintf("IMG=%s", projectimage))
			_, err = utils.Run(cmd)
			ExpectWithOffset(1, err).NotTo(HaveOccurred())

			By("loading the the manager(Operator) image on Kind")
			err = utils.LoadImageToKindClusterWithName(projectimage)
			ExpectWithOffset(1, err).NotTo(HaveOccurred())

			By("installing CRDs")
			cmd = exec.Command("make", "install")
			_, err = utils.Run(cmd)
			ExpectWithOffset(1, err).NotTo(HaveOccurred())

			By("deploying the controller-manager")
			cmd = exec.Command("make", "deploy", fmt.Sprintf("IMG=%s", projectimage))
			_, err = utils.Run(cmd)
			ExpectWithOffset(1, err).NotTo(HaveOccurred())

			By("validating that the controller-manager pod is running as expected")
			verifyControllerUp := func() error {
				// Get pod name

				cmd = exec.Command("kubectl", "get",
					"pods", "-l", "control-plane=controller-manager",
					"-o", "go-template={{ range .items }}"+
						"{{ if not .metadata.deletionTimestamp }}"+
						"{{ .metadata.name }}"+
						"{{ \"\\n\" }}{{ end }}{{ end }}",
					"-n", namespace,
				)

				podOutput, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())
				podNames := utils.GetNonEmptyLines(string(podOutput))
				if len(podNames) != 1 {
					return fmt.Errorf("expect 1 controller pods running, but got %d", len(podNames))
				}
				controllerPodName = podNames[0]
				ExpectWithOffset(2, controllerPodName).Should(ContainSubstring("controller-manager"))

				// Validate pod status
				cmd = exec.Command("kubectl", "get",
					"pods", controllerPodName, "-o", "jsonpath={.status.phase}",
					"-n", namespace,
				)
				status, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())
				if string(status) != "Running" {
					return fmt.Errorf("controller pod in %s status", status)
				}
				return nil
			}
			EventuallyWithOffset(1, verifyControllerUp, time.Minute, time.Second).Should(Succeed())

			By("creating an instance of the WorkspaceKind CR")
			EventuallyWithOffset(1, func() error {
				cmd = exec.Command("kubectl", "apply", "-f", filepath.Join(projectDir,
					"config/samples/v1beta1_workspacekind.yaml"))
				_, err = utils.Run(cmd)
				return err
			}, time.Minute, time.Second).Should(Succeed())

			By("creating an instance of the Workspace CR")
			EventuallyWithOffset(1, func() error {
				cmd = exec.Command("kubectl", "apply", "-f", filepath.Join(projectDir,
					"config/samples/v1beta1_workspace.yaml"))
				_, err = utils.Run(cmd)
				return err
			}, time.Minute, time.Second).Should(Succeed())

			By("validating that workspace pod is running as expected")
			verifyWorkspacePod := func() error {
				// Get workspace pod name
				cmd = exec.Command("kubectl", "get",
					"pods", "-l", "statefulset=my-workspace",
					"-o", "go-template={{ range .items }}"+
						"{{ if not .metadata.deletionTimestamp }}"+
						"{{ .metadata.name }}"+
						"{{ \"\\n\" }}{{ end }}{{ end }}",
				)

				podOutput, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())
				podNames := utils.GetNonEmptyLines(string(podOutput))
				if len(podNames) != 1 {
					return fmt.Errorf("expect 1 workspace pod running, but got %d", len(podNames))
				}
				workspacePodName := podNames[0]
				ExpectWithOffset(2, workspacePodName).Should(ContainSubstring("ws-my-workspace"))

				// Validate pod status
				cmd = exec.Command("kubectl", "get",
					"pods", workspacePodName, "-o", "jsonpath={.status.phase}",
				)
				status, err := utils.Run(cmd)
				ExpectWithOffset(2, err).NotTo(HaveOccurred())
				if string(status) != "Running" {
					return fmt.Errorf("workspace pod in %s status", status)
				}
				return nil
			}
			EventuallyWithOffset(1, verifyWorkspacePod, time.Minute, time.Second).Should(Succeed())

			By("CURL the workspace pod")
			getServiceName := func() (string, error) {
				cmd := exec.Command("kubectl", "get", "services", "-l", "notebooks.kubeflow.org/workspace-name=my-workspace", "-o", "jsonpath={.items[0].metadata.name}")
				output, err := cmd.CombinedOutput()
				if err != nil {
					return "", fmt.Errorf("failed to get service name: %v", err)
				}
				serviceName := strings.TrimSpace(string(output))
				if serviceName == "" {
					return "", fmt.Errorf("no service found with label notebooks.kubeflow.org/workspace-name=my-workspace")
				}
				return serviceName, nil
			}
			serviceName, err := getServiceName()
			ExpectWithOffset(1, err).NotTo(HaveOccurred())

			// Construct the service endpoint
			const servicePort = 8888
			serviceEndpoint := fmt.Sprintf("http://%s:%d/workspace/default/my-workspace/jupyterlab/lab", serviceName, servicePort)

			// Function to run the curl command inside the cluster and return the status code
			curlService := func() (int, error) {
				cmd := exec.Command("kubectl", "run", "tmp-curl", "--restart=Never", "--rm", "-i", "--image=appropriate/curl", "--",
					"curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", serviceEndpoint)

				// Execute the curl command
				output, err := cmd.CombinedOutput()
				if err != nil {
					return 0, fmt.Errorf("failed to execute curl command: %v", err)
				}

				// Parse the HTTP status code from the output
				var statusCode int
				if _, err := fmt.Sscanf(string(output), "%d", &statusCode); err != nil {
					return 0, fmt.Errorf("failed to parse status code: %v", err)
				}

				return statusCode, nil
			}

			// Check that the curl command returns a 200-status code
			Eventually(func() (int, error) {
				return curlService()
			}, 2*time.Minute, 10*time.Second).Should(Equal(200), "Expected status code to be 200")

		})
	})
})
