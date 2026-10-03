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
	"os"
	"os/exec"
	"testing"
	"path/filepath"
	corev1 "k8s.io/api/core/v1"

	"github.com/kubeflow/notebooks/workspaces/controller/test/utils"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
	
)

var (
	// These variables are useful to avoid re-installation and conflicts:
	//  - PROMETHEUS_INSTALL_SKIP=true: Skips Prometheus installation during test setup.
	//  - CERT_MANAGER_INSTALL_SKIP=true: Skips CertManager installation during test setup.
	skipCertManagerInstall = os.Getenv("CERT_MANAGER_INSTALL_SKIP") == "true"
	// skipPrometheusInstall  = os.Getenv("PROMETHEUS_INSTALL_SKIP") == "true"

	// isCertManagerAlreadyInstalled will be set true when CertManager CRDs be found on the cluster
	isCertManagerAlreadyInstalled = false

	// isPrometheusOperatorAlreadyInstalled will be set true when prometheus CRDs be found on the cluster
	// isPrometheusOperatorAlreadyInstalled = false

	skipIstioInstall        = os.Getenv("ISTIO_INSTALL_SKIP") == "true"
	isIstioAlreadyInstalled = false
)

// TestE2E runs the end-to-end (e2e) test suite for the project. These tests execute in an isolated,
// temporary environment to validate project changes with the purposed to be used in CI jobs.
// The default setup requires Kind, builds/loads the Manager Docker image locally, and installs
// CertManager and Prometheus.
func TestE2E(t *testing.T) {
	RegisterFailHandler(Fail)
	_, _ = fmt.Fprintf(GinkgoWriter, "Starting workspace-controller suite\n")
	RunSpecs(t, "e2e suite")
}

