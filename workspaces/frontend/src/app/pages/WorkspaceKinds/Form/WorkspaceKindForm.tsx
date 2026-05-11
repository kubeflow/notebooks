import React, { useCallback, useEffect, useMemo, useState } from 'react';
import isEqual from 'lodash-es/isEqual';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PageGroup, PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { useNotification } from 'mod-arch-core';
import useGenericObjectState from 'mod-arch-core/dist/utilities/useGenericObjectState';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { useTypedNavigate, useTypedParams } from '~/app/routerHelper';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ImagePullPolicy, WorkspaceKindFormData } from '~/app/types';
import { extractErrorMessage, safeApiCall } from '~/shared/api/apiUtils';
import { ErrorAlert } from '~/shared/components/ErrorAlert';
import { CONTENT_TYPE_KEY, WORKSPACE_KIND_EXAMPLES_URL } from '~/shared/utilities/const';
import { ContentType } from '~/shared/utilities/types';
import { LoadError } from '~/app/components/LoadError';
import {
  ApiErrorEnvelope,
  OptionsOptionRedirect,
  OptionsRedirectMessageLevel,
  V1Beta1OptionRedirect,
  WorkspacekindsWorkspaceKindUpdate,
} from '~/generated/data-contracts';
import { WorkspaceKindFileUpload } from './fileUpload/WorkspaceKindFileUpload';
import { WorkspaceKindFormProperties } from './properties/WorkspaceKindFormProperties';
import { WorkspaceKindFormImage } from './image/WorkspaceKindFormImage';
import { WorkspaceKindFormPodConfig } from './podConfig/WorkspaceKindFormPodConfig';
import { WorkspaceKindFormPodTemplate } from './podTemplate/WorkspaceKindFormPodTemplate';
import { convertFormDataToUpdate, EMPTY_WORKSPACE_KIND_FORM_DATA } from './helpers';

export enum WorkspaceKindFormView {
  Form,
  FileUpload,
}

export type ValidationStatus = 'success' | 'error' | 'default';
export type FormMode = 'edit' | 'create';

const convertRedirect = (
  redirect: V1Beta1OptionRedirect | undefined,
): OptionsOptionRedirect | undefined => {
  if (!redirect) {
    return undefined;
  }
  return {
    to: redirect.to,
    message: redirect.message
      ? {
          level: redirect.message.level as unknown as OptionsRedirectMessageLevel,
          text: redirect.message.text,
        }
      : undefined,
  };
};

const convertToFormData = (
  initialData: WorkspacekindsWorkspaceKindUpdate,
): WorkspaceKindFormData => {
  const { spawner, podTemplate } = initialData;

  return {
    properties: {
      displayName: spawner.displayName,
      description: spawner.description,
      deprecated: spawner.deprecated ?? false,
      deprecationMessage: spawner.deprecationMessage ?? '',
      hidden: spawner.hidden ?? false,
      icon: { url: spawner.icon.url ?? '' },
      logo: { url: spawner.logo.url ?? '' },
    },
    imageConfig: {
      default: podTemplate.options.imageConfig.spawner.default,
      values: podTemplate.options.imageConfig.values.map((v) => ({
        id: v.id,
        displayName: v.spawner.displayName,
        description: v.spawner.description ?? '',
        hidden: v.spawner.hidden ?? false,
        labels: v.spawner.labels,
        redirect: convertRedirect(v.redirect),
        image: v.spec.image,
        imagePullPolicy: v.spec.imagePullPolicy as unknown as ImagePullPolicy,
        ports: v.spec.ports.map((p) => ({
          id: p.id,
          displayName: p.displayName ?? '',
          port: p.port,
          protocol: 'HTTP' as const,
        })),
      })),
    },
    podConfig: {
      default: podTemplate.options.podConfig.spawner.default,
      values: podTemplate.options.podConfig.values.map((v) => ({
        id: v.id,
        displayName: v.spawner.displayName,
        description: v.spawner.description ?? '',
        hidden: v.spawner.hidden ?? false,
        labels: v.spawner.labels,
        redirect: convertRedirect(v.redirect),
        resources: v.spec.resources
          ? {
              requests: (v.spec.resources.requests ?? {}) as Record<string, string>,
              limits: (v.spec.resources.limits ?? {}) as Record<string, string>,
            }
          : undefined,
        nodeSelector: v.spec.nodeSelector,
      })),
    },
    podTemplate: {
      podMetadata: {
        labels: podTemplate.podMetadata?.labels ?? {},
        annotations: podTemplate.podMetadata?.annotations ?? {},
      },
      volumeMounts: {
        home: podTemplate.volumeMounts.home,
      },
      culling: podTemplate.culling
        ? {
            enabled: podTemplate.culling.enabled ?? true,
            maxInactiveSeconds: podTemplate.culling.maxInactiveSeconds ?? 86400,
            activityProbe: {
              jupyter: {
                lastActivity: podTemplate.culling.activityProbe.jupyter?.lastActivity ?? false,
              },
            },
          }
        : undefined,
    },
  };
};

