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
	"io"
	"net/http"

	"github.com/julienschmidt/httprouter"
	kubefloworgv1beta1 "github.com/kubeflow/notebooks/workspaces/controller/api/v1beta1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/kubeflow/notebooks/workspaces/backend/internal/auth"
	"github.com/kubeflow/notebooks/workspaces/backend/internal/helper"
	models "github.com/kubeflow/notebooks/workspaces/backend/internal/models/workspacekinds"
	repository "github.com/kubeflow/notebooks/workspaces/backend/internal/repositories/workspacekinds"
)

type WorkspaceKindListEnvelope Envelope[[]models.WorkspaceKind]

type WorkspaceKindEnvelope Envelope[models.WorkspaceKind]

// cachedRestrictedScheme holds the pre-built runtime scheme that only knows about WorkspaceKind.
var cachedRestrictedScheme *runtime.Scheme

// cachedUniversalDeserializer holds the pre-built universal deserializer for the restricted scheme.
var cachedUniversalDeserializer runtime.Decoder

// cachedExpectedGVK holds the expected GVK for WorkspaceKind, derived programmatically.
var cachedExpectedGVK schema.GroupVersionKind

// init builds the restricted scheme and deserializer once at package initialization time.
func init() {
	restrictedScheme := runtime.NewScheme()
	if err := kubefloworgv1beta1.AddToScheme(restrictedScheme); err != nil {
		panic(fmt.Sprintf("failed to add WorkspaceKind types to restricted scheme: %v", err))
	}
	cachedRestrictedScheme = restrictedScheme

	codecs := serializer.NewCodecFactory(cachedRestrictedScheme)
	cachedUniversalDeserializer = codecs.UniversalDeserializer()

	workspaceKind := &kubefloworgv1beta1.WorkspaceKind{}
	gvks, _, err := cachedRestrictedScheme.ObjectKinds(workspaceKind)
	if err != nil || len(gvks) == 0 {
		panic(fmt.Sprintf("failed to derive GVK from WorkspaceKind type: %v", err))
	}
	cachedExpectedGVK = gvks[0]
}

// ParseWorkspaceKindManifestBody reads and decodes a YAML request body into a WorkspaceKind object
// using Kubernetes runtime validation to ensure maximum security.
func (a *App) ParseWorkspaceKindManifestBody(w http.ResponseWriter, r *http.Request) (*kubefloworgv1beta1.WorkspaceKind, bool) {
	// NOTE: A server-level middleware should enforce a max body size.
	body, err := io.ReadAll(r.Body)
	if err != nil {
		a.badRequestResponse(w, r, fmt.Errorf("failed to read request body: %w", err))
		return nil, false
	}
	defer func() {
		if err := r.Body.Close(); err != nil {
			a.LogWarn(r, fmt.Sprintf("failed to close request body: %v", err))
		}
	}()

	if len(body) == 0 {
		a.badRequestResponse(w, r, errors.New("request body is empty"))
		return nil, false
	}

	obj, gvk, err := cachedUniversalDeserializer.Decode(body, nil, nil)
	if err != nil {
		a.badRequestResponse(w, r, fmt.Errorf("failed to decode YAML manifest: %w", err))
		return nil, false
	}

	if gvk.Kind != cachedExpectedGVK.Kind || gvk.Version != cachedExpectedGVK.Version {
		a.badRequestResponse(w, r, fmt.Errorf("invalid GVK: expected %s, got %s", cachedExpectedGVK.Kind, gvk.Kind))
		return nil, false
	}

	workspaceKind, ok := obj.(*kubefloworgv1beta1.WorkspaceKind)
	if !ok {
		a.badRequestResponse(w, r, fmt.Errorf("unexpected type: got %T, want *WorkspaceKind", obj))
		return nil, false
	}

	return workspaceKind, true
}

// GetWorkspaceKindHandler retrieves a specific workspace kind by name.
//
//	@Summary		Get workspace kind
//	@Description	Returns details of a specific workspace kind identified by its name. Workspace kinds define the available types of workspaces that can be created.
//	@Tags			workspacekinds
//	@Accept			json
//	@Produce		json
//	@Param			name	path		string					true	"Name of the workspace kind"	extensions(x-example=jupyterlab)
//	@Success		200		{object}	WorkspaceKindEnvelope	"Successful operation. Returns the requested workspace kind details."
//	@Failure		400		{object}	ErrorEnvelope			"Bad Request. Invalid workspace kind name format."
//	@Failure		401		{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
//	@Failure		403		{object}	ErrorEnvelope			"Forbidden. User does not have permission to access the workspace kind."
//	@Failure		404		{object}	ErrorEnvelope			"Not Found. Workspace kind does not exist."
//	@Failure		500		{object}	ErrorEnvelope			"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspacekinds/{name} [get]
func (a *App) GetWorkspaceKindHandler(w http.ResponseWriter, r *http.Request, ps httprouter.Params) {
	name := ps.ByName(ResourceNamePathParam)

	// validate path parameters
	var valErrs field.ErrorList
	valErrs = append(valErrs, helper.ValidateFieldIsDNS1123Subdomain(field.NewPath(ResourceNamePathParam), name)...)
	if len(valErrs) > 0 {
		a.failedValidationResponse(w, r, errMsgPathParamsInvalid, valErrs, nil)
		return
	}

	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbGet,
			&kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: name},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspaceKind, err := a.repositories.WorkspaceKind.GetWorkspaceKind(r.Context(), name)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindNotFound) {
			a.notFoundResponse(w, r)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceKindEnvelope{Data: workspaceKind}
	a.dataResponse(w, r, responseEnvelope)
}

