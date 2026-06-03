import React, { useCallback, useRef } from 'react';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import { configureMonacoYaml } from 'monaco-yaml';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import workspaceKindUpdateSchema from './workspaceKindUpdateSchema.json';

type WorkspaceKindYamlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
};

const SCHEMA_URI = 'https://kubeflow.org/schemas/workspacekind-update.json';
const MODEL_URI = 'file:///workspacekind-update.yaml';

export const WorkspaceKindYamlEditor: React.FC<WorkspaceKindYamlEditorProps> = ({
  value,
  onChange,
  error,
}) => {
  const monacoYamlRef = useRef<ReturnType<typeof configureMonacoYaml> | null>(null);

  const handleBeforeMount = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monaco: any) => {
      window.MonacoEnvironment = {
        getWorker(_moduleId: string, label: string) {
          if (label === 'yaml') {
            return new Worker(new URL('monaco-yaml/yaml.worker', import.meta.url));
          }
          return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url));
        },
      };

      monacoYamlRef.current?.dispose();
      monacoYamlRef.current = configureMonacoYaml(monaco, {
        enableSchemaRequest: false,
        hover: true,
        completion: true,
        validate: true,
        schemas: [
          {
            uri: SCHEMA_URI,
            fileMatch: [MODEL_URI],
            schema: workspaceKindUpdateSchema,
          },
        ],
      });
    },
    [],
  );

  return (
    <Stack hasGutter data-testid="yaml-editor">
      <StackItem isFilled style={{ minHeight: '500px' }}>
        <CodeEditor
          isLineNumbersVisible
          isLanguageLabelVisible={false}
          height="100%"
          code={value}
          onChange={onChange}
          language={Language.yaml}
          editorProps={{
            beforeMount: handleBeforeMount,
            path: MODEL_URI,
          }}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
          }}
        />
      </StackItem>
      {error && (
        <StackItem>
          <HelperText data-testid="yaml-parse-error">
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        </StackItem>
      )}
    </Stack>
  );
};
