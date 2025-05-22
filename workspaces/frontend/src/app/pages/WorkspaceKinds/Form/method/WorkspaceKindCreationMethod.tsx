import React, { useCallback, useRef, useState } from 'react';
import yaml, { YAMLException } from 'js-yaml';
import {
  FileUpload,
  DropEvent,
  FileUploadHelperText,
  HelperText,
  HelperTextItem,
  Content,
  Gallery,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Divider,
} from '@patternfly/react-core';
import { UpdateObjectAtPropAndValue } from '~/app/hooks/useGenericObjectState';
import { WorkspaceKindCreateFormData } from '~/app/types';
import { WorkspaceKindCreationMethodTypes } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';
import { isValidWorkspaceKindYaml } from '~/app/pages/WorkspaceKinds/Form/helpers';

interface WorkspaceKindCreationMethodProps {
  method: WorkspaceKindCreationMethodTypes;
  onMethodSelect: (kind: WorkspaceKindCreationMethodTypes) => void;
  setData: UpdateObjectAtPropAndValue<WorkspaceKindCreateFormData>;
  resetData: () => void;
}

export const WorkspaceKindCreationMethod: React.FC<WorkspaceKindCreationMethodProps> = ({
  method,
  onMethodSelect,
  setData,
  resetData,
}) => {
  const isYamlFileRef = useRef(false);
  const [value, setValue] = useState('');
  const [filename, setFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileUploadHelperText, setFileUploadHelperText] = useState<string>('');
  const [validated, setValidated] = useState<'success' | 'error' | 'default'>('default');

  const handleFileInputChange = useCallback(
    (_: unknown, file: File) => {
      if (method === WorkspaceKindCreationMethodTypes.FileUpload) {
        const fileName = file.name;
        setFilename(file.name);
        // if extension is not yaml or yml, raise a flag
        const ext = fileName.split('.').pop();
        const isYaml = ext === 'yml' || ext === 'yaml';
        isYamlFileRef.current = isYaml;
        if (!isYaml) {
          setFileUploadHelperText('Invalid file. Only YAML files are allowed.');
          resetData();
          setValidated('error');
        } else {
          setFileUploadHelperText('');
          setValidated('success');
        }
      }
    },
    [method, resetData],
  );

  const handleDataChange = useCallback(
    (_: DropEvent, v: string) => {
      if (method === WorkspaceKindCreationMethodTypes.FileUpload) {
        setValue(v);
        if (isYamlFileRef.current) {
          try {
            const parsed = yaml.load(v);
            if (isValidWorkspaceKindYaml(parsed)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              setData('properties', (parsed as any).spec.spawner);
              setValidated('success');
              setFileUploadHelperText('');
            } else {
              setFileUploadHelperText('YAML is invalid: must follow WorkspaceKind format.');
              setValidated('error');
              resetData();
            }
          } catch (e) {
            console.error('Error parsing YAML:', e);
            setFileUploadHelperText(`Error parsing YAML: ${e as YAMLException['reason']}`);
            setValidated('error');
          }
        }
      }
    },
    [method, setData, resetData],
  );

  const handleClear = useCallback(() => {
    setFilename('');
    setValue('');
    setFileUploadHelperText('');
    setValidated('default');
    resetData();
  }, [resetData]);

  const handleFileReadStarted = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleFileReadFinished = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleSelect = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      if (event.currentTarget.id === 'selectable-actions-item-manual-input') {
        onMethodSelect(WorkspaceKindCreationMethodTypes.Manual);
        resetData();
      } else {
        onMethodSelect(WorkspaceKindCreationMethodTypes.FileUpload);
      }
    },
    [onMethodSelect, resetData],
  );

  return (
    <Content style={{ height: '100%' }}>
      <p>Select a method to create a Workspace Kind</p>
      <Divider />
      <Gallery
        hasGutter
        aria-label="Selectable card container"
        minWidths={{
          md: '100%',
          lg: '100%',
          xl: '100%',
          '2xl': '100%',
        }}
      >
        <Card
          id="single-selectable-card-manual"
          isSelectable
          isSelected={method === WorkspaceKindCreationMethodTypes.Manual}
        >
          <CardHeader
            selectableActions={{
              selectableActionId: `selectable-actions-item-manual-input`,
              selectableActionAriaLabelledby: 'single-selectable-card-manual',
              name: 'single-selectable-card-manual',
              variant: 'single',
              onChange: handleSelect,
              hasNoOffset: true,
            }}
          >
            <CardTitle>Manual Input</CardTitle>
          </CardHeader>
          <CardBody>
            Continue to manually configure your setup through a guided step-by-step wizard.
          </CardBody>
        </Card>
        <Card
          id="single-selectable-card-file-upload"
          isSelectable
          isSelected={method === WorkspaceKindCreationMethodTypes.FileUpload}
        >
          <CardHeader
            selectableActions={{
              selectableActionId: `selectable-actions-item-file-upload`,
              selectableActionAriaLabelledby: 'single-selectable-card-file-upload',
              name: 'single-selectable-card-file-upload',
              variant: 'single',
              onChange: handleSelect,
              hasNoOffset: true,
            }}
          >
            <CardTitle>Upload a YAML file</CardTitle>
          </CardHeader>
          <CardBody>
            <FileUpload
              id="text-file-simple"
              type="text"
              value={value}
              filename={filename}
              filenamePlaceholder="Drag and drop a YAML file here or upload one"
              onFileInputChange={handleFileInputChange}
              onDataChange={handleDataChange}
              onReadStarted={handleFileReadStarted}
              onReadFinished={handleFileReadFinished}
              onClearClick={handleClear}
              isLoading={isLoading}
              validated={validated}
              isDisabled={method !== WorkspaceKindCreationMethodTypes.FileUpload}
              allowEditingUploadedText={false}
              browseButtonText="Choose File"
            >
              <FileUploadHelperText>
                <HelperText>
                  <HelperTextItem id="helper-text-example-helpText">
                    {fileUploadHelperText}
                  </HelperTextItem>
                </HelperText>
              </FileUploadHelperText>
            </FileUpload>
          </CardBody>
        </Card>
      </Gallery>
    </Content>
  );
};