// GetWorkspaceKindsHandler returns a list of all available workspace kinds.
//
//	@Summary		List workspace kinds
//	@Description	Returns a list of all available workspace kinds. Workspace kinds define the different types of workspaces that can be created in the system.
//	@Tags			workspacekinds
//	@Accept			json
//	@Produce		json
//	@Success		200	{object}	WorkspaceKindListEnvelope	"Successful operation. Returns a list of all available workspace kinds."
//	@Failure		401	{object}	ErrorEnvelope				"Unauthorized. Authentication is required."
//	@Failure		403	{object}	ErrorEnvelope				"Forbidden. User does not have permission to list workspace kinds."
//	@Failure		500	{object}	ErrorEnvelope				"Internal server error. An unexpected error occurred on the server."
//	@Router			/workspacekinds [get]
func (a *App) GetWorkspaceKindsHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	// =========================== AUTH ===========================
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbList,
			&kubefloworgv1beta1.WorkspaceKind{},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}
	// ============================================================

	workspaceKinds, err := a.repositories.WorkspaceKind.GetWorkspaceKinds(r.Context())
	if err != nil {
		a.serverErrorResponse(w, r, err)
		return
	}

	responseEnvelope := &WorkspaceKindListEnvelope{Data: workspaceKinds}
	a.dataResponse(w, r, responseEnvelope)
}

// CreateWorkspaceKindHandler creates a new workspace kind from a YAML manifest.

// @Summary		Create workspace kind
// @Description	Creates a new workspace kind from a raw YAML manifest.
// @Tags			workspacekinds
// @Accept			application/vnd.kubeflow-notebooks.manifest+yaml
// @Produce		json
// @Param			body	body		string					true	"Raw YAML manifest of the WorkspaceKind"
// @Success		201		{object}	WorkspaceKindEnvelope	"Successful creation. Returns the newly created workspace kind details."
// @Failure		400		{object}	ErrorEnvelope			"Bad Request. The YAML is invalid or a required field is missing."
// @Failure		401		{object}	ErrorEnvelope			"Unauthorized. Authentication is required."
// @Failure		403		{object}	ErrorEnvelope			"Forbidden. User does not have permission to create the workspace kind."
// @Failure		409		{object}	ErrorEnvelope			"Conflict. A WorkspaceKind with the same name already exists."
// @Failure		415		{object}	ErrorEnvelope			"Unsupported Media Type. Content-Type header is not correct."
// @Failure		500		{object}	ErrorEnvelope			"Internal server error."
// @Router			/workspacekinds [post]
func (a *App) CreateWorkspaceKindHandler(w http.ResponseWriter, r *http.Request, _ httprouter.Params) {
	// === Content-Type check ===
	if ok := a.ValidateContentType(w, r, ContentTypeYAMLManifest); !ok {
		return
	}

	// === Read body and parse with secure parser ===
	newWsk, ok := a.ParseWorkspaceKindManifestBody(w, r)
	if !ok {
		return
	}

	// === Validate name exists in YAML ===
	if newWsk.Name == "" {
		a.badRequestResponse(w, r, errors.New("'.metadata.name' is a required field in the YAML manifest"))
		return
	}

	// === AUTH ===
	authPolicies := []*auth.ResourcePolicy{
		auth.NewResourcePolicy(
			auth.ResourceVerbCreate,
			&kubefloworgv1beta1.WorkspaceKind{
				ObjectMeta: metav1.ObjectMeta{Name: newWsk.Name},
			},
		),
	}
	if success := a.requireAuth(w, r, authPolicies); !success {
		return
	}

	// === Create ===
	createdModel, err := a.repositories.WorkspaceKind.Create(r.Context(), newWsk)
	if err != nil {
		if errors.Is(err, repository.ErrWorkspaceKindAlreadyExists) {
			a.conflictResponse(w, r, err)
			return
		}
		// This handles validation errors from the K8s API Server (webhook)
		if apierrors.IsInvalid(err) {
			causes := helper.StatusCausesFromAPIStatus(err)
			a.failedValidationResponse(w, r, errMsgKubernetesValidation, nil, causes)
			return
		}
		a.serverErrorResponse(w, r, err)
		return
	}

	// === Return created object in envelope ===
	location := a.LocationGetWorkspaceKind(createdModel.Name)
	responseEnvelope := &WorkspaceKindEnvelope{Data: createdModel}
	a.createdResponse(w, r, responseEnvelope, location)
}
