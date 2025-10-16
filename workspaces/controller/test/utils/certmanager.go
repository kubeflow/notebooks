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
	"strings"
)

const (
	// use LTS version of cert-manager
	certManagerVersion = "v1.12.13"
	certManagerURLTmpl = "https://github.com/jetstack/cert-manager/releases/download/%s/cert-manager.yaml"
)

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
