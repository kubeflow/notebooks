import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import isEqual from 'lodash-es/isEqual';
import yaml from 'js-yaml';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PageGroup, PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import {
  Tabs,
  Tab,
  TabTitleText,
  TabContent,
  TabContentBody,
} from '@patternfly/react-core/dist/esm/components/Tabs';
import { UndoIcon } from '@patternfly/react-icons/dist/esm/icons/undo-icon';
import { useNotification } from 'mod-arch-core';
import useGenericObjectState from 'mod-arch-core/dist/utilities/useGenericObjectState';
import useWorkspaceKindByName from '~/app/hooks/useWorkspaceKindByName';
import { useTypedNavigate, useTypedParams } from '~/app/routerHelper';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { ImagePullPolicy, WorkspaceKindFormData } from '~/app/types';
import {
  extractErrorMessage,
  formatConflictErrorMessages,
  formatValidationErrorMessages,
  safeApiCall,
} from '~/shared/api/apiUtils';
import { CONTENT_TYPE_KEY, WORKSPACE_KIND_EXAMPLES_URL } from '~/shared/utilities/const';
import { ContentType } from '~/shared/utilities/types';
import { LoadError } from '~/app/components/LoadError';
import {
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
import {
  convertFormDataToUpdate,
  EMPTY_WORKSPACE_KIND_FORM_DATA,
  generateUniqueId,
  isValidWorkspaceKindUpdate,
} from './helpers';
import { WorkspaceKindYamlEditor } from './yamlEditor/WorkspaceKindYamlEditor';

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
      icon: spawner.icon,
      logo: spawner.logo,
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
        restrictions: { deny: false },
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
        tolerations: v.spec.tolerations?.map((t) => ({
          id: generateUniqueId(),
          ...t,
        })),
        restrictions: { deny: false },
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
      activityProbe: podTemplate.activityProbe,
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
  const FORM_TAB_KEY = 0;
  const YAML_TAB_KEY = 1;
  const [activeTabKey, setActiveTabKey] = useState<number>(FORM_TAB_KEY);
  const [editYamlValue, setEditYamlValue] = useState('');
  const [originalYaml, setOriginalYaml] = useState('');
  const [yamlParseError, setYamlParseError] = useState<string | null>(null);
  const lastApiObjectRef = useRef<WorkspacekindsWorkspaceKindUpdate | null>(null);
  const mode: FormMode = useCurrentRouteKey() === 'workspaceKindCreate' ? 'create' : 'edit';
  const [validated, setValidated] = useState<ValidationStatus>(
    mode === 'edit' ? 'success' : 'default',
  );
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
    lastApiObjectRef.current = initialFormData;
    const yamlStr = yaml.dump(initialFormData, { noRefs: true });
    setOriginalYaml(yamlStr);
    setEditYamlValue(yamlStr);
  }, [initialFormData, initialFormDataLoaded, mode, replaceData]);

  const handleTabSelect = useCallback(
    (_event: React.MouseEvent | React.KeyboardEvent | MouseEvent, tabKey: string | number) => {
      const newTab = tabKey as number;
      if (newTab === YAML_TAB_KEY && activeTabKey === FORM_TAB_KEY) {
        const updateObj = convertFormDataToUpdate(data, lastApiObjectRef.current!);
        const yamlStr = yaml.dump(updateObj, { noRefs: true });
        setEditYamlValue(yamlStr);
        setOriginalYaml(yamlStr);
        lastApiObjectRef.current = updateObj;
        setYamlParseError(null);
      } else if (newTab === FORM_TAB_KEY && activeTabKey === YAML_TAB_KEY) {
        try {
          const parsed = yaml.load(editYamlValue);
          if (!isValidWorkspaceKindUpdate(parsed)) {
            setYamlParseError(
              'Invalid WorkspaceKind update structure: must include revision, spawner, and podTemplate',
            );
            return;
          }
          const typedParsed = parsed as WorkspacekindsWorkspaceKindUpdate;
          const newFormData = convertToFormData(typedParsed);
          replaceData(newFormData);
          lastApiObjectRef.current = typedParsed;
          setYamlParseError(null);
        } catch (e) {
          setYamlParseError((e as Error).message);
          return;
        }
      }
      setActiveTabKey(newTab);
    },
    [activeTabKey, data, editYamlValue, replaceData],
  );

  const handleRevert = useCallback(() => {
    if (initialFormData) {
      const converted = convertToFormData(initialFormData);
      replaceData(converted);
      setOriginalFormData(converted);
      lastApiObjectRef.current = initialFormData;
      const yamlStr = yaml.dump(initialFormData, { noRefs: true });
      setOriginalYaml(yamlStr);
      setEditYamlValue(yamlStr);
      setYamlParseError(null);
    }
  }, [initialFormData, replaceData]);

  const handleYamlChange = useCallback((value: string) => {
    setEditYamlValue(value);
    try {
      yaml.load(value);
      setYamlParseError(null);
    } catch (e) {
      setYamlParseError((e as Error).message);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
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
      } else if (activeTabKey === YAML_TAB_KEY) {
        const parsed = yaml.load(editYamlValue);
        if (!isValidWorkspaceKindUpdate(parsed)) {
          throw new Error(
            'Invalid WorkspaceKind update structure: must include revision, spawner, and podTemplate',
          );
        }
        const updateResult = await safeApiCall(() =>
          api.workspaceKinds.updateWorkspaceKind(routeParams?.kind || '', {
            data: parsed as WorkspacekindsWorkspaceKindUpdate,
          }),
        );
        if (!updateResult.ok) {
          throw updateResult.errorEnvelope;
        }
        notification.success(`Workspace kind '${routeParams?.kind || ''}' updated successfully`);
      } else {
        const updateResult = await safeApiCall(() =>
          api.workspaceKinds.updateWorkspaceKind(routeParams?.kind || '', {
            data: convertFormDataToUpdate(data, lastApiObjectRef.current!),
          }),
        );
        if (!updateResult.ok) {
          throw updateResult.errorEnvelope;
        }
        notification.success(`Workspace kind '${routeParams?.kind || ''}' updated successfully`);
      }
      navigate('workspaceKinds');
    } catch (err) {
      const extracted = extractErrorMessage(err);
      let message: string;
      if (typeof extracted === 'string') {
        message = extracted;
      } else {
        const details = [
          ...formatValidationErrorMessages(extracted),
          ...formatConflictErrorMessages(extracted),
        ];
        message = details.length > 0 ? details.join('; ') : extracted.error.message;
      }
      notification.error(
        `Failed to ${mode === 'edit' ? 'edit' : 'create'} workspace kind`,
        message,
      );
      if (mode === 'create') {
        setValidated('error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    mode,
    activeTabKey,
    api.workspaceKinds,
    routeParams?.kind,
    data,
    navigate,
    notification,
    yamlValue,
    editYamlValue,
  ]);

  const hasChanges = useMemo(() => {
    if (mode === 'edit' && activeTabKey === YAML_TAB_KEY) {
      return editYamlValue !== originalYaml;
    }
    return originalFormData !== null && !isEqual(data, originalFormData);
  }, [mode, activeTabKey, editYamlValue, originalYaml, data, originalFormData]);

  const canSubmit = useMemo(() => {
    if (isSubmitting) {
      return false;
    }
    if (mode === 'create') {
      return validated === 'success';
    }
    if (activeTabKey === YAML_TAB_KEY) {
      return hasChanges && yamlParseError === null;
    }
    return validated === 'success' && hasChanges;
  }, [isSubmitting, validated, mode, hasChanges, activeTabKey, yamlParseError]);

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
                    `View and edit the Workspace Kind using the form or the YAML editor.
                      Changes are synced between the form and YAML when switching tabs.`
                  )}
                </Content>
              </FlexItem>
            </Flex>
          </Stack>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        <Stack hasGutter>
          {mode === 'create' && (
            <StackItem style={{ height: '100%' }}>
              <WorkspaceKindFileUpload
                resetData={resetData}
                value={yamlValue}
                setValue={setYamlValue}
                validated={validated}
                setValidated={setValidated}
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                onClear={() => {}}
              />
            </StackItem>
          )}
          {mode === 'edit' && (
            <>
              <StackItem>
                <Tabs
                  activeKey={activeTabKey}
                  onSelect={handleTabSelect}
                  aria-label="Edit workspace kind view tabs"
                >
                  <Tab
                    eventKey={FORM_TAB_KEY}
                    title={<TabTitleText>Form</TabTitleText>}
                    aria-label="Form editor"
                    tabContentId="form-tab-content"
                    data-testid="form-tab"
                  />
                  <Tab
                    eventKey={YAML_TAB_KEY}
                    title={<TabTitleText>YAML</TabTitleText>}
                    aria-label="YAML editor"
                    tabContentId="yaml-tab-content"
                    data-testid="yaml-tab"
                  />
                </Tabs>
              </StackItem>
              <TabContent
                id="form-tab-content"
                eventKey={FORM_TAB_KEY}
                activeKey={activeTabKey}
                hidden={activeTabKey !== FORM_TAB_KEY}
              >
                <TabContentBody>
                  <Stack hasGutter>
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
                  </Stack>
                </TabContentBody>
              </TabContent>
              <TabContent
                id="yaml-tab-content"
                eventKey={YAML_TAB_KEY}
                activeKey={activeTabKey}
                hidden={activeTabKey !== YAML_TAB_KEY}
                style={{ flex: 1 }}
              >
                <TabContentBody style={{ height: '100%' }}>
                  <WorkspaceKindYamlEditor
                    value={editYamlValue}
                    onChange={handleYamlChange}
                    error={yamlParseError}
                  />
                </TabContentBody>
              </TabContent>
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
          {mode === 'edit' && (
            <FlexItem>
              <Button
                variant="link"
                isDisabled={!hasChanges}
                onClick={handleRevert}
                data-testid="revert-button"
              >
                <UndoIcon className="pf-v6-u-mr-sm" />
                Revert
              </Button>
            </FlexItem>
          )}
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
