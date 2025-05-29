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

package localdev

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	stdruntime "runtime"
	"strings"

	"k8s.io/apimachinery/pkg/api/resource"

	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"sigs.k8s.io/controller-runtime/pkg/client"
	"sigs.k8s.io/controller-runtime/pkg/log"
	"sigs.k8s.io/yaml"
)

// --- Helper Functions for Pointers ---
func stringPtr(s string) *string { return &s }
func boolPtr(b bool) *bool       { return &b }

// --- Specialized Functions for Resource Creation ---

func createNamespace(ctx context.Context, cl client.Client, namespaceName string) error {
	logger := log.FromContext(ctx).WithName("create-namespace")
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{Name: namespaceName},
	}
	logger.Info("Creating namespace", "name", namespaceName)
	if err := cl.Create(ctx, ns); err != nil {
		if !apierrors.IsAlreadyExists(err) {
			logger.Error(err, "Failed to create namespace", "name", namespaceName)
			return fmt.Errorf("failed to create namespace %s: %w", namespaceName, err)
		}
		logger.Info("Namespace already exists", "name", namespaceName)
	}
	return nil
}

func loadAndCreateWorkspaceKindsFromDir(ctx context.Context, cl client.Client,
	dirPath string) ([]kubefloworgv1beta1.WorkspaceKind, error) {
	logger := log.FromContext(ctx).WithName("load-create-workspacekinds")
	logger.Info("Loading WorkspaceKind YAMLs from", "path", dirPath)

	absDirPath, err := filepath.Abs(dirPath)
	if err != nil {
		logger.Error(err, "Failed to get absolute path for dirPath", "path", dirPath)
		return nil, fmt.Errorf("failed to get absolute path for dirPath %s: %w", dirPath, err)
	}
	absDirPath = filepath.Clean(absDirPath)

	yamlFiles, err := filepath.Glob(filepath.Join(absDirPath, "*.yaml")) // Use *.yaml to get all YAML files
	if err != nil {
		logger.Error(err, "Failed to glob WorkspaceKind YAML files", "path", dirPath)
		return nil, fmt.Errorf("failed to glob WorkspaceKind YAML files in %s: %w", dirPath, err)
	}
	if len(yamlFiles) == 0 {
		logger.Info("No WorkspaceKind YAML files found in", "path", dirPath)
		return []kubefloworgv1beta1.WorkspaceKind{}, nil // Return empty slice, not an error
	}

	var successfullyCreatedWKs []kubefloworgv1beta1.WorkspaceKind
	for _, yamlFile := range yamlFiles {
		logger.Info("Processing WorkspaceKind from file", "file", yamlFile)

		absYamlFile, err := filepath.Abs(yamlFile)
		if err != nil {
			logger.Error(err, "Failed to get absolute path for yaml file", "file", yamlFile)
			continue
		}
		absYamlFile = filepath.Clean(absYamlFile)

		if !strings.HasPrefix(absYamlFile, absDirPath) {
			errUnsafePath := fmt.Errorf("unsafe file path: resolved file '%s' is outside allowed directory '%s'",
				absYamlFile, absDirPath)
			logger.Error(errUnsafePath, "Skipping potentially unsafe file", "original_file",
				yamlFile)
			continue
		}

		yamlContent, errReadFile := os.ReadFile(absYamlFile)
		if errReadFile != nil {
			logger.Error(errReadFile, "Failed to read WorkspaceKind YAML file", "file", yamlFile)
			continue // Skip this file
		}

		var wk kubefloworgv1beta1.WorkspaceKind
		errUnmarshal := yaml.UnmarshalStrict(yamlContent, &wk)
		if errUnmarshal != nil {
			logger.Error(errUnmarshal, "Failed to unmarshal YAML to WorkspaceKind", "file", yamlFile)
			continue // Skip this file
		}
		if wk.Name == "" {
			logger.Error(errors.New("WorkspaceKind has no name"), "Skipping creation for file",
				"file", yamlFile)
			continue
		}

		logger.Info("Attempting to create/verify WorkspaceKind in API server", "name", wk.GetName())
		errCreate := cl.Create(ctx, &wk)
		if errCreate != nil {
			if apierrors.IsAlreadyExists(errCreate) {
				logger.Info("WorkspaceKind already exists in API server. Fetching it.", "name",
					wk.GetName())
				var existingWk kubefloworgv1beta1.WorkspaceKind
				if errGet := cl.Get(ctx, client.ObjectKey{Name: wk.Name}, &existingWk); errGet == nil {
					successfullyCreatedWKs = append(successfullyCreatedWKs, existingWk)
				} else {
					logger.Error(errGet, "WorkspaceKind already exists but failed to GET it", "name",
						wk.GetName())
				}
			} else {
				logger.Error(errCreate, "Failed to create WorkspaceKind in API server", "name",
					wk.GetName(), "file", yamlFile)
			}
		} else {
			logger.Info("Successfully created WorkspaceKind in API server", "name", wk.GetName())
			successfullyCreatedWKs = append(successfullyCreatedWKs, wk)
		}
	}
	logger.Info("Finished processing WorkspaceKind YAML files.", "successfully_processed_count",
		len(successfullyCreatedWKs))
	return successfullyCreatedWKs, nil
}

func extractConfigIDsFromWorkspaceKind(ctx context.Context,
	wkCR *kubefloworgv1beta1.WorkspaceKind) (imageConfigID string, podConfigID string, err error) {
	logger := log.FromContext(ctx).WithName("extract-config-ids").WithValues("workspaceKindName",
		wkCR.Name)

	// --- Handle ImageConfig ---
	imageConf := wkCR.Spec.PodTemplate.Options.ImageConfig
	if imageConf.Spawner.Default != "" {
		imageConfigID = imageConf.Spawner.Default
	} else {
		logger.V(1).Info("No default imageConfig found in Spawner. Trying first available from 'Values'.")
		if len(imageConf.Values) > 0 {
			imageConfigID = imageConf.Values[0].Id // Ensure .ID matches your struct field name
		} else {
			err = fmt.Errorf("WorkspaceKind '%s' has no suitable imageConfig options "+
				"(no Spawner.Default and no Values)", wkCR.Name)
			logger.Error(err, "Cannot determine imageConfigID.")
			return "", "", err // Return error if no ID could be found
		}
	}

	// --- Handle PodConfig ---
	podConf := wkCR.Spec.PodTemplate.Options.PodConfig
	if podConf.Spawner.Default != "" {
		podConfigID = podConf.Spawner.Default
	} else {
		logger.V(1).Info("No default podConfig found in Spawner. Trying first available from 'Values'.")
		if len(podConf.Values) > 0 {
			podConfigID = podConf.Values[0].Id // Ensure .ID matches your struct field name
		} else {
			err = fmt.Errorf("WorkspaceKind '%s' has no suitable podConfig options "+
				"(no Spawner.Default and no Values)", wkCR.Name)
			logger.Error(err, "Cannot determine podConfigID.")
			return imageConfigID, "", err
		}
	}
	logger.V(1).Info("Determined config IDs", "imageConfigID", imageConfigID, "podConfigID",
		podConfigID)
	return imageConfigID, podConfigID, nil
}

// createPVC creates a PersistentVolumeClaim with a default size and access mode.
func createPVC(ctx context.Context, cl client.Client, namespace, pvcName string) error {
	logger := log.FromContext(ctx).WithName("create-pvc")

	pvc := &corev1.PersistentVolumeClaim{
		ObjectMeta: metav1.ObjectMeta{
			Name:      pvcName,
			Namespace: namespace,
		},
		Spec: corev1.PersistentVolumeClaimSpec{
			AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
			Resources: corev1.VolumeResourceRequirements{
				Requests: corev1.ResourceList{
					// Defaulting storage size. This can be parameterized if needed.
					corev1.ResourceStorage: resource.MustParse("10Gi"),
				},
			},
		},
	}

	logger.Info("Creating PersistentVolumeClaim", "name", pvcName, "namespace", namespace)
	if err := cl.Create(ctx, pvc); err != nil {
		if !apierrors.IsAlreadyExists(err) {
			logger.Error(err, "Failed to create PersistentVolumeClaim", "name", pvcName, "namespace", namespace)
			return fmt.Errorf("failed to create PVC %s in namespace %s: %w", pvcName, namespace, err)
		}
		logger.Info("PersistentVolumeClaim already exists", "name", pvcName, "namespace", namespace)
	}
	return nil
}

