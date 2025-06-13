import React, { useCallback, useState } from 'react';
import {
  Button,
  Content,
  Flex,
  FlexItem,
  PageGroup,
  PageSection,
  Stack,
  ToggleGroup,
  ToggleGroupItem,
} from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { WorkspaceKindCreate } from '~/shared/api/backendApiTypes';
import { WorkspaceKindFileUpload } from './fileUpload/WorkspaceKindFileUpload';
import { WorkspaceKindFormProperties } from './properties/WorkspaceKindFormProperties';
import { WorkspaceKindFormImage } from './image/WorkspaceKindFormImage';

export enum WorkspaceKindFormView {
  Form,
  FileUpload,
}

export const WorkspaceKindForm: React.FC = () => {
  const navigate = useNavigate();
  // TODO: Detect mode by route
  const [mode] = useState('create');
  const [yamlValue, setYamlValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [view, setView] = useState<WorkspaceKindFormView>(WorkspaceKindFormView.FileUpload);

  const handleViewClick = (event: React.MouseEvent<unknown> | React.KeyboardEvent | MouseEvent) => {
    const { id } = event.currentTarget as HTMLElement;
    setView(
      id === 'workspace-kind-form-fileupload-view'
        ? WorkspaceKindFormView.FileUpload
        : WorkspaceKindFormView.Form,
    );
  };
  const [data, setData, resetData] = useGenericObjectState<WorkspaceKindCreate>({
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

  const handleCreate = useCallback(() => {
    // TODO: Complete handleCreate with API call to create a new WS kind
    if (!Object.keys(data).length) {
      return;
    }
    setIsSubmitting(true);
  }, [data]);

  const cancel = useCallback(() => {
    navigate('/workspacekinds');
  }, [navigate]);

  return (
    <>
      <PageGroup isFilled={false} stickyOnBreakpoint={{ default: 'top' }}>
        <PageSection>
          <Stack hasGutter>
            <Flex direction={{ default: 'column' }} rowGap={{ default: 'rowGapXl' }}>
              <FlexItem>
                <Content>
                  <h1>{`${mode === 'create' ? 'Create' : 'Edit'} workspace kind`}</h1>
                  {view === WorkspaceKindFormView.FileUpload && (
                    <p>
                      {`Please upload a Workspace Kind YAML file. Select 'Form View' to view
                    and edit the workspace kind's information`}
                    </p>
                  )}
                  {view === WorkspaceKindFormView.Form && (
                    <p>
                      {`View and edit the Workspace Kind's information. Some fields may not be
                      represented in this form`}
                    </p>
                  )}
                </Content>
              </FlexItem>
              <FlexItem>
                <ToggleGroup aria-label="Toggle form view">
                  <ToggleGroupItem
                    text="YAML Upload"
                    buttonId="workspace-kind-form-fileupload-view"
                    isSelected={view === WorkspaceKindFormView.FileUpload}
                    onChange={handleViewClick}
                  />
                  <ToggleGroupItem
                    text="Form View"
                    buttonId="toggle-group-single-2"
                    isSelected={view === WorkspaceKindFormView.Form}
                    onChange={handleViewClick}
                  />
                </ToggleGroup>
              </FlexItem>
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
              onClick={handleCreate}
              isDisabled={!isSubmitting}
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
