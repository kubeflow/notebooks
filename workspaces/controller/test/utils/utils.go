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

package utils

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"

	. "github.com/onsi/ginkgo/v2" //nolint:golint
)

const (

	// use LTS version of istioctl
	istioctlVersion = "1.27.0"
	istioctlURL     = ""

	// use LTS version of prometheus-operator
	prometheusOperatorVersion = "v0.72.0"
	prometheusOperatorURL     = "https://github.com/prometheus-operator/prometheus-operator/" +
		"releases/download/%s/bundle.yaml"

	// use LTS version of cert-manager
	certManagerVersion = "v1.12.13"
	certManagerURLTmpl = "https://github.com/jetstack/cert-manager/releases/download/%s/cert-manager.yaml"
)

func warnError(err error) {
	_, _ = fmt.Fprintf(GinkgoWriter, "warning: %v\n", err)
}

// Run executes the provided command within this context
func Run(cmd *exec.Cmd) (string, error) {
	dir, _ := GetProjectDir()
	cmd.Dir = dir

	if err := os.Chdir(cmd.Dir); err != nil {
		_, _ = fmt.Fprintf(GinkgoWriter, "chdir dir: %s\n", err)
	}

	cmd.Env = append(os.Environ(), "GO111MODULE=on")
	command := strings.Join(cmd.Args, " ")
	_, _ = fmt.Fprintf(GinkgoWriter, "running: %s\n", command)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("%s failed with error: (%w) %s", command, err, string(output))
	}

	return string(output), nil
}

func UninstallIstioctl() {
	// First, uninstall Istio components if they exist
	if IsIstioInstalled() {
		fmt.Println("Uninstalling Istio components...")
		cmd := exec.Command("istioctl", "uninstall", "--purge", "-y")
		if _, err := Run(cmd); err != nil {
			warnError(fmt.Errorf("failed to uninstall Istio components: %w", err))
		}

		// Delete istio-system namespace
		cmd = exec.Command("kubectl", "delete", "namespace", "istio-system", "--ignore-not-found")
		if _, err := Run(cmd); err != nil {
			warnError(fmt.Errorf("failed to delete istio-system namespace: %w", err))
		}
	}

	// Remove istioctl binary from system
	osName := runtime.GOOS
	var rmCmd *exec.Cmd

	if osName == "windows" {
		// Windows: Remove from C:\istioctl
		rmCmd = exec.Command("del", "/f", "/q", "C:\\istioctl\\istioctl.exe")
	} else {
		// Unix-like: Remove from local bin directory
		homeDir, err := os.UserHomeDir()
		if err != nil {
			warnError(fmt.Errorf("failed to get user home directory: %w", err))
			return
		}
		rmCmd = exec.Command("rm", "-f", homeDir+"/.local/bin/istioctl")
	}

	if _, err := Run(rmCmd); err != nil {
		warnError(fmt.Errorf("failed to remove istioctl binary: %w", err))
	}

	fmt.Println("Istioctl uninstalled successfully")
}

