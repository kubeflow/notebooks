import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CardTitle,
  Gallery,
  PageSection,
  Toolbar,
  ToolbarContent,
  Card,
  CardHeader,
  CardBody,
} from '@patternfly/react-core';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import { WorkspaceImageConfigValue } from '~/shared/api/backendApiTypes';
import CustomEmptyState from '~/shared/components/CustomEmptyState';

type WorkspaceFormImageListProps = {
  images: WorkspaceImageConfigValue[];
  selectedLabels: Map<string, Set<string>>;
  selectedImage: WorkspaceImageConfigValue | undefined;
  onSelect: (workspaceImage: WorkspaceImageConfigValue | undefined) => void;
};

export const WorkspaceFormImageList: React.FunctionComponent<WorkspaceFormImageListProps> = ({
  images,
  selectedLabels,
  selectedImage,
  onSelect,
}) => {
  const [workspaceImages, setWorkspaceImages] = useState<WorkspaceImageConfigValue[]>(images);
  const [filters, setFilters] = useState<FilteredColumn[]>([]);
  const filterRef = React.useRef<FilterRef>(null);

  const filterableColumns = useMemo(
    () => ({
      name: 'Name',
    }),
    [],
  );

  const getFilteredWorkspaceImagesByLabels = useCallback(
    (unfilteredImages: WorkspaceImageConfigValue[]) =>
      unfilteredImages.filter((image) =>
        image.labels.reduce((accumulator, label) => {
          if (selectedLabels.has(label.key)) {
            const labelValues: Set<string> | undefined = selectedLabels.get(label.key);
            return accumulator && labelValues !== undefined && labelValues.has(label.value);
          }
          return accumulator;
        }, true),
      ),
    [selectedLabels],
  );

  const clearAllFilters = useCallback(() => {
    filterRef.current?.clearAll();
  }, []);

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspaceImage = workspaceImages.find(
        (image) => image.displayName === event.currentTarget.name,
      );
      onSelect(newSelectedWorkspaceImage);
    },
    [workspaceImages, onSelect],
  );

  useEffect(() => {
    // Search name with search value
    let filteredWorkspaceImages = images;

    filters.forEach((filter) => {
      let searchValueInput: RegExp;
      try {
        searchValueInput = new RegExp(filter.value, 'i');
      } catch {
        searchValueInput = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      filteredWorkspaceImages = filteredWorkspaceImages.filter((image) => {
        if (filter.value === '') {
          return true;
        }
        switch (filter.columnName) {
          case filterableColumns.name:
            return (
              image.id.search(searchValueInput) >= 0 ||
              image.displayName.search(searchValueInput) >= 0
            );
          default:
            return true;
        }
      });
    });

    setWorkspaceImages(getFilteredWorkspaceImagesByLabels(filteredWorkspaceImages));
  }, [filterableColumns, filters, images, selectedLabels, getFilteredWorkspaceImagesByLabels]);

  return (
    <>
      <PageSection>
        <Toolbar id="toolbar-group-types">
          <ToolbarContent>
            <Filter
              ref={filterRef}
              id="filter-workspace-images"
              onFilter={setFilters}
              columnNames={filterableColumns}
            />
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <PageSection isFilled>
        {workspaceImages.length === 0 && <CustomEmptyState onClearFilters={clearAllFilters} />}
        {workspaceImages.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {workspaceImages.map((image) => (
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
