import React from 'react';
import { Button, List, ListItem } from '@patternfly/react-core';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import { WorkspaceCountPerKind } from '~/app/hooks/useWorkspaceCountPerKind';
import { useTypedNavigate } from '~/app/routerHelper';

type WorkspaceDetailsImagesProps = {
  workspaceKind: WorkspaceKind;
  workspaceCountPerKind: WorkspaceCountPerKind;
};

export const WorkspaceKindDetailsImages: React.FunctionComponent<WorkspaceDetailsImagesProps> = ({
  workspaceKind,
  workspaceCountPerKind,
}) => {
  const navigate = useTypedNavigate();

  return (
    <List isPlain>
      {workspaceKind.podTemplate.options.imageConfig.values.map((image, rowIndex) => (
        <ListItem key={rowIndex}>
          {image.displayName}:{' '}
          <Button
            variant="link"
            isInline
            className="workspace-kind-summary-button"
            onClick={() =>
              navigate('workspaceKindSummary', {
                params: { kind: workspaceKind.name },
                state: {
                  imageId: image.id,
                },
              })
            }
          >
            {
              // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
              workspaceCountPerKind[workspaceKind.name]
                ? workspaceCountPerKind[workspaceKind.name].countByImage[image.id] ?? 0
                : 0
            }
            {' Workspaces'}
          </Button>
        </ListItem>
      ))}
    </List>
  );
};