func createWorkspacesForKind(ctx context.Context, cl client.Client, namespaceName string,
	wkCR *kubefloworgv1beta1.WorkspaceKind, instancesPerKind int) error {
	logger := log.FromContext(ctx).WithName("create-workspaces").WithValues("workspaceKindName",
		wkCR.Name)
	logger.Info("Preparing to create Workspaces")

	imageConfigID, podConfigID, err := extractConfigIDsFromWorkspaceKind(ctx, wkCR)
	if err != nil {
		return fmt.Errorf("skipping workspace creation for %s due to config ID extraction error: %w",
			wkCR.Name, err)
	}

	for i := 1; i <= instancesPerKind; i++ {
		workspaceName := fmt.Sprintf("%s-ws-%d", wkCR.Name, i)
		homePVCName := fmt.Sprintf("%s-homevol", workspaceName)
		dataPVCName := fmt.Sprintf("%s-datavol", workspaceName)

		// Create the required PVCs before creating the Workspace
		if err := createPVC(ctx, cl, namespaceName, homePVCName); err != nil {
			logger.Error(err, "Failed to create home PVC for workspace, skipping workspace creation",
				"workspaceName", workspaceName, "pvcName", homePVCName)
			continue // Skip this workspace instance
		}
		if err := createPVC(ctx, cl, namespaceName, dataPVCName); err != nil {
			logger.Error(err, "Failed to create data PVC for workspace, skipping workspace creation",
				"workspaceName", workspaceName, "pvcName", dataPVCName)
			continue // Skip this workspace instance
		}

		ws := newWorkspace(workspaceName, namespaceName, wkCR.Name, imageConfigID, podConfigID, i)

		logger.Info("Attempting to create Workspace in API server", "name", ws.Name, "namespace",
			ws.Namespace)
		if errCreateWS := cl.Create(ctx, ws); errCreateWS != nil {
			if apierrors.IsAlreadyExists(errCreateWS) {
				logger.Info("Workspace already exists", "name", ws.Name, "namespace", ws.Namespace)
			} else {
				logger.Error(errCreateWS, "Failed to create Workspace in API server", "name",
					ws.Name, "namespace", ws.Namespace)
				// Optionally, collect errors and return them at the end, or return on first error
			}
		} else {
			logger.Info("Successfully created Workspace in API server", "name",
				ws.Name, "namespace", ws.Namespace)
		}
	}
	return nil
}