// InstallIstioctl installs the istioctl to be used to manage istio resources.
func InstallIstioctl() error {
	osName := runtime.GOOS
	archName := runtime.GOARCH

	// Map Go architecture names to Istio release names
	switch archName {
	case "amd64":
		archName = "amd64"
	case "arm64":
		archName = "arm64"
	case "386":
		return fmt.Errorf("32-bit architectures are not supported by Istio")
	default:
		return fmt.Errorf("unsupported architecture: %s", archName)
	}

	// Map Go OS names to Istio release names and determine file extension
	var fileExt string
	switch osName {
	case "linux":
		osName = "linux"
		fileExt = "tar.gz"
	case "darwin":
		osName = "osx"
		fileExt = "tar.gz"
	case "windows":
		osName = "win"
		fileExt = "zip"
	default:
		return fmt.Errorf("unsupported operating system: %s", osName)
	}

	// Construct the download URL dynamically
	fileName := fmt.Sprintf("istioctl-%s-%s-%s.%s", istioctlVersion, osName, archName, fileExt)
	url := fmt.Sprintf("https://github.com/istio/istio/releases/download/%s/%s", istioctlVersion, fileName)

	// Set the binary name based on OS
	binaryName := "istioctl"
	if osName == "win" {
		binaryName = "istioctl.exe"
	}

	// Download the file using platform-appropriate method with fallbacks
	downloadSuccess := false

	// Try primary download method
	var primaryCmd *exec.Cmd
	var fallbackCmd *exec.Cmd

	if osName == "win" {
		// Windows: PowerShell first, curl as fallback
		// Use proper PowerShell syntax with double quotes and escape handling
		primaryCmd = exec.Command("powershell", "-ExecutionPolicy", "Bypass", "-Command",
			fmt.Sprintf(`Invoke-WebRequest -Uri "%s" -OutFile "%s"`, url, fileName))
		fallbackCmd = exec.Command("curl", "-L", url, "-o", fileName)
	} else {
		// Unix-like: curl first, wget as fallback
		primaryCmd = exec.Command("curl", "-L", url, "-o", fileName)
		fallbackCmd = exec.Command("wget", "-O", fileName, url)
	}

	// Try primary method
	primaryCmd.Stdout, primaryCmd.Stderr = os.Stdout, os.Stderr
	if err := primaryCmd.Run(); err == nil {
		downloadSuccess = true
	} else {
		// Try fallback method
		fallbackCmd.Stdout, fallbackCmd.Stderr = os.Stdout, os.Stderr
		if err := fallbackCmd.Run(); err == nil {
			downloadSuccess = true
		}
	}

	if !downloadSuccess {
		if osName == "win" {
			return fmt.Errorf("failed to download istioctl from %s using both PowerShell and curl", url)
		} else {
			return fmt.Errorf("failed to download istioctl from %s using both curl and wget", url)
		}
	}

	// Extract based on file type
	var extractCmd *exec.Cmd
	switch fileExt {
	case "tar.gz":
		extractCmd = exec.Command("tar", "-xzf", fileName)
	case "zip":
		extractCmd = exec.Command("unzip", "-q", fileName)
	default:
		return fmt.Errorf("unsupported file extension: %s", fileExt)
	}
	extractCmd.Stdout, extractCmd.Stderr = os.Stdout, os.Stderr

	if err := extractCmd.Run(); err != nil {
		return fmt.Errorf("failed to extract %s: %w", fileName, err)
	}

	// Find the extracted binary (it could be in various subdirectories)
	findCmd := exec.Command("find", ".", "-name", binaryName, "-type", "f")
	output, err := findCmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to find istioctl binary after extraction: %w", err)
	}

	binaryPath := strings.TrimSpace(string(output))
	if binaryPath == "" {
		return fmt.Errorf("istioctl binary not found in extracted files")
	}

	// Use the first found binary if multiple exist
	if strings.Contains(binaryPath, "\n") {
		binaryPath = strings.Split(binaryPath, "\n")[0]
	}

	// Copy the binary to current directory with standard name if needed
	// Handle case where binaryPath might be "./istioctl" vs "istioctl"
	normalizedPath := strings.TrimPrefix(binaryPath, "./")
	if normalizedPath != binaryName {
		var cpCmd *exec.Cmd
		if osName == "win" {
			cpCmd = exec.Command("copy", binaryPath, binaryName)
		} else {
			cpCmd = exec.Command("cp", binaryPath, binaryName)
		}
		if err := cpCmd.Run(); err != nil {
			return fmt.Errorf("failed to copy istioctl binary: %w", err)
		}
	}

	// Make executable (not needed on Windows)
	if osName != "win" {
		chmodCmd := exec.Command("chmod", "+x", binaryName)
		if err := chmodCmd.Run(); err != nil {
			return fmt.Errorf("failed to make istioctl executable: %w", err)
		}
	}

	// Move to appropriate bin directory
	// Use local bin directory to avoid sudo requirements
	var binDir string
	var moveCmd *exec.Cmd

	if osName == "win" {
		// Use a local bin directory on Windows
		binDir = "C:\\istioctl"
		mkdirCmd := exec.Command("mkdir", "-p", binDir)
		mkdirCmd.Run() // Ignore errors if directory exists
		moveCmd = exec.Command("move", binaryName, binDir+"\\istioctl.exe")
	} else {
		// Use local bin directory instead of /usr/local/bin to avoid sudo
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("failed to get user home directory: %w", err)
		}
		binDir = homeDir + "/.local/bin"

		// Create the bin directory if it doesn't exist
		mkdirCmd := exec.Command("mkdir", "-p", binDir)
		if err := mkdirCmd.Run(); err != nil {
			return fmt.Errorf("failed to create local bin directory: %w", err)
		}

		moveCmd = exec.Command("mv", binaryName, binDir+"/istioctl")
	}

	moveCmd.Stdout, moveCmd.Stderr = os.Stdout, os.Stderr
	if err := moveCmd.Run(); err != nil {
		return fmt.Errorf("failed to move istioctl to bin directory: %w", err)
	}

	// Add to PATH notice
	if osName != "win" {
		fmt.Printf("istioctl installed to %s\n", binDir)
		fmt.Printf("Make sure %s is in your PATH by adding this to your shell profile:\n", binDir)
		fmt.Printf("export PATH=\"%s:$PATH\"\n", binDir)
	}

	// Clean up downloaded files
	cleanupCmd := exec.Command("rm", "-f", fileName)
	if osName == "win" {
		cleanupCmd = exec.Command("del", "/f", fileName)
	}
	cleanupCmd.Run() // Ignore cleanup errors

	return nil
}

