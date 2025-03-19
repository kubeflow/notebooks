import * as React from 'react';
import { Content, Divider, Split, SplitItem } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { WorkspaceKind } from '~/shared/types';
import { WorkspaceCreationKindDetails } from '~/app/pages/Workspaces/Creation/WorkspaceCreationKindDetails';
import { WorkspaceCreationKindList } from '~/app/pages/Workspaces/Creation/WorkspaceCreationKindList';

const WorkspaceCreationKindSelection: React.FunctionComponent = () => {
  /* Replace mocks below for BFF call */
  const mockedWorkspaceKind: WorkspaceKind = useMemo(
    () => ({
      name: 'jupyter-lab1',
      displayName: 'JupyterLab Notebook',
      description: 'A Workspace which runs JupyterLab in a Pod',
      deprecated: false,
      deprecationMessage: '',
      hidden: false,
      icon: {
        url: 'https://jupyter.org/assets/favicons/apple-touch-icon-152x152.png',
      },
      logo: {
        url: 'https://upload.wikimedia.org/wikipedia/commons/3/38/Jupyter_logo.svg',
      },
      podTemplate: {
        podMetadata: {
          labels: { myWorkspaceKindLabel: 'my-value' },
          annotations: { myWorkspaceKindAnnotation: 'my-value' },
        },
        volumeMounts: { home: '/home/jovyan' },
        options: {
          imageConfig: {
            default: 'jupyterlab_scipy_190',
            values: [
              {
                id: 'jupyterlab_scipy_180',
                displayName: 'jupyter-scipy:v1.8.0',
                labels: { pythonVersion: '3.11' },
                hidden: true,
                redirect: {
                  to: 'jupyterlab_scipy_190',
                  message: {
                    text: 'This update will change...',
                    level: 'Info',
                  },
                },
              },
              {
                id: 'jupyterlab_scipy_190',
                displayName: 'jupyter-scipy:v1.9.0',
                labels: { pythonVersion: '3.11' },
                hidden: true,
                redirect: {
                  to: 'jupyterlab_scipy_200',
                  message: {
                    text: 'This update will change...',
                    level: 'Warning',
                  },
                },
              },
            ],
          },
          podConfig: {
            default: 'tiny_cpu',
            values: [
              {
                id: 'tiny_cpu',
                displayName: 'Tiny CPU',
                description: 'Pod with 0.1 CPU, 128 Mb RAM',
                labels: { cpu: '100m', memory: '128Mi' },
                redirect: {
                  to: 'small_cpu',
                  message: {
                    text: 'This update will change...',
                    level: 'Danger',
                  },
                },
              },
            ],
          },
        },
      },
    }),
    [],
  );

  /* Replace mocks below for BFF call */
  const allWorkspaceKinds = useMemo(() => {
    const kinds: WorkspaceKind[] = [];

    for (let i = 1; i <= 15; i++) {
      const kind = { ...mockedWorkspaceKind };
      kind.name += i;
      kind.displayName += ` ${i}`;
      kind.podTemplate = { ...mockedWorkspaceKind.podTemplate };
      kind.podTemplate.podMetadata = { ...mockedWorkspaceKind.podTemplate.podMetadata };
      kind.podTemplate.podMetadata.labels = {
        ...mockedWorkspaceKind.podTemplate.podMetadata.labels,
      };
      kind.podTemplate.podMetadata.labels[`my-label-key-${Math.ceil(i / 4)}`] =
        `my-label-value-${Math.ceil(i)}`;
      kinds.push(kind);
    }

    return kinds;
  }, [mockedWorkspaceKind]);

  const [selectedKind, setSelectedKind] = useState<WorkspaceKind>();

  const kindDetailsContent = useMemo(
    () => <WorkspaceCreationKindDetails workspaceKind={selectedKind} />,
    [selectedKind],
  );

  return (
    <Content style={{ height: '100%' }}>
      <p>Select a workspace kind to use for the workspace.</p>
      <Divider />
      <Split hasGutter>
        <SplitItem isFilled>
          <WorkspaceCreationKindList
            allWorkspaceKinds={allWorkspaceKinds}
            onSelect={(workspaceKind) => setSelectedKind(workspaceKind)}
          />
        </SplitItem>
        <SplitItem style={{ minWidth: '200px' }}>{kindDetailsContent}</SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceCreationKindSelection };
