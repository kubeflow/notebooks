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
} from '@patternfly/react-core';
import { useTypedNavigate } from '~/app/routerHelper';
import { useCurrentRouteKey } from '~/app/hooks/useCurrentRouteKey';
import useGenericObjectState from '~/app/hooks/useGenericObjectState';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { WorkspaceKindFormData } from '~/app/types';
import { WorkspaceKindFileUpload } from './fileUpload/WorkspaceKindFileUpload';
import { WorkspaceKindFormProperties } from './properties/WorkspaceKindFormProperties';
import { WorkspaceKindFormImage } from './image/WorkspaceKindFormImage';
import { WorkspaceKindFormPodConfig } from './podConfig/WorkspaceKindFormPodConfig';

export enum WorkspaceKindFormView {
  Form,
  FileUpload,
}

export type ValidationStatus = 'success' | 'error' | 'default';

export const WorkspaceKindForm: React.FC = () => {
  const navigate = useTypedNavigate();
  const { api } = useNotebookAPI();
  // TODO: Detect mode by route
  const [yamlValue, setYamlValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validated, setValidated] = useState<ValidationStatus>('default');
  const mode = useCurrentRouteKey() === 'workspaceKindCreate' ? 'create' : 'edit';
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
    podConfig: {
      default: '',
      values: [],
    },
  });

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
          <WorkspaceKindFileUpload
            resetData={resetData}
            value={yamlValue}
            setValue={setYamlValue}
            validated={validated}
            setValidated={setValidated}
          />
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
