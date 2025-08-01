import React, { useMemo, useState } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormImageList } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageList';
import { FilterByLabels } from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';

interface WorkspaceFormImageSelectionProps {
  images: WorkspacekindsImageConfigValue[];
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  onSelect: (image: WorkspacekindsImageConfigValue | undefined) => void;
}

const WorkspaceFormImageSelection: React.FunctionComponent<WorkspaceFormImageSelectionProps> = ({
  images,
  selectedImage,
  onSelect,
}) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());

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

  return (
    <Content style={{ height: '100%' }}>
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{imageFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormImageList
            images={images}
            selectedLabels={selectedLabels}
            selectedImage={selectedImage}
            onSelect={onSelect}
          />
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormImageSelection };
