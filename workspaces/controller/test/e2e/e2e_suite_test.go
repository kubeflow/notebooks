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

var _ = BeforeSuite(func() {
	By("building the controller image")
	cmd := exec.Command("make", "docker-build", fmt.Sprintf("IMG=%s", controllerImage))
	_, err := utils.Run(cmd)
	ExpectWithOffset(1, err).NotTo(HaveOccurred())

	By("loading the controller image on Kind")
	err = utils.LoadImageToKindClusterWithName(controllerImage)
	ExpectWithOffset(1, err).NotTo(HaveOccurred())

	// TODO: enable Prometheus installation once we start using it
	// if !skipPrometheusInstall {
	// 	By("checking if prometheus is installed already")
	// 	isPrometheusOperatorAlreadyInstalled = utils.IsPrometheusCRDsInstalled()
	// 	if !isPrometheusOperatorAlreadyInstalled {
	// 		_, _ = fmt.Fprintf(GinkgoWriter, "Installing Prometheus Operator...\n")
	// 		Expect(utils.InstallPrometheusOperator()).To(Succeed(), "Failed to install Prometheus Operator")
	// 	} else {
	// 		_, _ = fmt.Fprintf(GinkgoWriter, "WARNING: Prometheus Operator is already installed. Skipping installation...\n")
	// 	}
	// }
	// By("checking that prometheus is running")
	// Expect(utils.WaitPrometheusOperatorRunning()).To(Succeed(), "Prometheus Operator is not running")

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
})

var _ = AfterSuite(func() {

	// if !skipPrometheusInstall && !isPrometheusOperatorAlreadyInstalled {
	// 	By("uninstalling Prometheus Operator")
	// 	_, _ = fmt.Fprintf(GinkgoWriter, "Uninstalling Prometheus Operator...\n")
	// 	utils.UninstallPrometheusOperator()
	// }

	if !skipCertManagerInstall && !isCertManagerAlreadyInstalled {
		By("uninstalling CertManager")
		_, _ = fmt.Fprintf(GinkgoWriter, "Uninstalling CertManager...\n")
		utils.UninstallCertManager()
	}
})
