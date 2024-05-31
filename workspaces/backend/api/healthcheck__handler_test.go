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

package api

import (
	"encoding/json"
	"github.com/kubeflow/notebooks/workspaces/backend/config"
	"github.com/kubeflow/notebooks/workspaces/backend/data"
	"github.com/stretchr/testify/assert"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthCheckHandler(t *testing.T) {

	app := App{config: config.EnvConfig{
		Port: 4000,
	}}

	rr := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, HealthCheckPath, nil)
	if err != nil {
		t.Fatal(err)
	}

	app.HealthcheckHandler(rr, req, nil)
	rs := rr.Result()

	defer rs.Body.Close()

	body, err := io.ReadAll(rs.Body)
	if err != nil {
		t.Fatal("Failed to read response body")
	}

	var healthCheckRes data.HealthCheckModel
	err = json.Unmarshal(body, &healthCheckRes)
	if err != nil {
		t.Fatalf("Error unmarshalling response JSON: %v", err)
	}

	expected := data.HealthCheckModel{
		Status: "available",
		SystemInfo: data.SystemInfo{
			Version: Version,
		},
	}

	assert.Equal(t, expected, healthCheckRes)
}
