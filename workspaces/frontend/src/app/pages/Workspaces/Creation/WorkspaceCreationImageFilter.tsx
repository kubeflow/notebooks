import React, { useCallback, useMemo } from 'react';
import {
  FilterSidePanel,
  FilterSidePanelCategory,
  FilterSidePanelCategoryItem,
} from '@patternfly/react-catalog-view-extension';
import { WorkspaceImage } from '~/shared/types';
import '@patternfly/react-catalog-view-extension/dist/css/react-catalog-view-extension.css';

type WorkspaceCreationImageFilterProps = {
  images: WorkspaceImage[];
  selectedLabels: Map<string, Set<string>>;
  onSelect: (labels: Map<string, Set<string>>) => void;
};

export const WorkspaceCreationImageFilter: React.FunctionComponent<
  WorkspaceCreationImageFilterProps
> = ({ images, selectedLabels, onSelect }) => {
  const filterMap = useMemo(() => {
    const labelsMap = new Map<string, Set<string>>();
    images.forEach((image) => {
      Object.keys(image.labels).forEach((labelKey) => {
        const labelValue = image.labels[labelKey];
        if (!labelsMap.has(labelKey)) {
          labelsMap.set(labelKey, new Set<string>());
        }
        labelsMap.get(labelKey).add(labelValue);
      });
    });
    return labelsMap;
  }, [images]);

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
        const labelValues = newSelectedLabels.get(labelKey);
        labelValues.delete(labelValue);
        if (labelValues.size === 0) {
          newSelectedLabels.delete(labelKey);
        }
      }

      onSelect(newSelectedLabels);
      console.error(newSelectedLabels);
    },
    [selectedLabels, onSelect],
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
