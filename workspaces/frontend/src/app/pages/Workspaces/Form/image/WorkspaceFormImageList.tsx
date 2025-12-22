import React, { useCallback, useMemo } from 'react';
import {
  CardTitle,
  Card,
  CardHeader,
  CardBody,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import ToolbarFilter, { FilterConfigMap } from '~/shared/components/ToolbarFilter';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';

type ImageFilterKey = 'name';

const filterConfig = {
  name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
} as const satisfies FilterConfigMap<ImageFilterKey>;

const visibleFilterKeys: readonly ImageFilterKey[] = ['name'];

const filterableProperties: Record<
  ImageFilterKey,
  (item: WorkspacekindsImageConfigValue) => string
> = {
  // Combine id and displayName for matching (separated by space so regex can match either)
  name: (image) => `${image.id} ${image.displayName}`,
};

type WorkspaceFormImageListProps = {
  images: WorkspacekindsImageConfigValue[];
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  onSelect: (workspaceImage: WorkspacekindsImageConfigValue | undefined) => void;
};

export const WorkspaceFormImageList: React.FunctionComponent<WorkspaceFormImageListProps> = ({
  images,
  selectedImage,
  onSelect,
}) => {
  const { filterValues, setFilter, clearAllFilters } =
    useToolbarFilters<ImageFilterKey>(filterConfig);

  const filteredWorkspaceImages = useMemo(
    () => applyFilters(images, filterValues, filterableProperties),
    [images, filterValues],
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
            {filteredWorkspaceImages
              .filter((image) => !image.hidden)
              .map((image) => (
                <Card
                  isCompact
                  isSelectable
                  key={image.id}
                  id={image.id.replace(/ /g, '-')}
                  isSelected={image.id === selectedImage?.id}
                  onClick={() => handleCardClick(image)}
                >
                  <CardHeader
                    selectableActions={{
                      selectableActionId: `selectable-actions-item-${image.id.replace(/ /g, '-')}`,
                      selectableActionAriaLabelledby: image.displayName.replace(/ /g, '-'),
                      name: image.displayName,
                      variant: 'single',
                      onChange,
                    }}
                  >
                    <CardTitle>{image.displayName}</CardTitle>
                    <CardBody>{image.id}</CardBody>
                  </CardHeader>
                </Card>
              ))}
          </Gallery>
        )}
      </PageSection>
    </>
  );
};
