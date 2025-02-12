import React from 'react';
import { CodeEditor, CodeEditorProps, Language } from '@patternfly/react-code-editor';
import yaml from 'js-yaml';

const mockYaml = `apiVersion: kubeflow.org/v1beta1
kind: Workspace
metadata:
  name: jupyterlab-workspace
spec:
  paused: false
  deferUpdates: false
  kind: "jupyterlab"
  podTemplate:
    podMetadata:
      labels: {}
      annotations: {}
    volumes:
      home: "workspace-home-pvc"
      data:
        - pvcName: "workspace-data-pvc"
          mountPath: "/data/my-data"
          readOnly: false
    options:
      imageConfig: "jupyterlab_scipy_190"
      podConfig: "tiny_cpu"`;
type WorkspaceDetailsPodTemplateProps = Omit<CodeEditorProps, 'ref'> & {
  testId?: string;
  codeEditorHeight?: string;
};
const parsedYaml = yaml.load(mockYaml);
const podTemplateYaml = yaml.dump(parsedYaml || {});
export const WorkspaceDetailsPodTemplate: React.FC<Partial<WorkspaceDetailsPodTemplateProps>> = ({
  // 38px is the code editor toolbar height+border
  // calculate the div height to avoid container scrolling
  height = 'calc(100% - 38px)',
  codeEditorHeight = '650px',
  ...props
}) => (
  <div data-testid={props.testId} style={{ height, padding: '14px' }}>
    <CodeEditor
      isLineNumbersVisible
      isReadOnly
      isDownloadEnabled
      code={podTemplateYaml || '# No pod template data available'}
      height={codeEditorHeight}
      language={Language.yaml}
      {...props}
    />
  </div>
);
