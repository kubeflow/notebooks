import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  CardBody,
  CardTitle,
  Card,
  CardHeader,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Toolbar, ToolbarContent } from '@patternfly/react-core/dist/esm/components/Toolbar';
import { WorkspaceKind } from '~/shared/api/backendApiTypes';
import Filter, { FilteredColumn, FilterRef } from '~/shared/components/Filter';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import ImageFallback from '~/shared/components/ImageFallback';
import WithValidImage from '~/shared/components/WithValidImage';
import { defineDataFields, FilterableDataFieldKey } from '~/app/filterableDataHelper';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { fields, filterableLabelMap } = defineDataFields({
  name: { label: 'Name', isFilterable: true, isSortable: false },
});

type FilterableDataFieldKeys = FilterableDataFieldKey<typeof fields>;

type WorkspaceFormKindListProps = {
  allWorkspaceKinds: WorkspaceKind[];
  selectedKind: WorkspaceKind | undefined;
  onSelect: (workspaceKind: WorkspaceKind | undefined) => void;
};

export const WorkspaceFormKindList: React.FunctionComponent<WorkspaceFormKindListProps> = ({
  allWorkspaceKinds,
  selectedKind,
  onSelect,
}) => {
  const [filters, setFilters] = useState<FilteredColumn[]>([]);
  const filterRef = useRef<FilterRef>(null);

  const filteredWorkspaceKinds = useMemo(() => {
    if (allWorkspaceKinds.length === 0) {
      return [];
    }
    return filters.reduce((result, filter) => {
      let regex: RegExp;
      try {
        regex = new RegExp(filter.value, 'i');
      } catch {
        regex = new RegExp(filter.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      }

      return result.filter((kind) => {
        switch (filter.columnKey as FilterableDataFieldKeys) {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          case 'name':
            return kind.name.search(regex) >= 0 || kind.displayName.search(regex) >= 0;
          default:
            return true;
        }
      });
    }, allWorkspaceKinds);
  }, [allWorkspaceKinds, filters]);

  const clearAllFilters = useCallback(() => {
    filterRef.current?.clearAll();
  }, []);

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const newSelectedWorkspaceKind = filteredWorkspaceKinds.find(
        (kind) => kind.name === event.currentTarget.name,
      );
      onSelect(newSelectedWorkspaceKind);
    },
    [filteredWorkspaceKinds, onSelect],
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
        {filteredWorkspaceKinds.length === 0 && (
          <CustomEmptyState onClearFilters={clearAllFilters} />
        )}
        {filteredWorkspaceKinds.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {filteredWorkspaceKinds.map((kind) => (
              <Card
                isCompact
                isSelectable
                key={kind.name}
                id={kind.name.replace(/ /g, '-')}
                isSelected={kind.name === selectedKind?.name}
              >
                <CardHeader
                  selectableActions={{
                    selectableActionId: `selectable-actions-item-${kind.name.replace(/ /g, '-')}`,
                    selectableActionAriaLabelledby: kind.name.replace(/ /g, '-'),
                    name: kind.name,
                    variant: 'single',
                    onChange,
                  }}
                >
                  <WithValidImage
                    imageSrc={kind.logo.url}
                    skeletonWidth="60px"
                    fallback={
                      <ImageFallback
                        imageSrc={kind.logo.url}
                        extended
                        message="Cannot load logo image"
                      />
                    }
                  >
                    {(validSrc) => (
                      <img src={validSrc} alt={`${kind.name} logo`} style={{ maxWidth: '60px' }} />
                    )}
                  </WithValidImage>
                </CardHeader>
                <CardTitle>{kind.displayName}</CardTitle>
                <CardBody>{kind.description}</CardBody>
              </Card>
            ))}
          </Gallery>
        )}
      </PageSection>
    </>
  );
};