// InstallIstioMinimalWithIngress installs Istio with minimal profile and ingressgateway enabled.
func InstallIstioMinimalWithIngress(namespace string) error {
	cmd := exec.Command("istioctl",
		"install",
		"--set", "profile=minimal",
		"--set", "values.gateways.istio-ingressgateway.enabled=true",
		"--set", fmt.Sprintf("values.global.istioNamespace=%s", namespace),
		"-y",
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

// TODO:
func IsIstioInstalled() bool {
	cmd := exec.Command("istioctl", "version")
	_, err := Run(cmd)
	return err == nil
}

// WaitIstioAvailable waits for Istio to be available and running.
// Returns nil if Istio is ready, or an error if not ready within timeout.
func WaitIstioAvailable() error {
	// First check if istio-system namespace exists
	cmd := exec.Command("kubectl", "get", "namespace", "istio-system")
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istio-system namespace not found: %w", err)
	}

	// Wait for Istio control plane (istiod) pods to be ready
	cmd = exec.Command("kubectl", "wait",
		"--for=condition=Ready",
		"pods",
		"-l", "app=istiod",
		"-n", "istio-system",
		"--timeout=300s")
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istiod pods not ready: %w", err)
	}

	// Wait for Istio ingress gateway pods to be ready
	cmd = exec.Command("kubectl", "wait",
		"--for=condition=Ready",
		"pods",
		"-l", "app=istio-ingressgateway",
		"-n", "istio-system",
		"--timeout=300s")
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istio-ingressgateway pods not ready: %w", err)
	}

	// Wait for Istio egress gateway pods to be ready (if present)
	// Note: egress gateway is optional, so we don't fail if it's not found
	cmd = exec.Command("kubectl", "get",
		"pods",
		"-l", "app=istio-egressgateway",
		"-n", "istio-system",
		"--no-headers")
	output, err := Run(cmd)
	if err == nil && len(strings.TrimSpace(output)) > 0 && !strings.Contains(output, "No resources found") {
		// Egress gateway exists, wait for it to be ready
		cmd = exec.Command("kubectl", "wait",
			"--for=condition=Ready",
			"pods",
			"-l", "app=istio-egressgateway",
			"-n", "istio-system",
			"--timeout=300s")
		if _, err := Run(cmd); err != nil {
			return fmt.Errorf("istio-egressgateway pods not ready: %w", err)
		}
	}

	// Verify istioctl can analyze (optional validation)
	cmd = exec.Command("istioctl", "analyze", "--all-namespaces")
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istioctl analyze failed: %w", err)
	}

	return nil
}

