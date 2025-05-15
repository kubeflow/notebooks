import React, { useMemo, useState, useCallback } from 'react';
import { Content, Divider, Split, SplitItem } from '@patternfly/react-core';
import { WorkspaceCreationImageDetails } from '~/app/pages/Workspaces/Creation/image/WorkspaceCreationImageDetails';
import { WorkspaceCreationImageList } from '~/app/pages/Workspaces/Creation/image/WorkspaceCreationImageList';
import { FilterByLabels } from '~/app/pages/Workspaces/Creation/labelFilter/FilterByLabels';
import { WorkspaceImageConfigValue } from '~/shared/api/backendApiTypes';
import { WorkspaceCreationDrawer } from '~/app/pages/Workspaces/Creation/WorkspaceCreationDrawer';

interface WorkspaceCreationImageSelectionProps {
  images: WorkspaceImageConfigValue[];
  selectedImage: WorkspaceImageConfigValue | undefined;
  onSelect: (image: WorkspaceImageConfigValue | undefined) => void;
}

const WorkspaceCreationImageSelection: React.FunctionComponent<
  WorkspaceCreationImageSelectionProps
> = ({ images, selectedImage, onSelect }) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());
  const [isExpanded, setIsExpanded] = useState(false);
  const drawerRef = React.useRef<HTMLSpanElement>(undefined);

  const onExpand = useCallback(() => {
    if (drawerRef.current) {
      drawerRef.current.focus();
    }
  }, []);

  const onClick = useCallback(
    (image?: WorkspaceImageConfigValue) => {
      setIsExpanded(true);
      onSelect(image);
    },
    [onSelect],
  );

  const onCloseClick = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const imageFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={images.flatMap((image) => image.labels)}
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
      <WorkspaceCreationDrawer
        title="Image"
        info={imageDetailsContent}
        isExpanded={isExpanded}
        onCloseClick={onCloseClick}
        onExpand={onExpand}
      >
        <Split hasGutter>
          <SplitItem style={{ minWidth: '200px' }}>{imageFilterContent}</SplitItem>
          <SplitItem isFilled>
            <WorkspaceCreationImageList
              images={images}
              selectedLabels={selectedLabels}
              selectedImage={selectedImage}
              onSelect={onClick}
            />
          </SplitItem>
        </Split>
      </WorkspaceCreationDrawer>
    </Content>
  );
};

export { WorkspaceCreationImageSelection };
