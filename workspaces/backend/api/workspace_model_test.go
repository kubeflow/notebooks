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
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/julienschmidt/httprouter"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/config"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/data"
	"github.com/kubeflow/notebooks/workspaces/backend/test"
	"github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	"github.com/stretchr/testify/assert"
	"sigs.k8s.io/controller-runtime/pkg/client"
)

func TestWorkspaceHandler(t *testing.T) {
	namespace := "workspace-test"

	// Initialize gomock controller
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	//setup mock client
	mockClient := test.NewMockClient(ctrl)

	expectedListOptions := []client.ListOption{
		client.InNamespace(namespace),
	}
	workspaceList := &v1beta1.WorkspaceList{
		Items: test.GetMockWorkspaces(),
	}

	mockClient.EXPECT().
		List(
			gomock.Any(),
			gomock.AssignableToTypeOf(&v1beta1.WorkspaceList{}),
			gomock.Eq(expectedListOptions[0]),
		).
		DoAndReturn(func(ctx context.Context, list client.ObjectList, opts ...client.ListOption) error {
			wl := list.(*v1beta1.WorkspaceList)
			wl.Items = workspaceList.Items
			return nil
		})

	// Initialize the App with the mock client
	a := App{
		Config: config.EnvConfig{
			Port: 4000,
		},
		Client: mockClient,
		models: data.Models{
			Workspace: data.WorkspaceModel{},
		},
	}

	// Create the HTTP request
	req, err := http.NewRequest(http.MethodGet, WorkspacesPath+"/"+namespace+"/workspaces", nil)
	if err != nil {
		t.Fatal(err)
	}
	ps := httprouter.Params{
		httprouter.Param{
			Key:   NamespacePathParam,
			Value: namespace,
		},
	}

	// Create Request and response recorder
	rr := httptest.NewRecorder()
	a.GetWorkspaceHandler(rr, req, ps)
	rs := rr.Result()
	defer rs.Body.Close()

	body, err := io.ReadAll(rs.Body)
	if err != nil {
		t.Fatal("Failed to read response body")
	}

	// Unmarshal the response
	var response Envelope
	err = json.Unmarshal(body, &response)
	if err != nil {
		t.Fatalf("Error unmarshalling response JSON: %v", err)
	}
	workspacesData, ok := response["workspaces"]
	if !ok {
		t.Fatalf("Response does not contain 'workspaces' key")
	}

	// Convert to JSON and back to []WorkspaceModel
	workspacesJSON, err := json.Marshal(workspacesData)
	if err != nil {
		t.Fatalf("Error marshalling workspaces data: %v", err)
	}

	var workspaces []data.WorkspaceModel
	err = json.Unmarshal(workspacesJSON, &workspaces)
	if err != nil {
		t.Fatalf("Error unmarshalling workspaces JSON: %v", err)
	}

	// Assert expected results
	expectedWorkspaces := test.GetExpectedWorkspaceModels()

	assert.ElementsMatch(t, expectedWorkspaces, workspaces)

}