// IsIstioIngressGatewayInstalled checks if istio-ingressgateway is installed
func IsIstioIngressGatewayInstalled() bool {
	cmd := exec.Command("kubectl", "get", "deployment",
		"-n", "istio-system",
		"istio-ingressgateway",
		"--ignore-not-found")
	output, err := Run(cmd)
	if err != nil {
		return false
	}
	return len(strings.TrimSpace(output)) > 0
}

// InstallIstioIngressGateway installs the istio-ingressgateway
func InstallIstioIngressGateway() error {
	// Check if Istio is installed first
	if !IsIstioInstalled() {
		return fmt.Errorf("istio must be installed before installing ingress gateway")
	}

	// Install ingress gateway using istioctl
	cmd := exec.Command("istioctl", "install",
		"--set", "components.ingressGateways[0].enabled=true",
		"--set", "components.ingressGateways[0].name=istio-ingressgateway",
		"-y")

	_, err := Run(cmd)
	return err
}

// WaitIstioIngressGatewayReady waits for istio-ingressgateway to be ready
func WaitIstioIngressGatewayReady() error {
	// Wait for the deployment to be available
	cmd := exec.Command("kubectl", "wait",
		"--for=condition=Available",
		"deployment/istio-ingressgateway",
		"-n", "istio-system",
		"--timeout=300s")

	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istio-ingressgateway deployment not available: %w", err)
	}

	// Wait for the pods to be ready
	cmd = exec.Command("kubectl", "wait",
		"--for=condition=Ready",
		"pods",
		"-l", "app=istio-ingressgateway",
		"-n", "istio-system",
		"--timeout=300s")

	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istio-ingressgateway pods not ready: %w", err)
	}

	// Wait for the service to have external IP (if LoadBalancer type)
	cmd = exec.Command("kubectl", "get", "service",
		"istio-ingressgateway",
		"-n", "istio-system",
		"-o", "jsonpath={.status.loadBalancer.ingress[0].ip}")

	// Note: This might not apply for all environments (like kind/minikube)
	// so we don't fail if external IP is not assigned
	Run(cmd) // Ignore error for external IP check

	return nil
}

// EnsureIstioIngressGateway checks, installs, and waits for istio-ingressgateway
func EnsureIstioIngressGateway() error {
	// Check if already installed
	if IsIstioIngressGatewayInstalled() {
		fmt.Println("Istio ingress gateway is already installed")
	} else {
		fmt.Println("Installing Istio ingress gateway...")
		if err := InstallIstioIngressGateway(); err != nil {
			return fmt.Errorf("failed to install istio-ingressgateway: %w", err)
		}
	}

	// Wait for it to be ready
	fmt.Println("Waiting for Istio ingress gateway to be ready...")
	if err := WaitIstioIngressGatewayReady(); err != nil {
		return fmt.Errorf("istio-ingressgateway failed to become ready: %w", err)
	}

	fmt.Println("Istio ingress gateway is ready!")
	return nil
}

// UninstallPrometheusOperator uninstalls the prometheus
func UninstallPrometheusOperator() {
	url := fmt.Sprintf(prometheusOperatorURL, prometheusOperatorVersion)
	cmd := exec.Command("kubectl", "delete", "-f", url)
	if _, err := Run(cmd); err != nil {
		warnError(err)
	}
}

