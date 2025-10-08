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
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	// Istio revision to use for all installations
	istioRevision = "default"
	// Istio ingress gateway name
	istioIngressGatewayName = "istio-ingressgateway"
)

// getIstioctlPath returns the path to the istioctl binary from the project's bin directory
func getIstioctlPath() string {
	projectDir, _ := GetProjectDir()
	return filepath.Join(projectDir, "bin", "istioctl")
}

// Istio installation parameter arrays - defined centrally to ensure install/uninstall sync
var (
	// Parameters to use for install/uninstall of Istio
	istioBaseParams = []string{
		"--set", "profile=default",
		"--revision=" + istioRevision,
		"-y",
	}

	// Parameters to use for install/uninstall of istion-ingressgateway
	istioIngressGatewayBaseParams = []string{
		"--set", "profile=empty",
		"--set", "components.ingressGateways[0].name=" + istioIngressGatewayName,
		"--set", "components.ingressGateways[0].enabled=true",
		"--revision=" + istioRevision,
		"-y",
	}
)

// buildIstioDefaultParams creates parameter arrays for istioctl commands
func buildIstioParams(command string) []string {
	params := make([]string, 0, len(istioBaseParams)+1)
	params = append(params, command)
	params = append(params, istioBaseParams...)
	return params
}

// buildIstioIngressGatewayParams creates parameter arrays for istioctl commands
// with the ingress gateway configuration and specified namespace
func buildIstioIngressGatewayParams(command string, istioNamespace string) []string {
	params := make([]string, 0, len(istioIngressGatewayBaseParams)+2)
	params = append(params, command)
	params = append(params, istioIngressGatewayBaseParams...)
	params = append(params, "--set", "values.global.istioNamespace="+istioNamespace)
	return params
}

func UninstallIstioIngressGateway(istioNamespace string) {
	// Uninstall Istio ingress gateway using the same base params as installation
	params := buildIstioIngressGatewayParams("uninstall", istioNamespace)
	cmd := exec.Command(getIstioctlPath(), params...)
	if _, err := Run(cmd); err != nil {
		warnError(fmt.Errorf("failed to uninstall Istio ingress gateway: %w", err))
		return
	}
}

func UninstallIstio(istioNamespace string) {
	// Uninstall Istio using the same base params as installation
	params := buildIstioParams("uninstall")
	cmd := exec.Command(getIstioctlPath(), params...)
	if _, err := Run(cmd); err != nil {
		warnError(fmt.Errorf("failed to uninstall Istio: %w", err))
		return
	}

	// Delete the namespace and wait for completion
	cmd = exec.Command("kubectl", "delete", "namespace", istioNamespace, "--wait=true")
	if _, err := Run(cmd); err != nil {
		warnError(fmt.Errorf("failed to delete namespace %s: %w", istioNamespace, err))
		return
	}
}

// InstallIstio installs Istio with default configuration profile.
func InstallIstio() error {
	params := buildIstioParams("install")
	cmd := exec.Command(getIstioctlPath(), params...)
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("failed to install Istio: %w", err)
	}

	return nil
}

func InstallIstioIngressGateway(istioNamespace string) error {
	params := buildIstioIngressGatewayParams("install", istioNamespace)
	cmd := exec.Command(getIstioctlPath(), params...)
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("failed to install Istio ingress gateway: %w", err)
	}

	fmt.Println("Istio ingress gateway installation completed")
	return nil
}

// GetIstioNamespace detects which namespace Istio is installed in
// Returns the namespace name if Istio is found, empty string if not found
func GetIstioNamespace() string {
	// First check if Istio CRDs are present
	cmd := exec.Command("kubectl", "get", "crd", "gateways.networking.istio.io")
	if _, err := Run(cmd); err != nil {
		return ""
	}

	// Look for istiod deployments across all namespaces
	cmd = exec.Command("kubectl", "get", "deploy", "-A", "-l", "app=istiod",
		"-o", "jsonpath={.items[*].metadata.namespace}")
	output, err := Run(cmd)
	if err != nil {
		return ""
	}

	// Parse the output to get the first namespace found
	namespaces := GetNonEmptyLines(output)
	if len(namespaces) > 0 {
		// Split by spaces and take the first namespace
		namespaceList := strings.Fields(namespaces[0])
		if len(namespaceList) > 0 {
			return namespaceList[0]
		}
	}

	return ""
}

