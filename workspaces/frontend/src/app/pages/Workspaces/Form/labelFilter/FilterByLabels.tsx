import React, { useCallback, useMemo, useState } from 'react';
import {
  FilterSidePanel,
  FilterSidePanelCategory,
  FilterSidePanelCategoryItem,
} from '@patternfly/react-catalog-view-extension';
import '@patternfly/react-catalog-view-extension/dist/css/react-catalog-view-extension.css';
import { formatLabelKey } from '~/shared/utilities/WorkspaceUtils';

type FilterByLabelsProps = {
  labelledObjects: { labels: { key: string; value: string }[] }[];
  setLabelledObjects: (labelledObjects: { labels: { key: string; value: string }[] }[]) => void;
};

export const FilterByLabels: React.FunctionComponent<FilterByLabelsProps> = ({
  labelledObjects,
  setLabelledObjects,
}) => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());

  const filterMap = useMemo(() => {
    const labelsMap = new Map<string, Set<string>>();
    labelledObjects
      .flatMap((labelledObject) => labelledObject.labels)
      .forEach((label) => {
        if (!labelsMap.has(label.key)) {
          labelsMap.set(label.key, new Set<string>());
        }
        labelsMap.get(label.key)?.add(label.value);
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

      setLabelledObjects(
        labelledObjects.filter((labelledObject) =>
          [...newSelectedLabels.entries()].reduce(
            (accumulator, [selectedLabelKey, selectedLabelValues]) => {
              if (selectedLabelValues.size > 0) {
                return (
                  accumulator &&
                  labelledObject.labels.some(
                    (imageLabel) =>
                      imageLabel.key === selectedLabelKey &&
                      selectedLabelValues.has(imageLabel.value),
                  )
                );
              }
              return accumulator;
            },
            true,
          ),
        ),
      );

      setSelectedLabels(newSelectedLabels);
    },
    [selectedLabels, labelledObjects, setLabelledObjects],
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
