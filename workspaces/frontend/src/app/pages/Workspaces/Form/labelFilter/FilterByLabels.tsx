import React, { useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  FilterSidePanel,
  FilterSidePanelCategory,
  FilterSidePanelCategoryItem,
} from '@patternfly/react-catalog-view-extension';
import '@patternfly/react-catalog-view-extension/dist/css/react-catalog-view-extension.css';
import { formatLabelKey } from '~/shared/utilities/WorkspaceUtils';

type LabelledObject<T> = { labels: { key: string; value: string }[] } & T;

export type ExtraFilter<T> = {
  key: string;
  value: boolean;
  label: string;
  matchesFilter: (obj: LabelledObject<T>, value: boolean) => boolean;
};

export type FilterControlHandle = {
  clearAllFilters: () => void;
  setExtraFilter: (key: string, value: boolean) => void;
};

type FilterByLabelsProps<T> = {
  labelledObjects: LabelledObject<T>[];
  setLabelledObjects: (labelledObjects: LabelledObject<T>[]) => void;
  extraFilters?: ExtraFilter<T>[];
  filterControlRef?: React.Ref<FilterControlHandle>;
};

export const FilterByLabels = <T,>(props: FilterByLabelsProps<T>): React.ReactElement => {
  const [selectedLabels, setSelectedLabels] = useState<Map<string, Set<string>>>(new Map());
  const [selectedExtraFilters, setSelectedExtraFilters] = useState<Map<string, ExtraFilter<T>>>(
    () => {
      const extraFiltersMap = new Map();
      props.extraFilters?.map((extraFilter) => extraFiltersMap.set(extraFilter.key, extraFilter));
      return extraFiltersMap;
    },
  );

  const filterMap = useMemo(() => {
    const labelsMap = new Map<string, Set<string>>();
    props.labelledObjects
      .flatMap((labelledObject) => labelledObject.labels)
      .forEach((label) => {
        if (!labelsMap.has(label.key)) {
          labelsMap.set(label.key, new Set<string>());
        }
        labelsMap.get(label.key)?.add(label.value);
      });
    return labelsMap;
  }, [props.labelledObjects]);

  const isLabelChecked = useCallback(
    (label: string, labelValue: string) => selectedLabels.get(label)?.has(labelValue),
    [selectedLabels],
  );

  const updateLabelledObjects = useCallback(() => {
    props.setLabelledObjects(
      props.labelledObjects.filter(
        (labelledObject) =>
          [...selectedExtraFilters.values()].reduce(
            (accumulator, selectedExtraFilter) =>
              accumulator &&
              selectedExtraFilter.matchesFilter(labelledObject, selectedExtraFilter.value),
            true,
          ) &&
          [...selectedLabels.entries()].reduce(
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
  }, [selectedExtraFilters, selectedLabels, props]);

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

      setSelectedLabels(newSelectedLabels);
    },
    [selectedLabels],
  );

  const onChangeExtraFilters = useCallback(
    (extraFilter: ExtraFilter<T>, event: React.SyntheticEvent<HTMLElement>) => {
      const { checked } = event.currentTarget as HTMLInputElement;
      const newSelectedExtraFilters: Map<string, ExtraFilter<T>> = new Map(selectedExtraFilters);

      newSelectedExtraFilters.set(extraFilter.key, {
        key: extraFilter.key,
        value: checked,
        label: extraFilter.label,
        matchesFilter: extraFilter.matchesFilter,
      });

      setSelectedExtraFilters(newSelectedExtraFilters);
    },
    [selectedExtraFilters],
  );

  useEffect(() => {
    updateLabelledObjects();
  }, [selectedLabels, selectedExtraFilters, updateLabelledObjects]);

  useImperativeHandle(
    props.filterControlRef,
    () => ({
      clearAllFilters: () => {
        setSelectedLabels(new Map());
      },
      setExtraFilter: (key: string, value: boolean) => {
        const filter = props.extraFilters?.find((f) => f.key === key);
        if (filter) {
          setSelectedExtraFilters((prev) => {
            const newMap = new Map(prev);
            newMap.set(key, { ...filter, value });
            return newMap;
          });
        }
      },
    }),
    [props.extraFilters],
  );

  return (
    <FilterSidePanel id="filter-panel" data-testid="label-filter-panel">
      {selectedExtraFilters.size > 0 && (
        <FilterSidePanelCategory key="extraFilters" data-testid="extra-filters-category">
          {[...selectedExtraFilters.values()].map((extraFilter) => (
            <FilterSidePanelCategoryItem
              key={extraFilter.key}
              data-testid={`extra-filter-${extraFilter.key}`}
              checked={extraFilter.value}
              onClick={(e) => onChangeExtraFilters(extraFilter, e)}
            >
              {extraFilter.label}
            </FilterSidePanelCategoryItem>
          ))}
        </FilterSidePanelCategory>
      )}
      {[...filterMap.keys()].map((label) => (
        <FilterSidePanelCategory
          key={label}
          data-testid={`label-category-${label}`}
          title={formatLabelKey(label)}
        >
          {Array.from(filterMap.get(label)?.values() ?? []).map((labelValue) => (
            <FilterSidePanelCategoryItem
              key={`${label}|||${labelValue}`}
              data-testid={`label-filter-${label}-${labelValue}`}
              checked={isLabelChecked(label, labelValue)}
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