// WaitIstioAvailable waits for Istio to be available and running.
// Returns nil if Istio is ready, or an error if not ready within timeout.
func WaitIstioAvailable(istioNamespace string) error {
	// Wait for Istio control plane (istiod) pods to be ready
	cmd := exec.Command("kubectl", "wait",
		"--for=condition=Ready",
		"pods",
		"-l", "app=istiod",
		"-n", istioNamespace,
		"--timeout=300s")
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istiod pods not ready: %w", err)
	}

	// Check that the istiod service exists and is accessible
	cmd = exec.Command("kubectl", "get", "service", "istiod", "-n", istioNamespace, "-o", "jsonpath={.metadata.name}")
	if _, err := Run(cmd); err != nil {
		// Debug: show what services actually exist in the namespace
		debugCmd := exec.Command("kubectl", "get", "services", "-n", istioNamespace)
		debugOutput, _ := Run(debugCmd)
		return fmt.Errorf("istiod service not found in namespace %s. Available services:\n%s\nOriginal error: %w",
			istioNamespace, debugOutput, err)
	}

	// Check that the webhook configurations exist
	cmd = exec.Command("kubectl", "get", "mutatingwebhookconfiguration", "istio-sidecar-injector",
		"-o", "jsonpath={.metadata.name}")
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("istio webhook configuration not found: %w", err)
	}

	// Verify the webhook service endpoint is accessible and has endpoints
	cmd = exec.Command("kubectl", "get", "endpoints", "istiod", "-n", istioNamespace,
		"-o", "jsonpath={.subsets[*].addresses[*].ip}")
	endpointsOutput, err := Run(cmd)
	if err != nil {
		return fmt.Errorf("istiod service endpoints not accessible: %w", err)
	}
	if strings.TrimSpace(endpointsOutput) == "" {
		return fmt.Errorf("istiod service has no endpoints")
	}

	return nil
}

// WaitIstioIngressGatewayReady waits for istio-ingressgateway to be ready
func WaitIstioIngressGatewayReady(istioNamespace string) error {

	// Wait for Istio ingress gateway pods to be ready
	cmd := exec.Command("kubectl", "wait",
		"--for=condition=Ready",
		"pods",
		"-l", "app="+istioIngressGatewayName,
		"-n", istioNamespace,
		"--timeout=300s")
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("%s pods not ready: %w", istioIngressGatewayName, err)
	}

	return nil
}

// IsIstioInstalled checks if Istio is installed in the cluster
// Returns (isInstalled, namespace) where namespace is empty if not installed
func IsIstioInstalled() (bool, string) {

	// Detect the Istio namespace
	istioNamespace := GetIstioNamespace()
	if istioNamespace == "" {
		return false, ""
	}

	// Check if istiod deployment exists and is available in the detected namespace
	cmd := exec.Command("kubectl", "get", "deployment", "istiod", "-n", istioNamespace)
	if _, err := Run(cmd); err != nil {
		return false, ""
	}

	// Verify istioctl can communicate with the cluster
	cmd = exec.Command(getIstioctlPath(), "version", "--short", "--remote", "--istioNamespace="+istioNamespace)
	_, err := Run(cmd)
	if err != nil {
		return false, ""
	}

	return true, istioNamespace
}

// IsIstioIngressGatewayInstalled checks if istio-ingressgateway is installed
func IsIstioIngressGatewayInstalled(istioNamespace string) bool {
	if istioNamespace == "" {
		return false
	}

	cmd := exec.Command("kubectl", "get", "deployment",
		"-n", istioNamespace,
		istioIngressGatewayName,
		"--ignore-not-found")
	output, err := Run(cmd)
	if err != nil {
		return false
	}
	return strings.TrimSpace(output) != ""
}

// LabelNamespaceForIstioInjection labels a namespace for Istio sidecar injection
func LabelNamespaceForIstioInjection(namespace string) error {
	cmd := exec.Command("kubectl", "label", "namespace", namespace, "istio-injection=enabled", "--overwrite")
	_, err := Run(cmd)
	if err != nil {
		return fmt.Errorf("failed to label namespace %s for Istio injection: %w", namespace, err)
	}
	return nil
}
