import * as React from 'react';
import { Content, Divider, Split, SplitItem } from '@patternfly/react-core';
import { useMemo, useState } from 'react';
import { WorkspaceImage } from '~/shared/types';
import { WorkspaceCreationImageDetails } from '~/app/pages/Workspaces/Creation/WorkspaceCreationImageDetails';
import { WorkspaceCreationImageList } from '~/app/pages/Workspaces/Creation/WorkspaceCreationImageList';
import { WorkspaceCreationImageFilter } from '~/app/pages/Workspaces/Creation/WorkspaceCreationImageFilter';

interface WorkspaceCreationImageSelectionProps {
  images: WorkspaceImage[];
  selectedImage: WorkspaceImage | undefined;
  onSelect: (image: WorkspaceImage) => void;
}

const WorkspaceCreationImageSelection: React.FunctionComponent<
  WorkspaceCreationImageSelectionProps
> = ({ images, selectedImage, onSelect }) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());

  const imageFilterContent = useMemo(
    () => (
      <WorkspaceCreationImageFilter
        images={images}
        selectedLabels={selectedLabels}
        onSelect={setSelectedLabels}
      />
    ),
    [images, selectedLabels, setSelectedLabels],
  );

  const imageDetailsContent = useMemo(
    () => <WorkspaceCreationImageDetails workspaceImage={selectedImage} />,
    [selectedImage],
  );

  return (
    <Content style={{ height: '100%' }}>
      <p>Select a workspace image and image version to use for the workspace.</p>
      <Divider />
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{imageFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceCreationImageList
            images={images}
            selectedLabels={selectedLabels}
            selectedImage={selectedImage}
            onSelect={onSelect}
          />
        </SplitItem>
        <SplitItem style={{ minWidth: '200px' }}>{imageDetailsContent}</SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceCreationImageSelection };
