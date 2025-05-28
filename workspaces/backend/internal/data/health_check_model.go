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

package data

type SystemInfo struct {
	Version string `json:"version"`
}

type HealthCheckModel struct {
	Status     string     `json:"status"`
	SystemInfo SystemInfo `json:"system_info"`
}

func (m HealthCheckModel) HealthCheck(version string) (HealthCheckModel, error) {

	var res = HealthCheckModel{
		Status: "available",
		SystemInfo: SystemInfo{
			Version: version,
		},
	}

	return res, nil
}