export const WorkspaceKindForm: React.FC = () => {
  const navigate = useTypedNavigate();
  const notification = useNotification();
  const { api } = useNotebookAPI();
  // TODO: Detect mode by route
  const [yamlValue, setYamlValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const mode: FormMode = useCurrentRouteKey() === 'workspaceKindCreate' ? 'create' : 'edit';
  const [validated, setValidated] = useState<ValidationStatus>(
    mode === 'edit' ? 'success' : 'default',
  );
  const [error, setError] = useState<string | ApiErrorEnvelope | null>(null);

  const routeParams = useTypedParams<'workspaceKindEdit' | 'workspaceKindCreate'>();
  const [initialFormData, initialFormDataLoaded, initialFormDataError] = useWorkspaceKindByName(
    routeParams?.kind,
  );

  const [data, setData, resetData, replaceData] = useGenericObjectState<WorkspaceKindFormData>(
    initialFormData ? convertToFormData(initialFormData) : EMPTY_WORKSPACE_KIND_FORM_DATA,
  );
  const [originalFormData, setOriginalFormData] = useState<WorkspaceKindFormData | null>(null);

  useEffect(() => {
    if (!initialFormDataLoaded || initialFormData === null || mode === 'create') {
      return;
    }
    const converted = convertToFormData(initialFormData);
    replaceData(converted);
    setOriginalFormData(converted);
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

        if (!createResult.ok) {
          throw createResult.errorEnvelope;
        }

        notification.success(
          `Workspace kind '${createResult.result.data.name}' created successfully`,
        );
      } else {
        const updateResult = await safeApiCall(() =>
          api.workspaceKinds.updateWorkspaceKind(routeParams?.kind || '', {
            data: convertFormDataToUpdate(
              data,
              initialFormData as WorkspacekindsWorkspaceKindUpdate,
            ),
          }),
        );
        if (!updateResult.ok) {
          throw updateResult.errorEnvelope;
        }
        notification.success(`Workspace kind '${routeParams?.kind || ''}' updated successfully`);
      }
      navigate('workspaceKinds');
    } catch (err) {
      setError(extractErrorMessage(err));
      if (mode === 'create') {
        setValidated('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    mode,
    api.workspaceKinds,
    routeParams?.kind,
    data,
    initialFormData,
    navigate,
    notification,
    yamlValue,
  ]);

  const hasChanges = useMemo(
    () => originalFormData !== null && !isEqual(data, originalFormData),
    [data, originalFormData],
  );

  const canSubmit = useMemo(
    () => !isSubmitting && validated === 'success' && (mode === 'create' || hasChanges),
    [isSubmitting, validated, mode, hasChanges],
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
                  {mode === 'create' ? (
                    <p>
                      Please upload or drag and drop a Workspace Kind YAML file. Sample Workspace
                      Kind YAML files can be downloaded from the{' '}
                      <a href={WORKSPACE_KIND_EXAMPLES_URL} target="_blank" rel="noreferrer">
                        Kubeflow Notebooks
                      </a>{' '}
                      repository.
                    </p>
                  ) : (
                    `View and edit the Workspace Kind's information. Some fields may not be
                      represented in this form`
                  )}
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
                content={error}
                testId="workspace-kind-form-error"
              />
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
              isDisabled={!canSubmit}
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