var _ = SynchronizedBeforeSuite(func() []byte {
	// -------------------------------------------------------------
	// Function 1: Runs ONLY on Worker 1 (Node 1) - Global Cluster Setup
	// -------------------------------------------------------------
	

	By("building the controller image")
	cmd := exec.Command("make", "docker-build", fmt.Sprintf("IMG=%s", controllerImage))
	_, err := utils.Run(cmd)
	ExpectWithOffset(1, err).NotTo(HaveOccurred())

	By("loading the controller image on Kind")
	err = utils.LoadImageToKindClusterWithName(controllerImage)
	ExpectWithOffset(1, err).NotTo(HaveOccurred())

	if !skipCertManagerInstall {
		By("checking if cert manager is installed already")
		isCertManagerAlreadyInstalled = utils.IsCertManagerCRDsInstalled()
		if !isCertManagerAlreadyInstalled {
			_, _ = fmt.Fprintf(GinkgoWriter, "Installing CertManager...\n")
			Expect(utils.InstallCertManager()).To(Succeed(), "Failed to install CertManager")
		} else {
			_, _ = fmt.Fprintf(GinkgoWriter, "WARNING: CertManager is already installed. Skipping installation...\n")
		}
	}
	By("checking that cert manager is running")
	Expect(utils.WaitCertManagerRunning()).To(Succeed(), "CertManager is not running")

	if !skipIstioInstall {
		By("checking if istio is installed already")
		isIstioAlreadyInstalled = utils.IsIstioCRDsInstalled()

		if !isIstioAlreadyInstalled {
			_, _ = fmt.Fprintf(GinkgoWriter, "Installing istio...\n")
			Expect(utils.InstallIstio()).To(Succeed(), "Failed to install istio")
		} else {
			_, _ = fmt.Fprintf(GinkgoWriter,
				"WARNING: istio is already installed. Skipping installation...\n")
		}

		By("checking that istio is available")
		Expect(utils.WaitIstioAvailable()).To(Succeed(), "istio is not available")
	}

	By("creating the controller namespace")
	cmd = exec.Command("kubectl", "create", "ns", controllerNamespace)
	_, _ = utils.Run(cmd) // ignore errors because namespace may already exist

	By("labeling controller namespace for Istio injection")
	err = utils.LabelNamespaceForIstioInjection(controllerNamespace)
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
		cmd := exec.Command("kubectl", "wait", "certificate",
			"workspaces-serving-cert",
			"-n", controllerNamespace,
			"--for=condition=Ready",
			fmt.Sprintf("--timeout=%s", timeout),
		)
		_, err := utils.Run(cmd)
		g.Expect(err).NotTo(HaveOccurred(), "Certificate resource not ready")

		cmd = exec.Command("kubectl", "get", "secret",
			"webhook-server-cert",
			"-n", controllerNamespace,
		)
		_, err = utils.Run(cmd)
		g.Expect(err).NotTo(HaveOccurred(), "webhook-server-cert secret not found")
	}
	Eventually(waitForWebhookCert, timeout, interval).Should(Succeed())

	By("validating that the workspaces-controller pod is running as expected")
	verifyControllerUp := func(g Gomega) {
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

		podNames := utils.GetNonEmptyLines(podOutput)
		g.Expect(podNames).To(HaveLen(1), "expected 1 controller pod running")
		g.Expect(podNames[0]).To(ContainSubstring("workspaces-controller"))

		cmd = exec.Command("kubectl", "get", "pods",
			podNames[0],
			"-n", controllerNamespace,
			"-o", "jsonpath={.status.phase}",
		)
		statusPhase, err := utils.Run(cmd)
		g.Expect(err).NotTo(HaveOccurred())
		g.Expect(statusPhase).To(BeEquivalentTo(corev1.PodRunning), "Incorrect workspaces-controller pod phase")
	}
	Eventually(verifyControllerUp, timeout, interval).Should(Succeed())

	return nil
}, func(data []byte) {
	// -------------------------------------------------------------
	// Function 2: Runs on ALL workers - Per-Worker Namespace Setup
	// -------------------------------------------------------------
	projectDir, _ := utils.GetProjectDir()
	workerNs := fmt.Sprintf("workspace-test-%d", GinkgoParallelProcess())

	By(fmt.Sprintf("creating the workspace namespace for worker %d: %s", GinkgoParallelProcess(), workerNs))
	cmd := exec.Command("kubectl", "create", "ns", workerNs)
	_, _ = utils.Run(cmd)

	By(fmt.Sprintf("labeling workspace namespace %s for Istio injection", workerNs))
	err := utils.LabelNamespaceForIstioInjection(workerNs)
	ExpectWithOffset(1, err).NotTo(HaveOccurred())

	By(fmt.Sprintf("creating common workspace resources in %s", workerNs))
	cmd = exec.Command("kubectl", "apply",
		"-k", filepath.Join(projectDir, "manifests/kustomize/samples/common"),
		"-n", workerNs,
	)
	_, err = utils.Run(cmd)
	ExpectWithOffset(1, err).NotTo(HaveOccurred())
})

var _ = SynchronizedAfterSuite(func() {

	// Function 1: Runs on ALL workers - Clean up worker namespace

	workerNs := fmt.Sprintf("workspace-test-%d", GinkgoParallelProcess())
	By(fmt.Sprintf("deleting workspace namespace for worker %d: %s", GinkgoParallelProcess(), workerNs))
	cmd := exec.Command("kubectl", "delete", "ns", workerNs)
	_, _ = utils.Run(cmd)
}, func() {
	
	// Function 2: Runs ONLY on Worker 1 - Global Cluster Teardown

	By("deleting the controller")
	cmd := exec.Command("make", "undeploy")
	_, _ = utils.Run(cmd)

	By("deleting controller namespace")
	cmd = exec.Command("kubectl", "delete", "ns", controllerNamespace)
	_, _ = utils.Run(cmd)

	By("deleting CRDs")
	cmd = exec.Command("make", "uninstall")
	_, _ = utils.Run(cmd)

	if !skipCertManagerInstall && !isCertManagerAlreadyInstalled {
		By("uninstalling CertManager")
		_, _ = fmt.Fprintf(GinkgoWriter, "Uninstalling CertManager...\n")
		utils.UninstallCertManager()
	}

	if !skipIstioInstall && !isIstioAlreadyInstalled {
		By("uninstalling Istio")
		_, _ = fmt.Fprintf(GinkgoWriter, "Uninstalling Istio...\n")
		utils.UninstallIstio()
	}
})