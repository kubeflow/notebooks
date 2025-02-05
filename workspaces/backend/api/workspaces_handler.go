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
	"errors"
	"fmt"
	"net/http"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspaces"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspaces"
)

type WorkspaceCreateEnvelope Envelope[*models.WorkspaceCreate]

type WorkspaceListEnvelope Envelope[[]models.Workspace]

type WorkspaceEnvelope Envelope[models.Workspace]

func (a *App) GetWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), workspaceName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbGet,
			&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
					Name:      workspaceName,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspace, err := a.repositories.Workspace.GetWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceEnvelope{Data: workspace}
	a.dataResponse(w, r, responseEnvelope)
}

func (a *App) GetWorkspacesHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	// NOTE: namespace is optional, if not provided, we list all workspaces across all namespaces
	var valErrs field.ErrorList
	if namespace != "" {
		valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	}
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbList,
			&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	var workspaces []models.Workspace
	var err error
	if namespace == "" {
		workspaces, err = a.repositories.Workspace.GetAllWorkspaces(r.Context())
	} else {
		workspaces, err = a.repositories.Workspace.GetWorkspaces(r.Context(), namespace)
	}
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceListEnvelope{Data: workspaces}
	a.dataResponse(w, r, responseEnvelope)
}

func (a *App) CreateWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// validate the Content-Type header
	if success := a.ValidateContentType(w, r, "application/json"); !success {
		return
	}

	// decode the request body
	bodyEnvelope := &WorkspaceCreateEnvelope{}
	err := a.DecodeJSON(r, bodyEnvelope)
	if err != nil {
		a.badRequestResponse(w, r, fmt.Errorf("error decoding request body: %w", err))
		return
	}

	// validate the request body
	dataPath := field.NewPath("data")
	if bodyEnvelope.Data == nil {
		valErrs = field.ErrorList{field.Required(dataPath, "data is required")}
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}
	valErrs = bodyEnvelope.Data.Validate(dataPath)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgRequestBodyInvalid, valErrs, nil)
		return
	}

	workspaceCreate := bodyEnvelope.Data

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbCreate,
			&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
					Name:      workspaceCreate.Name,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	createdWorkspace, err := a.repositories.Workspace.CreateWorkspace(r.Context(), workspaceCreate, namespace)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceAlreadyExists) {
			a.conflictResponse(w, r, err)
			return
		}
		if apierrors.IsInvalid(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.failedValidationResponse(w, r, errMsgKubernetesValidation, nil, causes)
			return
		}
		a.serverErrorResponse(w, r, fmt.Errorf("error creating workspace: %w", err))
		return
	}

	// calculate the GET location for the created workspace (for the Location header)
	location := a.LocationGetWorkspace(namespace, createdWorkspace.Name)

	responseEnvelope := &WorkspaceCreateEnvelope{Data: createdWorkspace}
	a.createdResponse(w, r, responseEnvelope, location)
}

func (a *App) DeleteWorkspaceHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	namespace := ps.ByName(NamespacePathParam)
	workspaceName := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(NamespacePathParam), namespace)...)
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), workspaceName)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbDelete,
			&kubefloworgv1beta1.Workspace{
				ObjectMeta: metav1.ObjectMeta{
					Namespace: namespace,
					Name:      workspaceName,
				},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	err := a.repositories.Workspace.DeleteWorkspace(r.Context(), namespace, workspaceName)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	a.deletedResponse(w, r)
}
