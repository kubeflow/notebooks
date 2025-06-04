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
  Radio,
} from '@patternfly/react-core';
import { UpdateObjectAtPropAndValue } from '~/app/hooks/useGenericObjectState';
import { WorkspaceKindCreate } from '~/shared/api/backendApiTypes';
import { WorkspaceKindCreationMethodTypes } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';
import { isValidWorkspaceKindYaml } from '~/app/pages/WorkspaceKinds/Form/helpers';

interface WorkspaceKindCreationMethodProps {
  method: WorkspaceKindCreationMethodTypes;
  onMethodSelect: (kind: WorkspaceKindCreationMethodTypes) => void;
  setData: UpdateObjectAtPropAndValue<WorkspaceKindCreate>;
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

  // TODO: Use zod or another TS type coercion/schema for file upload
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
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const parsedImg = (parsed as any).spec.podTemplate.options.imageConfig;
              setData('imageConfig', {
                default: parsedImg.spawner.default || '',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                values: parsedImg.values.map((img: any) => {
                  const res = {
                    id: img.id,
                    redirect: img.redirect,
                    ...img.spawner,
                    ...img.spec,
                  };
                  return res;
                }),
              });
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

  return (
    <Content style={{ height: '100%' }}>
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
        <Radio
          isChecked={method === WorkspaceKindCreationMethodTypes.FileUpload}
          onChange={() => onMethodSelect(WorkspaceKindCreationMethodTypes.FileUpload)}
          label="Upload a YAML file"
          id="selectable-actions-item-file-upload"
          name="selectable-actions-item-file-upload"
          body={
            method === WorkspaceKindCreationMethodTypes.FileUpload && (
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
            )
          }
        />
        <Radio
          isChecked={method === WorkspaceKindCreationMethodTypes.Manual}
          onChange={() => onMethodSelect(WorkspaceKindCreationMethodTypes.Manual)}
          label="Manual Input"
          id="selectable-actions-item-manual-input"
          name="selectable-actions-item-manual-input"
          description="Continue to manually configure your setup through a guided step-by-step wizard."
        />
      </Gallery>
    </Content>
  );
};
