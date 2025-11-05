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
	"encoding/json"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

const (
	istioRevision                     = "default"
	istioNamespace                    = "istio-system"
	istioIngressGatewayName           = "istio-ingressgateway"
	istioIngressGatewayServiceAccount = "istio-ingressgateway-service-account"
)

// getIstioctlPath returns the path to the istioctl binary from the project's bin directory
func getIstioctlPath() string {
	projectDir, _ := GetProjectDir()
	return filepath.Join(projectDir, "bin", "istioctl")
}

// buildIstioDefaultParams creates parameter arrays for istioctl commands to ensure install/uninstall mirror each other
func buildIstioParams(command string) []string {
	var istioBaseParams = []string{
		"--set", "profile=" + istioRevision,
		"--revision=" + istioRevision,
		"-y",
	}

	params := make([]string, 0, len(istioBaseParams)+2)
	params = append(params, command)
	params = append(params, istioBaseParams...)

	// Add command-specific flags
	switch command {
	case "install":
		params = append(params, "--verify")
	case "uninstall":
		params = append(params, "--purge")
	}

	return params
}

// isIstioCRDsInstalled checks if Istio gateways CRD is installed in the cluster as a proxy for
// detecting istio installation
func IsIstioCRDsInstalled() bool {
	// List of common Istio CRDs
	istioCRDs := []string{
		"authorizationpolicies.security.istio.io",
		"destinationrules.networking.istio.io",
		"envoyfilters.networking.istio.io",
		"gateways.networking.istio.io",
		"peerauthentications.security.istio.io",
		"virtualservices.networking.istio.io",
	}

	// Execute the kubectl command to get all CRDs
	cmd := exec.Command("kubectl", "get", "crds", "-o", "name")
	output, err := Run(cmd)
	if err != nil {
		return false
	}

	// Check if any of the Istio CRDs are present
	crdList := GetNonEmptyLines(output)
	for _, crd := range istioCRDs {
		for _, line := range crdList {
			if strings.Contains(line, crd) {
				return true
			}
		}
	}

	return false
}

// verifyIstioVersionOutput validates a single version slice has exactly one element
func verifyIstioVersionOutput(versionSlice []interface{}, fieldName string) error {
	if versionSlice == nil || len(versionSlice) != 1 {
		return fmt.Errorf("istioctl version '%s' array must have exactly one element, got %d",
			fieldName,
			func() int {
				if versionSlice == nil {
					return 0
				} else {
					return len(versionSlice)
				}
			}())
	}
	return nil
}

// InstallIstio installs Istio with default configuration profile.
// Note: this also leverages the --verify flag to verify the installation is successful
func InstallIstio() error {
	params := buildIstioParams("install")
	cmd := exec.Command(getIstioctlPath(), params...)
	if _, err := Run(cmd); err != nil {
		return fmt.Errorf("failed to install Istio: %w", err)
	}

	return nil
}

// WaitIstioAvailable waits for Istio to be validated and available for use.
// Returns nil if Istio is ready, or an error if not ready within timeout or if validation fails.
func WaitIstioAvailable() error {
	// Verify istioctl can communicate with the cluster
	cmd := exec.Command(getIstioctlPath(), "version",
		"--revision="+istioRevision,
		"--istioNamespace="+istioNamespace,
		"--remote",
		"--output=json")
	output, err := Run(cmd)
	if err != nil {
		return err
	}

	// IstioVersionInfo represents the structure of istioctl version command output
	// Note: this is not a comprehensive validation of the version output, but a basic validation to ensure the output
	// matches expectations of e2e tests.
	type IstioVersionInfo struct {
		ClientVersion    map[string]interface{} `json:"clientVersion"`
		MeshVersion      []interface{}          `json:"meshVersion"`
		DataPlaneVersion []interface{}          `json:"dataPlaneVersion"`
	}

	// Try to parse output as JSON - if it fails, stderr was likely included in combined output from Run command
	var versionInfo IstioVersionInfo
	if err := json.Unmarshal([]byte(output), &versionInfo); err != nil {
		// JSON parsing failed, likely due to stderr output being included
		// which indicates Istio is not installed
		return fmt.Errorf("istioctl version command output cannot be parsed as JSON. "+
			"Assuming Istio is not installed. Output: %s", output)
	}

	// Validate (lightly) the version output matches expected structure
	if err := verifyIstioVersionOutput(versionInfo.MeshVersion, "meshVersion"); err != nil {
		return err
	}

	// Verify the ingressgateway deployment exists and has the correct service account
	cmd = exec.Command("kubectl", "get", "deployment",
		"-n", istioNamespace,
		istioIngressGatewayName,
		"-o", "jsonpath={.spec.template.spec.serviceAccount}")
	actualIngressGatewayServiceAccount, err := Run(cmd)
	if err != nil {
		return fmt.Errorf("istio ingress gateway deployment not found: %w", err)
	}

	if actualIngressGatewayServiceAccount != istioIngressGatewayServiceAccount {
		return fmt.Errorf("istio ingress gateway service account is not %s, got %s",
			istioIngressGatewayServiceAccount, actualIngressGatewayServiceAccount)
	}

	// Verify the ingressgateway service is exists
	cmd = exec.Command("kubectl", "get", "service",
		"-n", istioNamespace,
		istioIngressGatewayName)
	_, err = Run(cmd)
	if err != nil {
		return fmt.Errorf("istio ingress gateway service not found: %w", err)
	}

	// Verify the webhook service is accessible and has endpoints
	cmd = exec.Command("kubectl", "get", "endpoints", "istiod", "-n", istioNamespace,
		"-o", "jsonpath={.subsets[*].addresses[*].ip}")
	endpointsOutput, err := Run(cmd)
	if err != nil {
		return fmt.Errorf("istiod service endpoints not accessible: %w", err)
	}
	if strings.TrimSpace(endpointsOutput) == "" {
		return fmt.Errorf("istiod service has no endpoints")
	}

	// Verify the ingressgateway service is accessible and has endpoints
	cmd = exec.Command("kubectl", "get", "endpoints", istioIngressGatewayName, "-n", istioNamespace,
		"-o", "jsonpath={.subsets[*].addresses[*].ip}")
	endpointsOutput, err = Run(cmd)
	if err != nil {
		return fmt.Errorf("%s service endpoints not accessible: %w", istioIngressGatewayName, err)
	}
	if strings.TrimSpace(endpointsOutput) == "" {
		return fmt.Errorf("%s service has no endpoints", istioIngressGatewayName)
	}

	return nil
}

func UninstallIstio() {
	// Uninstall Istio using the same base params as installation
	// Note: this uses the --purge flag to delete all Istio related sources for all versions
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

// LabelNamespaceForIstioInjection labels a namespace for Istio sidecar injection
func LabelNamespaceForIstioInjection(namespace string) error {
	cmd := exec.Command("kubectl", "label", "namespace", namespace, "istio-injection=enabled", "--overwrite")
	_, err := Run(cmd)
	if err != nil {
		return fmt.Errorf("failed to label namespace %s for Istio injection: %w", namespace, err)
	}
	return nil
}
