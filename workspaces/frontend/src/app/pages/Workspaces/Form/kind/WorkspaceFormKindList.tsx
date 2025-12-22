import React, { useCallback, useMemo } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';
import {
  CardBody,
  CardTitle,
  Card,
  CardHeader,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import ToolbarFilter, { FilterConfigMap } from '~/shared/components/ToolbarFilter';
import { useToolbarFilters, applyFilters } from '~/shared/hooks/useToolbarFilters';
import CustomEmptyState from '~/shared/components/CustomEmptyState';
import ImageFallback from '~/shared/components/ImageFallback';
import WithValidImage from '~/shared/components/WithValidImage';
import { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';

type KindFilterKey = 'name';

const filterConfig = {
  name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
} as const satisfies FilterConfigMap<KindFilterKey>;

const visibleFilterKeys: readonly KindFilterKey[] = ['name'];

const filterableProperties: Record<KindFilterKey, (item: WorkspacekindsWorkspaceKind) => string> = {
  // Combine name and displayName for matching (separated by space so regex can match either)
  name: (kind) => `${kind.name} ${kind.displayName}`,
};

type WorkspaceFormKindListProps = {
  allWorkspaceKinds: WorkspacekindsWorkspaceKind[];
  selectedKind: WorkspacekindsWorkspaceKind | undefined;
  onSelect: (workspaceKind: WorkspacekindsWorkspaceKind | undefined) => void;
  isSelectionDisabled: boolean;
};

export const WorkspaceFormKindList: React.FunctionComponent<WorkspaceFormKindListProps> = ({
  allWorkspaceKinds,
  selectedKind,
  onSelect,
  isSelectionDisabled,
}) => {
  const { filterValues, setFilter, clearAllFilters } =
    useToolbarFilters<KindFilterKey>(filterConfig);

  const filteredWorkspaceKinds = useMemo(
    () => applyFilters(allWorkspaceKinds, filterValues, filterableProperties),
    [allWorkspaceKinds, filterValues],
  );

  const onChange = useCallback(
    (event: React.FormEvent<HTMLInputElement>) => {
      const clickedKindName = event.currentTarget.name;
      const isSelectedKind = clickedKindName === selectedKind?.name;

      // Allow clicking on the selected item even when selection is disabled
      if (isSelectionDisabled && !isSelectedKind) {
        return;
      }
      const newSelectedWorkspaceKind = filteredWorkspaceKinds.find(
        (kind) => kind.name === clickedKindName,
      );
      onSelect(newSelectedWorkspaceKind);
    },
    [filteredWorkspaceKinds, isSelectionDisabled, onSelect, selectedKind?.name],
  );

  const handleCardClick = useCallback(
    (kind: WorkspacekindsWorkspaceKind) => {
      if (kind.name !== selectedKind?.name) {
        return;
      }
      onSelect(kind);
    },
    [selectedKind?.name, onSelect],
  );

  return (
    <>
      {isSelectionDisabled && (
        <PageSection>
          <Alert
            className="pf-v6-c-alert--no-title-margin"
            variant="info"
            isInline
            isPlain
            title="Workspace kind cannot be changed after creation."
            data-testid="workspace-kind-cannot-be-changed-alert"
          />
        </PageSection>
      )}
      <PageSection>
        <ToolbarFilter
          filterConfig={filterConfig}
          visibleFilterKeys={visibleFilterKeys}
          filterValues={filterValues}
          onFilterChange={setFilter}
          onClearAllFilters={clearAllFilters}
          testIdPrefix="kind-filter"
        />
      </PageSection>
      <PageSection isFilled>
        {filteredWorkspaceKinds.length === 0 && (
          <CustomEmptyState onClearFilters={clearAllFilters} />
        )}
        {filteredWorkspaceKinds.length > 0 && (
          <Gallery hasGutter aria-label="Selectable card container">
            {filteredWorkspaceKinds
              .filter((kind) => !kind.hidden)
              .map((kind) => (
                <Card
                  isCompact
                  isSelectable
                  key={kind.name}
                  id={kind.name.replace(/ /g, '-')}
                  isSelected={kind.name === selectedKind?.name}
                  style={
                    isSelectionDisabled && kind.name !== selectedKind?.name
                      ? { opacity: 0.5, cursor: 'not-allowed' }
                      : undefined
                  }
                  onClick={() => handleCardClick(kind)}
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
                        <img
                          src={validSrc}
                          alt={`${kind.name} logo`}
                          style={{ maxWidth: '60px' }}
                        />
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
