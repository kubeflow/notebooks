import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Content, Split, SplitItem } from '@patternfly/react-core';
import { WorkspaceFormImageDetails } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageDetails';
import { WorkspaceFormImageList } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageList';
import { FilterByLabels } from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspaceImageConfigValue } from '~/shared/api/backendApiTypes';
import { WorkspaceFormDrawer } from '~/app/pages/Workspaces/Form/WorkspaceFormDrawer';

interface WorkspaceFormImageSelectionProps {
  images: WorkspaceImageConfigValue[];
  selectedImage: WorkspaceImageConfigValue | undefined;
  onSelect: (image: WorkspaceImageConfigValue | undefined) => void;
}

const WorkspaceFormImageSelection: React.FunctionComponent<WorkspaceFormImageSelectionProps> = ({
  images,
  selectedImage,
  onSelect,
}) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());
  const [isExpanded, setIsExpanded] = useState(false);
  const drawerRef = useRef<HTMLSpanElement>(undefined);

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
    () => <WorkspaceFormImageDetails workspaceImage={selectedImage} />,
    [selectedImage],
  );

  return (
    <Content style={{ height: '100%' }}>
      <WorkspaceFormDrawer
        title="Image"
        info={imageDetailsContent}
        isExpanded={isExpanded}
        onCloseClick={onCloseClick}
        onExpand={onExpand}
      >
        <Split hasGutter>
          <SplitItem style={{ minWidth: '200px' }}>{imageFilterContent}</SplitItem>
          <SplitItem isFilled>
            <WorkspaceFormImageList
              images={images}
              selectedLabels={selectedLabels}
              selectedImage={selectedImage}
              onSelect={onClick}
            />
          </SplitItem>
        </Split>
      </WorkspaceFormDrawer>
    </Content>
  );
};

export { WorkspaceFormImageSelection };
