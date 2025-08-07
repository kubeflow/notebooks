import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  CardTitle,
  Card,
  CardHeader,
  CardBody,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Toolbar, ToolbarContent } from '@patternfly/react-core/dist/esm/components/Toolbar';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import { defineDataFields, FilterableDataFieldKey } from '~/app/filterableDataHelper';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { fields, filterableLabelMap } = defineDataFields({
  name: { label: 'Name', isFilterable: true, isSortable: false },
});

type FilterableDataFieldKeys = FilterableDataFieldKey<typeof fields>;

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
  const [filters, setFilters] = useState<FilteredColumn[]>([]);
  const filterRef = useRef<FilterRef>(null);

  const clearAllFilters = useCallback(() => {
    filterRef.current?.clearAll();
  }, []);

  const filteredWorkspaceImages = useMemo(() => {
    if (images.length === 0) {
      return [];
    }

    return filters.reduce((result, filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      return result.filter((image) => {
        if (filter.value === '') {
          return true;
        }
        switch (filter.columnKey as FilterableDataFieldKeys) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          case 'name':
            return (
              image.id.search(searchValueInput) >= 0 ||
              image.displayName.search(searchValueInput) >= 0
            );
          default:
            return true;
        }
      });
    }, images);
  }, [filters, images]);

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspaceImage = filteredWorkspaceImages.find(
        (image) => image.displayName === event.currentTarget.name,
      );
      onSelect(newSelectedWorkspaceImage);
    },
    [filteredWorkspaceImages, onSelect],
  );

  return (
    <>
      <PageSection>
        <Toolbar id="toolbar-group-types">
          <ToolbarContent>
            <Filter
              ref={filterRef}
              id="filter-workspace-images"
              filters={filters}
              setFilters={setFilters}
              columnDefinition={filterableLabelMap}
            />
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <PageSection isFilled>
        {filteredWorkspaceImages.length === 0 && (
          <CustomEmptyState onClearFilters={clearAllFilters} />
        )}
        {filteredWorkspaceImages.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {filteredWorkspaceImages.map((image) => (
              <Card
                isCompact
                isSelectable
                key={image.id}
                id={image.id.replace(/ /g, '-')}
                isSelected={image.id === selectedImage?.id}
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
