import React, { useCallback, useMemo, useState } from 'react';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import ToolbarFilter, { FilterConfigMap } from '~/shared/components/ToolbarFilter';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { WorkspaceFormOptionCard } from '~/app/pages/Workspaces/Form/shared/WorkspaceFormOptionCard';
import { moveDefaultToFront } from '~/app/pages/Workspaces/Form/utils/optionOrdering';

type ImageFilterKey = 'name';

const filterConfig = {
  name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
} as const satisfies FilterConfigMap<ImageFilterKey>;

const visibleFilterKeys: readonly ImageFilterKey[] = ['name'];

const filterableProperties: Record<
  ImageFilterKey,
  (item: WorkspacekindsImageConfigValue) => string
> = {
  name: (image) => `${image.id} ${image.displayName}`,
};

type WorkspaceFormImageListProps = {
  filteredImages: WorkspacekindsImageConfigValue[];
  allImages: WorkspacekindsImageConfigValue[];
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  onSelect: (workspaceImage: WorkspacekindsImageConfigValue | undefined) => void;
  defaultImageId?: string;
};

export const WorkspaceFormImageList: React.FunctionComponent<WorkspaceFormImageListProps> = ({
  filteredImages,
  allImages,
  selectedImage,
  onSelect,
  defaultImageId,
}) => {
  const { filterValues, setFilter, clearAllFilters } =
    useToolbarFilters<ImageFilterKey>(filterConfig);
  const [activePopoverId, setActivePopoverId] = useState<string | null>(null);
  const [pinnedPopoverId, setPinnedPopoverId] = useState<string | null>(null);

  const reorderedImages = useMemo(
    () => moveDefaultToFront(filteredImages, defaultImageId),
    [filteredImages, defaultImageId],
  );

  const filteredWorkspaceImages = useMemo(
    () => applyFilters(reorderedImages, filterValues, filterableProperties),
    [reorderedImages, filterValues],
  );

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspaceImage = filteredWorkspaceImages.find(
        (image) => image.displayName === event.currentTarget.name,
      );
      onSelect(newSelectedWorkspaceImage);
    },
    [filteredWorkspaceImages, onSelect],
  );

  const handleCardClick = useCallback(
    (image: WorkspacekindsImageConfigValue) => {
      if (image.id !== selectedImage?.id) {
        return;
      }
      onSelect(image);
    },
    [selectedImage, onSelect],
  );

  return (
    <>
      <PageSection>
        <ToolbarFilter
          filterConfig={filterConfig}
          visibleFilterKeys={visibleFilterKeys}
          filterValues={filterValues}
          onFilterChange={setFilter}
          onClearAllFilters={clearAllFilters}
          testIdPrefix="image-filter"
        />
      </PageSection>
      <PageSection isFilled>
        {filteredWorkspaceImages.length === 0 && (
          <CustomEmptyState onClearFilters={clearAllFilters} />
        )}
        {filteredWorkspaceImages.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {filteredWorkspaceImages.map((image) => (
              <WorkspaceFormOptionCard
                key={image.id}
                option={image}
                allOptions={allImages}
                isSelected={image.id === selectedImage?.id}
                isDefault={image.id === defaultImageId}
                onClick={handleCardClick}
                onChange={onChange}
                activePopoverId={activePopoverId}
                pinnedPopoverId={pinnedPopoverId}
                onActivePopoverChange={setActivePopoverId}
                onPinnedPopoverChange={setPinnedPopoverId}
              />
            ))}
          </Gallery>
        )}
      </PageSection>
    </>
  );
};
