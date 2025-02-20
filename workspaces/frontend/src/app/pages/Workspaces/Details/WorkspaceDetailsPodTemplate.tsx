import React from 'react';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
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

export const WorkspaceDetailsPodTemplate: React.FunctionComponent = () => {
  const parsedYaml = yaml.load(mockYaml);
  const podTemplateYaml = yaml.dump(parsedYaml || {});

  return (
    <CodeEditor
      isLineNumbersVisible
      height="100%"
      isReadOnly
      isDownloadEnabled
      code={podTemplateYaml || '# No pod template data available'}
      language={Language.yaml}
    />
  );
};
