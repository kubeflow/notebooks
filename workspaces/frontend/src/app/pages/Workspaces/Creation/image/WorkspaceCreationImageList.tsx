import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CardTitle,
  Gallery,
  PageSection,
  Toolbar,
  ToolbarContent,
  Card,
  CardHeader,
  EmptyState,
  EmptyStateBody,
  CardBody,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons/dist/esm/icons/search-icon';
import { WorkspaceImage } from '~/shared/types';
import Filter, { FilteredColumn } from '~/shared/components/Filter';

type WorkspaceCreationImageListProps = {
  images: WorkspaceImage[];
  selectedLabels: Map<string, Set<string>>;
  selectedImage: WorkspaceImage | undefined;
  onSelect: (workspaceImage: WorkspaceImage | undefined) => void;
};

export const WorkspaceCreationImageList: React.FunctionComponent<
  WorkspaceCreationImageListProps
> = ({ images, selectedLabels, selectedImage, onSelect }) => {
  const [workspaceImages, setWorkspaceImages] = useState<WorkspaceImage[]>(images);
  const [filters, setFilters] = useState<FilteredColumn[]>([]);

  const filterableColumns = useMemo(
    () => ({
      name: 'Name',
    }),
    [],
  );

  const getFilteredWorkspaceImagesByLabels = useCallback(
    (unfilteredImages: WorkspaceImage[]) =>
      unfilteredImages.filter((image) =>
        Object.keys(image.labels).reduce((accumulator, labelKey) => {
          const labelValue = image.labels[labelKey];
          if (selectedLabels.has(labelKey)) {
            const labelValues: Set<string> | undefined = selectedLabels.get(labelKey);
            return accumulator && labelValues !== undefined && labelValues.has(labelValue);
          }
          return accumulator;
        }, true),
      ),
    [selectedLabels],
  );

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
              id="filter-workspace-images"
              onFilter={setFilters}
              columnNames={filterableColumns}
            />
          </ToolbarContent>
        </Toolbar>
      </PageSection>
      <PageSection isFilled>
        {workspaceImages.length === 0 && (
          <EmptyState titleText="No results found" headingLevel="h4" icon={SearchIcon}>
            <EmptyStateBody>
              No results match the filter criteria. Clear all filters and try again.
            </EmptyStateBody>
          </EmptyState>
        )}
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
