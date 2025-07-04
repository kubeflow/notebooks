import React, { useCallback, useRef, useState } from 'react';
import yaml, { YAMLException } from 'js-yaml';
import {
  FileUpload,
  DropEvent,
  FileUploadHelperText,
  HelperText,
  HelperTextItem,
  Content,
} from '@patternfly/react-core';
import { isValidWorkspaceKindYaml } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { ValidationStatus } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';

interface WorkspaceKindFileUploadProps {
  value: string;
  setValue: (v: string) => void;
  resetData: () => void;
  validated: ValidationStatus;
  setValidated: (type: ValidationStatus) => void;
}

export const WorkspaceKindFileUpload: React.FC<WorkspaceKindFileUploadProps> = ({
  resetData,
  value,
  setValue,
  validated,
  setValidated,
}) => {
  const isYamlFileRef = useRef(false);
  const [filename, setFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileUploadHelperText, setFileUploadHelperText] = useState<string>('');

  const handleFileInputChange = useCallback(
    (_: unknown, file: File) => {
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
    },
    [resetData, setValidated],
  );

  // TODO: Use zod or another TS type coercion/schema for file upload
  const handleDataChange = useCallback(
    (_: DropEvent, v: string) => {
      setValue(v);
      if (isYamlFileRef.current) {
        try {
          const parsed = yaml.load(v);
          if (!isValidWorkspaceKindYaml(parsed)) {
            setFileUploadHelperText('YAML is invalid: must follow WorkspaceKind format.');
            setValidated('error');
            resetData();
          } else {
            setValidated('success');
            setFileUploadHelperText('');
          }
        } catch (e) {
          console.error('Error parsing YAML:', e);
          setFileUploadHelperText(`Error parsing YAML: ${e as YAMLException['reason']}`);
          setValidated('error');
        }
      }
    },
    [setValue, setValidated, resetData],
  );

  const handleClear = useCallback(() => {
    setFilename('');
    setValue('');
    setFileUploadHelperText('');
    setValidated('default');
    resetData();
  }, [resetData, setValidated, setValue]);

  const handleFileReadStarted = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleFileReadFinished = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <Content style={{ height: '100%' }}>
      <FileUpload
        className="workspacekind-file-upload"
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
    </Content>
  );
};
