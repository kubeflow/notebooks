import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PageGroup, PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { t_global_spacer_sm as SmallPadding } from '@patternfly/react-tokens';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';
import { ValidationErrorAlert } from '~/app/components/ValidationErrorAlert';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { WorkspaceKind, ValidationError } from '~/shared/api/backendApiTypes';
import { useTypedNavigate, useTypedParams } from '~/app/routerHelper';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceKindFormData } from '~/app/types';
import { ErrorEnvelopeException } from '~/shared/api/apiUtils';
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

const convertToFormData = (initialData: WorkspaceKind): WorkspaceKindFormData => {
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
  const { api } = useNotebookAPI();
  // TODO: Detect mode by route
  const [yamlValue, setYamlValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validated, setValidated] = useState<ValidationStatus>('default');
  const mode: FormMode = useCurrentRouteKey() === 'workspaceKindCreate' ? 'create' : 'edit';
  const [specErrors, setSpecErrors] = useState<(ValidationError | ErrorEnvelopeException)[]>([]);

  const { kind } = useTypedParams<'workspaceKindEdit'>();
  const [initialFormData, initialFormDataLoaded, initialFormDataError] =
    useWorkspaceKindByName(kind);

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
    // TODO: Complete handleCreate with API call to create a new WS kind
    try {
      if (mode === 'create') {
        const newWorkspaceKind = await api.createWorkspaceKind({ directYAML: true }, yamlValue);
        // TODO: alert user about success
        console.info('New workspace kind created:', JSON.stringify(newWorkspaceKind));
        navigate('workspaceKinds');
      }
      // TODO: Finish when WSKind API is finalized
      // const updatedWorkspace = await api.updateWorkspaceKind({}, kind, { data: {} });
      // console.info('Workspace Kind updated:', JSON.stringify(updatedWorkspace));
      // navigate('workspaceKinds');
    } catch (err) {
      if (err instanceof ErrorEnvelopeException) {
        const validationErrors = err.envelope.error?.cause?.validation_errors;
        if (validationErrors && validationErrors.length > 0) {
          setSpecErrors((prev) => [...prev, ...validationErrors]);
          setValidated('error');
          return;
        }
        setSpecErrors((prev) => [...prev, err]);
        setValidated('error');
      }
      // TODO: alert user about error
      console.error(`Error ${mode === 'edit' ? 'editing' : 'creating'} workspace kind: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate, mode, api, yamlValue]);

  const canSubmit = useMemo(
    () => !isSubmitting && validated === 'success',
    [isSubmitting, validated],
  );

  const cancel = useCallback(() => {
    navigate('workspaceKinds');
  }, [navigate]);

  if (mode === 'edit' && initialFormDataError) {
    return (
      <EmptyState
        titleText="Error loading Workspace Kind data"
        headingLevel="h4"
        icon={ExclamationCircleIcon}
        status="danger"
      >
        <EmptyStateBody>{initialFormDataError.message}</EmptyStateBody>
      </EmptyState>
    );
  }
  return (
    <>
      <PageGroup isFilled={false} stickyOnBreakpoint={{ default: 'top' }}>
        <PageSection>
          <Stack hasGutter>
            <Flex direction={{ default: 'column' }} rowGap={{ default: 'rowGapXl' }}>
              <FlexItem>
                <Content component={ContentVariants.h1}>
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
        {mode === 'create' && (
          <Stack>
            {specErrors.length > 0 && (
              <StackItem style={{ padding: SmallPadding.value }}>
                <ValidationErrorAlert title="Error creating workspace kind" errors={specErrors} />
              </StackItem>
            )}
            <StackItem style={{ height: '100%' }}>
              <WorkspaceKindFileUpload
                resetData={resetData}
                value={yamlValue}
                setValue={setYamlValue}
                validated={validated}
                setValidated={setValidated}
                onClear={() => {
                  setSpecErrors([]);
                }}
              />
            </StackItem>
          </Stack>
        )}
        {mode === 'edit' && (
          <>
            <WorkspaceKindFormProperties
              mode={mode}
              properties={data.properties}
              updateField={(properties) => setData('properties', properties)}
            />
            <WorkspaceKindFormImage
              mode={mode}
              imageConfig={data.imageConfig}
              updateImageConfig={(imageInput) => {
                setData('imageConfig', imageInput);
              }}
            />
            <WorkspaceKindFormPodConfig
              podConfig={data.podConfig}
              updatePodConfig={(podConfig) => {
                setData('podConfig', podConfig);
              }}
            />
            <WorkspaceKindFormPodTemplate
              podTemplate={data.podTemplate}
              updatePodTemplate={(podTemplate) => {
                setData('podTemplate', podTemplate);
              }}
            />
          </>
        )}
      </PageSection>
      <PageSection isFilled={false} stickyOnBreakpoint={{ default: 'bottom' }}>
        <Flex>
          <FlexItem>
            <Button
              variant="primary"
              ouiaId="Primary"
              onClick={handleSubmit}
              // TODO: button is always disabled on edit mode. Need to modify when WorkspaceKind edit is finalized
              isDisabled={!canSubmit || mode === 'edit'}
            >
              {mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </FlexItem>
          <FlexItem>
            <Button variant="link" isInline onClick={cancel}>
              Cancel
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>
    </>
  );
};
