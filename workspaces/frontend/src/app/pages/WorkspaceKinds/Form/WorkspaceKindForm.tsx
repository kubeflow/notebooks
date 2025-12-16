import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PageGroup, PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { useNotification } from 'mod-arch-core';
import { ValidationErrorAlert } from '~/app/components/ValidationErrorAlert';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { useTypedNavigate, useTypedParams } from '~/app/routerHelper';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceKindFormData } from '~/app/types';
import {
  extractErrorEnvelopeMessage,
  extractErrorMessage,
  extractValidationErrors,
  safeApiCall,
} from '~/shared/api/apiUtils';
import { ErrorAlert } from '~/shared/components/ErrorAlert';
import { CONTENT_TYPE_KEY } from '~/shared/utilities/const';
import { ContentType } from '~/shared/utilities/types';
import { LoadError } from '~/app/components/LoadError';
import { ApiValidationError, WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';
import { WorkspaceKindFileUpload } from './fileUpload/WorkspaceKindFileUpload';
import { WorkspaceKindFormProperties } from './properties/WorkspaceKindFormProperties';
import { WorkspaceKindFormImage } from './image/WorkspaceKindFormImage';
import { WorkspaceKindFormPodConfig } from './podConfig/WorkspaceKindFormPodConfig';
import { WorkspaceKindFormPodTemplate } from './podTemplate/WorkspaceKindFormPodTemplate';
import { EMPTY_WORKSPACE_KIND_FORM_DATA } from './helpers';

export enum WorkspaceKindFormView {
  Form,
  FileUpload,
}

export type ValidationStatus = 'success' | 'error' | 'default';
export type FormMode = 'edit' | 'create';

const convertToFormData = (initialData: WorkspacekindsWorkspaceKind): WorkspaceKindFormData => {
  const { podTemplate, ...properties } = initialData;
  const { options, ...spec } = podTemplate;
  const { podConfig, imageConfig } = options;
  return {
    properties,
    podConfig,
    imageConfig,
    podTemplate: spec,
  };
};

export const WorkspaceKindForm: React.FC = () => {
  const navigate = useTypedNavigate();
  const notification = useNotification();
  const { api } = useNotebookAPI();
  // TODO: Detect mode by route
  const [yamlValue, setYamlValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validated, setValidated] = useState<ValidationStatus>('default');
  const mode: FormMode = useCurrentRouteKey() === 'workspaceKindCreate' ? 'create' : 'edit';
  const [specErrors, setSpecErrors] = useState<ApiValidationError[]>([]);
  const [error, setError] = useState<string | null>(null);

  const routeParams = useTypedParams<'workspaceKindEdit' | 'workspaceKindCreate'>();
  const [initialFormData, initialFormDataLoaded, initialFormDataError] = useWorkspaceKindByName(
    routeParams?.kind,
  );

  const [data, setData, resetData, replaceData] = useGenericObjectState<WorkspaceKindFormData>(
    initialFormData ? convertToFormData(initialFormData) : EMPTY_WORKSPACE_KIND_FORM_DATA,
  );

  useEffect(() => {
    if (!initialFormDataLoaded || initialFormData === null || mode === 'create') {
      return;
    }
    replaceData(convertToFormData(initialFormData));
  }, [initialFormData, initialFormDataLoaded, mode, replaceData]);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setError(null);
    // TODO: Complete handleCreate with API call to create a new WS kind
    try {
      if (mode === 'create') {
        const createResult = await safeApiCall(() =>
          api.workspaceKinds.createWorkspaceKind(yamlValue, {
            headers: {
              [CONTENT_TYPE_KEY]: ContentType.YAML,
            },
          }),
        );

        if (createResult.ok) {
          notification.success(
            `Workspace kind '${createResult.result.data.name}' created successfully`,
          );
          navigate('workspaceKinds');
        } else {
          const validationErrors = extractValidationErrors(createResult.errorEnvelope);
          if (validationErrors.length > 0) {
            setSpecErrors((prev) => [...prev, ...validationErrors]);
            setValidated('error');
            return;
          }
          setError(extractErrorEnvelopeMessage(createResult.errorEnvelope));
          setValidated('error');
        }
      }
      // TODO: Finish when WSKind API is finalized
      // const updatedWorkspace = await api.updateWorkspaceKind({}, kind, { data: {} });
      // console.info('Workspace Kind updated:', JSON.stringify(updatedWorkspace));
      // navigate('workspaceKinds');
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [api, mode, navigate, yamlValue, notification]);

  const canSubmit = useMemo(
    () => !isSubmitting && validated === 'success',
    [isSubmitting, validated],
  );

  const cancel = useCallback(() => {
    navigate('workspaceKinds');
  }, [navigate]);

  if (mode === 'edit' && initialFormDataError) {
    return <LoadError title="Failed to load workspace kind data" error={initialFormDataError} />;
  }
  return (
    <>
      <PageGroup isFilled={false} stickyOnBreakpoint={{ default: 'top' }}>
        <PageSection>
          <Stack hasGutter>
            <Flex direction={{ default: 'column' }} rowGap={{ default: 'rowGapXl' }}>
              <FlexItem>
                <Content component={ContentVariants.h1} data-testid="app-page-title">
                  {`${mode === 'create' ? 'Create' : 'Edit'} workspace kind`}
                </Content>
                <Content component={ContentVariants.p}>
                  {mode === 'create'
                    ? `Please upload or drag and drop a Workspace Kind YAML file.`
                    : `View and edit the Workspace Kind's information. Some fields may not be
                      represented in this form`}
                </Content>
              </FlexItem>
            </Flex>
          </Stack>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        <Stack hasGutter>
          {error && (
            <StackItem>
              <ErrorAlert
                title={`Failed to ${mode === 'edit' ? 'edit' : 'create'} workspace kind`}
                message={error}
                testId="workspace-kind-form-error"
              />
            </StackItem>
          )}
          {mode === 'create' && specErrors.length > 0 && (
            <StackItem>
              <ValidationErrorAlert title="Error creating workspace kind" errors={specErrors} />
            </StackItem>
          )}
          {mode === 'create' && (
            <StackItem style={{ height: '100%' }}>
              <WorkspaceKindFileUpload
                resetData={resetData}
                value={yamlValue}
                setValue={setYamlValue}
                validated={validated}
                setValidated={setValidated}
                onClear={() => {
                  setSpecErrors([]);
                  setError(null);
                }}
              />
            </StackItem>
          )}
          {mode === 'edit' && (
            <>
              <StackItem data-testid="workspace-kind-form-properties">
                <WorkspaceKindFormProperties
                  mode={mode}
                  properties={data.properties}
                  updateField={(properties) => setData('properties', properties)}
                />
              </StackItem>
              <StackItem>
                <WorkspaceKindFormImage
                  mode={mode}
                  imageConfig={data.imageConfig}
                  updateImageConfig={(imageInput) => {
                    setData('imageConfig', imageInput);
                  }}
                />
              </StackItem>
              <StackItem>
                <WorkspaceKindFormPodConfig
                  podConfig={data.podConfig}
                  updatePodConfig={(podConfig) => {
                    setData('podConfig', podConfig);
                  }}
                />
              </StackItem>
              <StackItem>
                <WorkspaceKindFormPodTemplate
                  podTemplate={data.podTemplate}
                  updatePodTemplate={(podTemplate) => {
                    setData('podTemplate', podTemplate);
                  }}
                />
              </StackItem>
            </>
          )}
        </Stack>
      </PageSection>
      <PageSection isFilled={false} stickyOnBreakpoint={{ default: 'bottom' }}>
        <Flex>
          <FlexItem>
            <Button
              variant="primary"
              ouiaId="Primary"
              onClick={handleSubmit}
              data-testid="submit-button"
              // TODO: button is always disabled on edit mode. Need to modify when WorkspaceKind edit is finalized
              isDisabled={!canSubmit || mode === 'edit'}
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="link" onClick={cancel} data-testid="cancel-button">
              Cancel
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
    </>
  );
};
