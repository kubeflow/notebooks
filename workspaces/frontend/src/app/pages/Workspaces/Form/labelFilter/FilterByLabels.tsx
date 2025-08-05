import React, { useCallback, useMemo } from 'react';
import {
  FilterSidePanel,
  FilterSidePanelCategory,
  FilterSidePanelCategoryItem,
} from '@patternfly/react-catalog-view-extension';
import '@patternfly/react-catalog-view-extension/dist/css/react-catalog-view-extension.css';
import { formatLabelKey } from '~/shared/utilities/WorkspaceUtils';
import { WorkspacesOptionLabel } from '~/generated/data-contracts';

type FilterByLabelsProps = {
  labelledObjects: WorkspacesOptionLabel[];
  selectedLabels: Map<string, Set<string>>;
  onSelect: (labels: Map<string, Set<string>>) => void;
};

export const FilterByLabels: React.FunctionComponent<FilterByLabelsProps> = ({
  labelledObjects,
  selectedLabels,
  onSelect,
}) => {
  const filterMap = useMemo(() => {
    const labelsMap = new Map<string, Set<string>>();
    labelledObjects.forEach((labelledObject) => {
      if (!labelsMap.has(labelledObject.key)) {
        labelsMap.set(labelledObject.key, new Set<string>());
      }
      labelsMap.get(labelledObject.key)?.add(labelledObject.value);
    });
    return labelsMap;
  }, [labelledObjects]);

  const isChecked = useCallback(
    (label: string, labelValue: string) => selectedLabels.get(label)?.has(labelValue),
    [selectedLabels],
  );

  const onChange = useCallback(
    (labelKey: string, labelValue: string, event: React.SyntheticEvent<HTMLElement>) => {
      const { checked } = event.currentTarget as HTMLInputElement;
      const newSelectedLabels: Map<string, Set<string>> = new Map(selectedLabels);

      if (checked) {
        if (!newSelectedLabels.has(labelKey)) {
          newSelectedLabels.set(labelKey, new Set<string>());
        }
        newSelectedLabels.get(labelKey)?.add(labelValue);
      } else {
        const labelValues = newSelectedLabels.get(labelKey);
        labelValues?.delete(labelValue);
        if (labelValues?.size === 0) {
          newSelectedLabels.delete(labelKey);
        }
      }

      onSelect(newSelectedLabels);
    },
    [selectedLabels, onSelect],
  );

  return (
    <FilterSidePanel id="filter-panel">
      {[...filterMap.keys()].map((label) => (
        <FilterSidePanelCategory key={label} title={formatLabelKey(label)}>
          {Array.from(filterMap.get(label)?.values() ?? []).map((labelValue) => (
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
