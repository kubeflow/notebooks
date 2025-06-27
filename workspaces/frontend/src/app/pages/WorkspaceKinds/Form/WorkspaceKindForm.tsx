import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Content,
  ContentVariants,
  Flex,
  FlexItem,
  PageGroup,
  PageSection,
  Stack,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { useTypedNavigate } from '~/app/routerHelper';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceKindFormData } from '~/app/types';
import { WorkspaceKindFileUpload } from './fileUpload/WorkspaceKindFileUpload';
import { WorkspaceKindFormProperties } from './properties/WorkspaceKindFormProperties';
import { WorkspaceKindFormImage } from './image/WorkspaceKindFormImage';

export enum WorkspaceKindFormView {
  Form,
  FileUpload,
}

export type ValidationStatus = 'success' | 'error' | 'default';

export const WorkspaceKindForm: React.FC = () => {
  const navigate = useTypedNavigate();
  const { api } = useNotebookAPI();
  // TODO: Detect mode by route
  const [mode] = useState('create');
  const [yamlValue, setYamlValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<WorkspaceKindFormView>(WorkspaceKindFormView.FileUpload);
  const [validated, setValidated] = useState<ValidationStatus>('default');
  const workspaceKindFileUploadId = 'workspace-kind-form-fileupload-view';

  const [data, setData, resetData] = useGenericObjectState<WorkspaceKindFormData>({
    properties: {
      displayName: '',
      description: '',
      deprecated: false,
      deprecationMessage: '',
      hidden: false,
      icon: { url: '' },
      logo: { url: '' },
    },
    imageConfig: {
      default: '',
      values: [],
    },
  });

  const handleViewClick = useCallback(
    (event: React.MouseEvent<unknown> | React.KeyboardEvent | MouseEvent) => {
      const { id } = event.currentTarget as HTMLElement;
      setView(
        id === workspaceKindFileUploadId
          ? WorkspaceKindFormView.FileUpload
          : WorkspaceKindFormView.Form,
      );
    },
    [],
  );

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    // TODO: Complete handleCreate with API call to create a new WS kind
    try {
      if (mode === 'create') {
        const newWorkspaceKind = await api.createWorkspaceKind({}, yamlValue);
        console.info('New workspace kind created:', JSON.stringify(newWorkspaceKind));
      }
    } catch (err) {
      console.error(`Error ${mode === 'edit' ? 'editing' : 'creating'} workspace kind: ${err}`);
    } finally {
      setIsSubmitting(false);
    }
    navigate('workspaceKinds');
  }, [navigate, mode, api, yamlValue]);

  const canSubmit = useMemo(
    () => !isSubmitting && yamlValue.length > 0 && validated === 'success',
    [yamlValue, isSubmitting, validated],
  );

  const cancel = useCallback(() => {
    navigate('workspaceKinds');
  }, [navigate]);

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
                  {view === WorkspaceKindFormView.FileUpload
                    ? `Please upload or drag and drop a Workspace Kind YAML file.`
                    : `View and edit the Workspace Kind's information. Some fields may not be
                      represented in this form`}
                </Content>
              </FlexItem>
              {mode === 'edit' && (
                <FlexItem>
                  <ToggleGroup className="workspace-kind-form-header" aria-label="Toggle form view">
                    <ToggleGroupItem
                      text="YAML Upload"
                      buttonId={workspaceKindFileUploadId}
                      isSelected={view === WorkspaceKindFormView.FileUpload}
                      onChange={handleViewClick}
                    />
                    <ToggleGroupItem
                      text="Form View"
                      buttonId="workspace-kind-form-form-view"
                      isSelected={view === WorkspaceKindFormView.Form}
                      onChange={handleViewClick}
                      isDisabled={yamlValue === '' || validated === 'error'}
                    />
                  </ToggleGroup>
                </FlexItem>
              )}
            </Flex>
          </Stack>
        </PageSection>
      </PageGroup>
      <PageSection isFilled>
        {view === WorkspaceKindFormView.FileUpload && (
          <WorkspaceKindFileUpload
            setData={setData}
            resetData={resetData}
            value={yamlValue}
            setValue={setYamlValue}
            validated={validated}
            setValidated={setValidated}
          />
        )}
        {view === WorkspaceKindFormView.Form && (
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
              isDisabled={!canSubmit}
            >
              {mode === 'create' ? 'Create' : 'Edit'}
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