// newWorkspace is a helper function to construct a Workspace object
func newWorkspace(name, namespace, workspaceKindName, imageConfigID string, podConfigID string,
	instanceNumber int) *kubefloworgv1beta1.Workspace {
	// PVC names will be unique based on the workspace name
	homePVCName := fmt.Sprintf("%s-homevol", name) // Example naming for home PVC
	dataPVCName := fmt.Sprintf("%s-datavol", name) // Example naming for data PVC

	return &kubefloworgv1beta1.Workspace{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: namespace,
			Labels: map[string]string{
				"app.kubernetes.io/name":       name,
				"app.kubernetes.io/instance":   fmt.Sprintf("%s-%d", workspaceKindName, instanceNumber),
				"app.kubernetes.io/created-by": "envtest-initial-resources",
			},
			Annotations: map[string]string{
				"description": fmt.Sprintf("Workspace instance #%d for %s", instanceNumber, workspaceKindName),
			},
		},
		Spec: kubefloworgv1beta1.WorkspaceSpec{
			Paused:       boolPtr(true),     // Workspace starts in a paused state
			DeferUpdates: boolPtr(false),    // Default value
			Kind:         workspaceKindName, // Link to the WorkspaceKind CR
			PodTemplate: kubefloworgv1beta1.WorkspacePodTemplate{ // Assuming PodTemplate is a pointer
				PodMetadata: &kubefloworgv1beta1.WorkspacePodMetadata{ // Assuming PodMetadata is a pointer
					Labels:      map[string]string{"user-label": "example-value"},
					Annotations: map[string]string{"user-annotation": "example-value"},
				},
				Volumes: kubefloworgv1beta1.WorkspacePodVolumes{ // Assuming Volumes is a pointer
					Home: stringPtr(homePVCName), // Assuming Home is *string
					Data: []kubefloworgv1beta1.PodVolumeMount{ // Data is likely []DataVolume
						{
							PVCName:   dataPVCName, // Assuming PVCName is string
							MountPath: "/data/user-data",
							ReadOnly:  boolPtr(false),
						},
					},
				},
				Options: kubefloworgv1beta1.WorkspacePodOptions{ // Assuming Options is a pointer
					ImageConfig: imageConfigID,
					PodConfig:   podConfigID,
				},
			},
		},
	}
}

// createInitialResources creates namespaces, WorkspaceKinds, and Workspaces.
func createInitialResources(ctx context.Context, cl client.Client) error {
	logger := log.FromContext(ctx).WithName("create-initial-resources")

	// Configurations
	namespaceName := "envtest-ns"
	_, currentFile, _, ok := stdruntime.Caller(0)
	if !ok {
		err := errors.New("failed to get current file path using stdruntime.Caller")
		logger.Error(err, "Cannot determine testdata directory path")
		return err
	}
	testFileDir := filepath.Dir(currentFile)
	workspaceKindsTestDataDir := filepath.Join(testFileDir, "testdata")
	numWorkspacesPerKind := 3

	// 1. Create Namespace
	logger.Info("Creating namespace", "name", namespaceName)
	if err := createNamespace(ctx, cl, namespaceName); err != nil {
		logger.Error(err, "Failed during namespace creation step")
		return err // Assuming namespace is critical
	}
	logger.Info("Namespace step completed.")

	// 2. Create WorkspaceKinds
	logger.Info("Loading and Creating WorkspaceKinds from", "directory", workspaceKindsTestDataDir)
	successfullyCreatedWKs, err := loadAndCreateWorkspaceKindsFromDir(ctx, cl, workspaceKindsTestDataDir)
	if err != nil {
		logger.Error(err, "Failed during WorkspaceKind processing step")
		return err // Assuming WorkspaceKinds are critical
	}
	if len(successfullyCreatedWKs) == 0 {
		logger.Info("No WorkspaceKinds were loaded or created. Will not proceed")
		return errors.New("no WorkspaceKinds were loaded or created")
	} else {
		logger.Info("WorkspaceKind processing step completed.",
			"successfully_processed_count", len(successfullyCreatedWKs))
	}

	// Step 3: Create Workspaces for each successfully processed Kind
	logger.Info("Step 3: Creating Workspaces")
	if len(successfullyCreatedWKs) > 0 {
		for _, wkCR := range successfullyCreatedWKs {
			kindSpecificLogger := logger.WithValues("workspaceKind", wkCR.Name)
			kindSpecificCtx := log.IntoContext(ctx, kindSpecificLogger)

			if err := createWorkspacesForKind(kindSpecificCtx, cl, namespaceName, &wkCR, numWorkspacesPerKind); err != nil {
				kindSpecificLogger.Error(err,
					"Failed to create all workspaces for this kind. Continuing with other kinds if any.")
			}
		}
	} else {
		logger.Info("Skipping Workspace creation as no WorkspaceKinds are available.")
	}

	logger.Info("Initial resources setup process completed.")
	return nil
}
