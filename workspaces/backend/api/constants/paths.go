// Copyright 2024.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package constants

const (
	PathPrefix = "/api/v1"

	NamespacePathParam    = "namespace"
	ResourceNamePathParam = "name"

	// healthcheck
	HealthCheckPath = PathPrefix + "/healthcheck"

	// workspaces
	AllWorkspacesPath               = PathPrefix + "/workspaces"
	WorkspacesByNamespacePath       = AllWorkspacesPath + "/:" + NamespacePathParam
	WorkspacesByNamePath            = AllWorkspacesPath + "/:" + NamespacePathParam + "/:" + ResourceNamePathParam
	WorkspaceActionsPath            = WorkspacesByNamePath + "/actions"
	PauseWorkspacePath              = WorkspaceActionsPath + "/pause"
	WorkspacePodTemplateDetailsPath = WorkspacesByNamePath + "/podtemplate/details"

	// workspacekinds
	AllWorkspaceKindsPath            = PathPrefix + "/workspacekinds"
	WorkspaceKindsByNamePath         = AllWorkspaceKindsPath + "/:" + ResourceNamePathParam
	PodTemplateOptionsListValuesPath = WorkspaceKindsByNamePath + "/podtemplate/options/listvalues"
	WorkspaceKindsAssetsPath         = WorkspaceKindsByNamePath + "/assets"
	WorkspaceKindIconPath            = WorkspaceKindsAssetsPath + "/icon"
	WorkspaceKindLogoPath            = WorkspaceKindsAssetsPath + "/logo"

	// namespaces
	AllNamespacesPath = PathPrefix + "/namespaces"

	// secrets
	SecretsByNamespacePath = PathPrefix + "/secrets/:" + NamespacePathParam
	SecretsByNamePath      = SecretsByNamespacePath + "/:" + ResourceNamePathParam

	// storageclasses
	AllStorageClassesPath = PathPrefix + "/storageclasses"

	// persistentvolumeclaims
	PVCsByNamespacePath = PathPrefix + "/persistentvolumeclaims/:" + NamespacePathParam
	PVCsByNamePath      = PVCsByNamespacePath + "/:" + ResourceNamePathParam

	// swagger
	SwaggerPath = PathPrefix + "/swagger/*any"
)