// InstallPrometheusOperator installs the prometheus Operator to be used to export the enabled metrics.
func InstallPrometheusOperator() error {
	url := fmt.Sprintf(prometheusOperatorURL, prometheusOperatorVersion)
	cmd := exec.Command("kubectl", "apply", "-f", url)
	_, err := Run(cmd)
	return err
}

// WaitPrometheusOperatorRunning waits for prometheus operator to be running, and returns an error if not.
func WaitPrometheusOperatorRunning() error {
	cmd := exec.Command("kubectl", "wait",
		"deployment.apps",
		"--for", "condition=Available",
		"--selector", "app.kubernetes.io/name=prometheus-operator",
		"--all-namespaces",
		"--timeout", "5m",
	)
	_, err := Run(cmd)
	return err
}

// IsPrometheusCRDsInstalled checks if any Prometheus CRDs are installed
// by verifying the existence of key CRDs related to Prometheus.
func IsPrometheusCRDsInstalled() bool {
	// List of common Prometheus CRDs
	prometheusCRDs := []string{
		"prometheuses.monitoring.coreos.com",
		"prometheusrules.monitoring.coreos.com",
		"prometheusagents.monitoring.coreos.com",
	}

	cmd := exec.Command("kubectl", "get", "crds", "-o", "name")
	output, err := Run(cmd)
	if err != nil {
		return false
	}
	crdList := GetNonEmptyLines(output)
	for _, crd := range prometheusCRDs {
		for _, line := range crdList {
			if strings.Contains(line, crd) {
				return true
			}
		}
	}

	return false
}

// UninstallCertManager uninstalls the cert manager
func UninstallCertManager() {
	url := fmt.Sprintf(certManagerURLTmpl, certManagerVersion)
	cmd := exec.Command("kubectl", "delete", "-f", url)
	if _, err := Run(cmd); err != nil {
		warnError(err)
	}
}

// InstallCertManager installs the cert manager bundle.
func InstallCertManager() error {
	// remove any existing cert-manager leases
	// NOTE: this is required to avoid issues where cert-manager is reinstalled quickly due to rerunning tests
	cmd := exec.Command("kubectl", "delete",
		"leases",
		"--ignore-not-found",
		"--namespace", "kube-system",
		"cert-manager-controller",
		"cert-manager-cainjector-leader-election",
	)
	_, err := Run(cmd)
	if err != nil {
		return err
	}

	// install cert-manager
	url := fmt.Sprintf(certManagerURLTmpl, certManagerVersion)
	cmd = exec.Command("kubectl", "apply", "-f", url)
	_, err = Run(cmd)
	return err
}

