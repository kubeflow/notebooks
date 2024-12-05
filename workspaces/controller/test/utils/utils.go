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
	"strings"

	. "github.com/onsi/ginkgo/v2" //nolint:golint
)

const (

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
