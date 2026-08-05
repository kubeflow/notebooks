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

package logs

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type LogOptions struct {
	// The name of the container to retrieve logs from.
	// If omitted, defaults to the workspace's primary container (named "main").
	Container string
	// The number of lines to retrieve from the end of the logs.
	// By default, the value is 1000.
	TailLines int64
	// If true, returns logs from the previous terminated container instance.
	Previous bool
	// If specified, returns logs since the given time.
	SinceTime *metav1.Time
}
