import React, { useCallback, useRef } from 'react';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import { configureMonacoYaml } from 'monaco-yaml';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { WORKSPACE_KIND_EXAMPLES_URL } from '~/shared/utilities/const';
import workspaceKindUpdateSchema from './workspaceKindUpdateSchema.json';

type WorkspaceKindYamlEditorProps = {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
};

const MODEL_URI = 'file:///workspacekind-update.yaml';

export const WorkspaceKindYamlEditor: React.FC<WorkspaceKindYamlEditorProps> = ({
  value,
  onChange,
  error,
}) => {
  const monacoYamlRef = useRef<ReturnType<typeof configureMonacoYaml> | null>(null);

  const handleBeforeMount = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (monacoInstance: any) => {
      monacoYamlRef.current?.dispose();
      monacoYamlRef.current = configureMonacoYaml(monacoInstance, {
        enableSchemaRequest: false,
        hover: true,
        completion: true,
        validate: true,
        schemas: [
          {
            uri: WORKSPACE_KIND_EXAMPLES_URL,
            fileMatch: [MODEL_URI],
            schema: workspaceKindUpdateSchema,
          },
        ],
      });
    },
    [],
  );

  return (
    <Flex
      direction={{ default: 'column' }}
      style={{ height: '100%', minHeight: '500px' }}
      data-testid="yaml-editor"
    >
      <FlexItem flex={{ default: 'flex_1' }}>
        <CodeEditor
          isLineNumbersVisible
          isLanguageLabelVisible={false}
          isFullHeight
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
      </FlexItem>
      {error && (
        <FlexItem>
          <HelperText data-testid="yaml-parse-error">
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        </FlexItem>
      )}
    </Flex>
  );
};
