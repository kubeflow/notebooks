import React, { useCallback, useMemo, useState } from 'react';
import {
  FilterSidePanel,
  FilterSidePanelCategory,
  FilterSidePanelCategoryItem,
} from '@patternfly/react-catalog-view-extension';
import { WorkspaceKind } from '~/shared/types';
import '@patternfly/react-catalog-view-extension/dist/css/react-catalog-view-extension.css';

type WorkspaceCreationKindFilterProps = {
  allWorkspaceKinds: WorkspaceKind[];
};

export const WorkspaceCreationKindFilter: React.FunctionComponent<
  WorkspaceCreationKindFilterProps
> = ({ allWorkspaceKinds }) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());

  const filterMap = useMemo(() => {
    const labelsMap = new Map<string, Set<string>>();
    allWorkspaceKinds.forEach((kind) => {
      Object.keys(kind.podTemplate.podMetadata.labels).forEach((labelKey) => {
        const labelValue = kind.podTemplate.podMetadata.labels[labelKey];
        if (!labelsMap.has(labelKey)) {
          labelsMap.set(labelKey, new Set<string>());
        }
        labelsMap.get(labelKey).add(labelValue);
      });
    });
    return labelsMap;
  }, [allWorkspaceKinds]);

  const isChecked = useCallback(
    (label, labelValue) => selectedLabels.get(label)?.has(labelValue),
    [selectedLabels],
  );

  const onChange = useCallback(
    (labelKey, labelValue, event) => {
      const { checked } = event.currentTarget;
      const newSelectedLabels: Map<string, Set<string>> = new Map(selectedLabels);

      if (checked) {
        if (!newSelectedLabels.has(labelKey)) {
          newSelectedLabels.set(labelKey, new Set<string>());
        }
        newSelectedLabels.get(labelKey).add(labelValue);
      } else {
        newSelectedLabels.get(labelKey).delete(labelValue);
      }

      setSelectedLabels(newSelectedLabels);
      console.error(newSelectedLabels);
    },
    [selectedLabels],
  );

  return (
    <FilterSidePanel id="filter-panel">
      {[...filterMap.keys()].map((label) => (
        <FilterSidePanelCategory key={label} title={label}>
          {Array.from(filterMap.get(label).values()).map((labelValue) => (
            <FilterSidePanelCategoryItem
              key={`${label}|||${labelValue}`}
              checked={isChecked(label, labelValue)}
              onClick={(e) => onChange(label, labelValue, e)}
            >
              {labelValue}
            </FilterSidePanelCategoryItem>
          ))}
        </FilterSidePanelCategory>
      ))}
    </FilterSidePanel>
  );
};
