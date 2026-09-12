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

	"github.com/onsi/ginkgo/v2"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"sigs.k8s.io/yaml"
)

func warnError(err error) {
	_, _ = fmt.Fprintf(ginkgo.GinkgoWriter, "warning: %v\n", err)
}

// Run executes the provided command within this context
func Run(cmd *exec.Cmd) (string, error) {
	dir, _ := GetProjectDir()
	cmd.Dir = dir

	if err := os.Chdir(cmd.Dir); err != nil {
		_, _ = fmt.Fprintf(ginkgo.GinkgoWriter, "chdir dir: %s\n", err)
	}

	cmd.Env = append(os.Environ(), "GO111MODULE=on")
	command := strings.Join(cmd.Args, " ")
	_, _ = fmt.Fprintf(ginkgo.GinkgoWriter, "running: %s\n", command)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("%s failed with error: (%w) %s", command, err, string(output))
	}

	return string(output), nil
}

// GetNonEmptyLines converts given command output string into individual objects
// according to line breakers, and ignores the empty elements in it.
func GetNonEmptyLines(output string) []string {
	var res []string
	elements := strings.SplitSeq(output, "\n")
	for element := range elements {
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
	wd = strings.ReplaceAll(wd, "/test/utils", "")
	return wd, nil
}

// RenderActivityWorkspaceKind reads the sample WorkspaceKind manifest and returns a copy with its
// metadata.name overridden to newName. The activityProbe and activityRules are left untouched here
// and are expected to be patched by the caller to enable fast activity pause behavior for the e2e test.
func RenderActivityWorkspaceKind(samplePath, newName string) (string, error) {
	data, err := os.ReadFile(samplePath)
	if err != nil {
		return "", fmt.Errorf("failed to read sample WorkspaceKind %q: %w", samplePath, err)
	}

	var obj unstructured.Unstructured
	if err := yaml.Unmarshal(data, &obj.Object); err != nil {
		return "", fmt.Errorf("failed to unmarshal sample WorkspaceKind %q: %w", samplePath, err)
	}

	obj.SetName(newName)

	out, err := yaml.Marshal(obj.Object)
	if err != nil {
		return "", fmt.Errorf("failed to marshal modified WorkspaceKind %q: %w", samplePath, err)
	}

	return string(out), nil
}

// GetWorkspaceJSONPath runs `kubectl get workspace <name> -n <namespace> -o jsonpath=<path>`
// and returns the (trimmed) value. It is a small convenience wrapper used by e2e assertions
// that repeatedly read individual Workspace status fields.
func GetWorkspaceJSONPath(name, namespace, jsonPath string) (string, error) {
	cmd := exec.Command("kubectl", "get", "workspaces", name,
		"-n", namespace, "-o", "jsonpath="+jsonPath)
	out, err := Run(cmd)
	return strings.TrimSpace(out), err
}

// RenderActivityWorkspace reads the sample Workspace manifest and returns a copy with its
// metadata.name overridden to newName and spec.kind overridden to newKind.
func RenderActivityWorkspace(samplePath, newName, newKind string) (string, error) {
	data, err := os.ReadFile(samplePath)
	if err != nil {
		return "", fmt.Errorf("failed to read sample Workspace %q: %w", samplePath, err)
	}

	var obj unstructured.Unstructured
	if err := yaml.Unmarshal(data, &obj.Object); err != nil {
		return "", fmt.Errorf("failed to unmarshal sample Workspace %q: %w", samplePath, err)
	}

	obj.SetName(newName)
	if err := unstructured.SetNestedField(obj.Object, newKind, "spec", "kind"); err != nil {
		return "", fmt.Errorf("failed to set spec.kind in sample Workspace %q: %w", samplePath, err)
	}

	out, err := yaml.Marshal(obj.Object)
	if err != nil {
		return "", fmt.Errorf("failed to marshal modified Workspace %q: %w", samplePath, err)
	}

	return string(out), nil
}
