import React, { useEffect, useMemo, useState } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormImageList } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageList';
import {
  ExtraFilter,
  FilterByLabels,
} from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { computeDefaultFilterValues } from '~/app/pages/Workspaces/Form/utils/filterDefaults';

interface WorkspaceFormImageSelectionProps {
  images: WorkspacekindsImageConfigValue[];
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  onSelect: (image: WorkspacekindsImageConfigValue | undefined) => void;
  defaultImageId?: string;
}

const WorkspaceFormImageSelection: React.FunctionComponent<WorkspaceFormImageSelectionProps> = ({
  images,
  selectedImage,
  onSelect,
  defaultImageId,
}) => {
  const [filteredImages, setFilteredImages] = useState<WorkspacekindsImageConfigValue[]>(images);

  const defaultFilterValues = useMemo(
    () => computeDefaultFilterValues(images, defaultImageId),
    [images, defaultImageId],
  );

  const extraFilters: ExtraFilter<WorkspacekindsImageConfigValue>[] = useMemo(
    () => [
      {
        label: 'Show hidden',
        value: defaultFilterValues.showHidden,
        key: 'showHidden',
        matchesFilter: (image: WorkspacekindsImageConfigValue, value: boolean) =>
          value || !image.hidden,
      },
      {
        label: 'Show redirected',
        value: defaultFilterValues.showRedirected,
        key: 'showRedirected',
        matchesFilter: (image: WorkspacekindsImageConfigValue, value: boolean) =>
          value || image.redirect === undefined,
      },
    ],
    [defaultFilterValues],
  );

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    const isSelectedInFilteredList = filteredImages.some((image) => image.id === selectedImage.id);

    if (!isSelectedInFilteredList) {
      onSelect(undefined);
    }
  }, [filteredImages, selectedImage, onSelect]);

  const imageFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={images}
        setLabelledObjects={(obj) => setFilteredImages(obj as WorkspacekindsImageConfigValue[])}
        extraFilters={extraFilters}
      />
    ),
    [images, setFilteredImages, extraFilters],
  );

  return (
    <Content style={{ height: '100%' }}>
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{imageFilterContent}</SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormImageList
            images={filteredImages}
            allImages={images}
            selectedImage={selectedImage}
            onSelect={onSelect}
            defaultImageId={defaultImageId}
          />
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormImageSelection };
