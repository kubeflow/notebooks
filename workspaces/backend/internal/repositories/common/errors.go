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

// Package common holds values shared between repositories.
//
// Sentinel errors live here when more than one repository can return them, so that callers
// have a single value to match with errors.Is. Sentinels raised by exactly one repository
// stay in that repository's own package.
package common

import "errors"

// ErrWorkspaceNotFound is returned when a Workspace does not exist.
var ErrWorkspaceNotFound = errors.New("workspace not found")

// ErrWorkspacePodNotRunning is returned when a workspace pod is not running.
var ErrWorkspacePodNotRunning = errors.New("workspace pod is not running")
