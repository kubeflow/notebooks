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
	"bufio"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/onsi/ginkgo/v2"
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

// PortForward represents a running port-forward session
type PortForward struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
}

// Stop stops the port-forward session
func (pf *PortForward) Stop() {
	if pf.cancel != nil {
		pf.cancel()
	}
	if pf.cmd != nil && pf.cmd.Process != nil {
		_ = pf.cmd.Process.Kill()
	}
}

// StartPortForward starts a port-forward to a service in the background.
// Returns a PortForward handle that can be used to stop the port-forward.
// The port-forward is considered ready when it starts listening (output contains "Forwarding from").
func StartPortForward(namespace, service, ports string, readyTimeout time.Duration) (*PortForward, error) {
	ctx, cancel := context.WithCancel(context.Background())

	cmd := exec.CommandContext(ctx, "kubectl", "port-forward",
		"-n", namespace,
		"service/"+service,
		ports,
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return nil, fmt.Errorf("failed to start port-forward: %w", err)
	}

	pf := &PortForward{cmd: cmd, cancel: cancel}

	// Monitor stdout for ready signal
	readyChan := make(chan error, 1)
	go func() {
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			_, _ = fmt.Fprintf(ginkgo.GinkgoWriter, "port-forward stdout: %s\n", line)
			if strings.Contains(line, "Forwarding from") {
				readyChan <- nil
				return
			}
		}
		if err := scanner.Err(); err != nil {
			readyChan <- fmt.Errorf("error reading stdout: %w", err)
		}
	}()

	// Log stderr in background
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			_, _ = fmt.Fprintf(ginkgo.GinkgoWriter, "port-forward stderr: %s\n", scanner.Text())
		}
	}()

	// Wait for ready signal or timeout
	select {
	case err := <-readyChan:
		if err != nil {
			pf.Stop()
			return nil, fmt.Errorf("port-forward failed to become ready: %w", err)
		}
		_, _ = fmt.Fprintf(ginkgo.GinkgoWriter, "port-forward is ready\n")
		return pf, nil
	case <-time.After(readyTimeout):
		pf.Stop()
		return nil, fmt.Errorf("port-forward did not become ready within %v", readyTimeout)
	}
}