// WaitCertManagerRunning waits for cert manager to be running, and returns an error if not.
func WaitCertManagerRunning() error {

	// Wait for the cert-manager Deployments to be Available
	cmd := exec.Command("kubectl", "wait",
		"deployment.apps",
		"--for", "condition=Available",
		"--selector", "app.kubernetes.io/instance=cert-manager",
		"--all-namespaces",
		"--timeout", "5m",
	)
	_, err := Run(cmd)
	if err != nil {
		return err
	}

	// Wait for the cert-manager Endpoints to be ready
	// NOTE: the webhooks will not function correctly until this is ready
	cmd = exec.Command("kubectl", "wait",
		"endpoints",
		"--for", "jsonpath=subsets[0].addresses[0].targetRef.kind=Pod",
		"--selector", "app.kubernetes.io/instance=cert-manager",
		"--all-namespaces",
		"--timeout", "2m",
	)
	_, err = Run(cmd)
	return err

	// First check if cert-manager namespace exists, if not install cert-manager
	// cmd := exec.Command("kubectl", "get", "namespace", "cert-manager")
	// if _, err := Run(cmd); err != nil {
	// 	// Namespace doesn't exist, install cert-manager
	// 	fmt.Println("cert-manager namespace not found, installing cert-manager...")
	// 	if err := InstallCertManager(); err != nil {
	// 		return fmt.Errorf("failed to install cert-manager: %w", err)
	// 	}
	// }

	// // Wait for the cert-manager namespace to be ready
	// cmd = exec.Command("kubectl", "wait", "--for=condition=Ready", "namespace/cert-manager", "--timeout=300s")
	// if _, err := Run(cmd); err != nil {
	// 	return fmt.Errorf("cert-manager namespace not ready: %w", err)
	// }

	// // Wait for each CertManager deployment individually by name (most reliable)
	// deployments := []string{"cert-manager", "cert-manager-cainjector", "cert-manager-webhook"}

	// for _, deployment := range deployments {
	// 	cmd := exec.Command("kubectl", "wait", "deployment", deployment,
	// 		"-n", "cert-manager",
	// 		"--for", "condition=Available",
	// 		"--timeout", "300s")

	// 	if _, err := Run(cmd); err != nil {
	// 		return fmt.Errorf("deployment %s not ready: %w", deployment, err)
	// 	}
	// }

	// // Wait for the cert-manager webhook to be ready (critical for functionality)
	// cmd = exec.Command("kubectl", "wait", "pods",
	// 	"-n", "cert-manager",
	// 	"-l", "app=webhook",
	// 	"--for", "condition=Ready",
	// 	"--timeout", "300s")

	// if _, err := Run(cmd); err != nil {
	// 	return fmt.Errorf("cert-manager webhook pods not ready: %w", err)
	// }

	// return nil
}

// IsCertManagerCRDsInstalled checks if any Cert Manager CRDs are installed
// by verifying the existence of key CRDs related to Cert Manager.
func IsCertManagerCRDsInstalled() bool {
	// List of common Cert Manager CRDs
	certManagerCRDs := []string{
		"certificates.cert-manager.io",
		"issuers.cert-manager.io",
		"clusterissuers.cert-manager.io",
		"certificaterequests.cert-manager.io",
		"orders.acme.cert-manager.io",
		"challenges.acme.cert-manager.io",
	}

	// Execute the kubectl command to get all CRDs
	cmd := exec.Command("kubectl", "get", "crds", "-o", "name")
	output, err := Run(cmd)
	if err != nil {
		return false
	}

	// Check if any of the Cert Manager CRDs are present
	crdList := GetNonEmptyLines(output)
	for _, crd := range certManagerCRDs {
		for _, line := range crdList {
			if strings.Contains(line, crd) {
				return true
			}
		}
	}

	return false
}

// LoadImageToKindClusterWithName loads a local docker image to the kind cluster
func LoadImageToKindClusterWithName(name string) error {
	var cluster string
	if v, ok := os.LookupEnv("KIND_CLUSTER"); ok {
		cluster = v
	} else {
		// if `KIND_CLUSTER` is not set, get the cluster name from the kubeconfig
		cmd := exec.Command("kubectl", "config", "current-context")
		output, err := Run(cmd)
		if err != nil {
			return err
		}
		cluster = strings.TrimSpace(output)
		cluster = strings.Replace(cluster, "kind-", "", 1)
	}
	kindOptions := []string{"load", "docker-image", name, "--name", cluster}
	cmd := exec.Command("kind", kindOptions...)
	_, err := Run(cmd)
	return err
}

// GetNonEmptyLines converts given command output string into individual objects
// according to line breakers, and ignores the empty elements in it.
func GetNonEmptyLines(output string) []string {
	var res []string
	elements := strings.Split(output, "\n")
	for _, element := range elements {
		if element != "" {
			res = append(res, element)
		}
	}

	return res
}

// GetProjectDir will return the directory where the project is
func GetProjectDir() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return wd, err
	}
	wd = strings.ReplaceAll(wd, "/test/e2e", "")
	return wd, nil
}
