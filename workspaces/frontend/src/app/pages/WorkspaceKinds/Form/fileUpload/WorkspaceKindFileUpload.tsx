import React, { useCallback, useState } from 'react';
import yaml, { YAMLException } from 'js-yaml';
import {
  FileUpload,
  DropEvent,
  FileUploadHelperText,
  HelperText,
  HelperTextItem,
  Content,
  DropzoneErrorCode,
} from '@patternfly/react-core';
import { isValidWorkspaceKindYaml } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { ValidationStatus } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindForm';

interface WorkspaceKindFileUploadProps {
  value: string;
  setValue: (v: string) => void;
  resetData: () => void;
  validated: ValidationStatus;
  setValidated: (type: ValidationStatus) => void;
  onClear: () => void;
}

const YAML_MIME_TYPE = 'application/x-yaml';
const YAML_EXTENSIONS = ['.yml', '.yaml'];

export const WorkspaceKindFileUpload: React.FC<WorkspaceKindFileUploadProps> = ({
  resetData,
  value,
  setValue,
  validated,
  setValidated,
  onClear,
}) => {
  const [filename, setFilename] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [fileUploadHelperText, setFileUploadHelperText] = useState<string | undefined>();

  const handleFileInputChange = useCallback(
    (_: unknown, file: File) => {
      onClear();
      setFilename(file.name);
      setFileUploadHelperText(undefined);
      setValidated('success');
    },
    [setValidated, onClear],
  );

  // TODO: Use zod or another TS type coercion/schema for file upload
  const handleDataChange = useCallback(
    (_: DropEvent, v: string) => {
      setValue(v);
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
    },
    [setValue, setValidated, resetData],
  );

  const handleClear = useCallback(() => {
    setFilename('');
    setValue('');
    setFileUploadHelperText('');
    setValidated('default');
    resetData();
    onClear();
  }, [resetData, setValidated, setValue, onClear]);

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
        dropzoneProps={{
          accept: { [YAML_MIME_TYPE]: YAML_EXTENSIONS },
          onDropRejected: (rejections) => {
            const error = rejections[0]?.errors?.[0] ?? {};
            setFileUploadHelperText(
              error.code === DropzoneErrorCode.FileInvalidType
                ? 'Invalid file. Only YAML files are allowed.'
                : error.message,
            );
          },
        }}
      >
        {fileUploadHelperText && (
          <FileUploadHelperText>
            <HelperText>
              <HelperTextItem id="helper-text-example-helpText" variant="error">
                {fileUploadHelperText}
              </HelperTextItem>
            </HelperText>
          </FileUploadHelperText>
        )}
      </FileUpload>
    </Content>
  );
};
