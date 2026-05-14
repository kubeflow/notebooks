import React, { useRef, useMemo, useState, useImperativeHandle } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormImageList } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageList';
import {
  ExtraFilter,
  FilterByLabels,
  FilterControlHandle,
} from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { OptionsImageConfigValue } from '~/generated/data-contracts';
import { computeDefaultFilterValues } from '~/app/pages/Workspaces/Form/utils/filterDefaults';

export type ImageSelectionFilterHandle = {
  adaptFiltersForImage: (image: OptionsImageConfigValue) => void;
};

interface WorkspaceFormImageSelectionProps {
  images: OptionsImageConfigValue[];
  selectedImage: OptionsImageConfigValue | undefined;
  onSelect: (image: OptionsImageConfigValue | undefined) => void;
  defaultImageId?: string;
  filterControlRef?: React.Ref<ImageSelectionFilterHandle>;
}

const WorkspaceFormImageSelection: React.FunctionComponent<WorkspaceFormImageSelectionProps> = ({
  images,
  selectedImage,
  onSelect,
  defaultImageId,
  filterControlRef,
}) => {
  const [filteredImages, setFilteredImages] = useState<OptionsImageConfigValue[]>(images);
  const internalFilterControlRef = useRef<FilterControlHandle>(null);

  const defaultFilterValues = useMemo(() => {
    const defaults = computeDefaultFilterValues(images, defaultImageId);
    if (selectedImage) {
      if (selectedImage.hidden) {
        defaults.showHidden = true;
      }
      if (selectedImage.redirect !== undefined) {
        defaults.showRedirected = true;
      }
    }
    return defaults;
  }, [images, defaultImageId, selectedImage]);

  const extraFilters: ExtraFilter<OptionsImageConfigValue>[] = useMemo(
    () => [
      {
        label: 'Show hidden',
        value: defaultFilterValues.showHidden,
        key: 'showHidden',
        matchesFilter: (image: OptionsImageConfigValue, value: boolean) => value || !image.hidden,
      },
      {
        label: 'Show redirected',
        value: defaultFilterValues.showRedirected,
        key: 'showRedirected',
        matchesFilter: (image: OptionsImageConfigValue, value: boolean) =>
          value || image.redirect === undefined,
      },
    ],
    [defaultFilterValues],
  );

  useImperativeHandle(
    filterControlRef,
    () => ({
      adaptFiltersForImage: (image: OptionsImageConfigValue) => {
        internalFilterControlRef.current?.clearAllFilters();
        if (image.hidden) {
          internalFilterControlRef.current?.setExtraFilter('showHidden', true);
        }
        if (image.redirect !== undefined) {
          internalFilterControlRef.current?.setExtraFilter('showRedirected', true);
        }
      },
    }),
    [],
  );

  const imageFilterContent = useMemo(
    () => (
      <FilterByLabels
        labelledObjects={images}
        setLabelledObjects={(obj) => setFilteredImages(obj as OptionsImageConfigValue[])}
        extraFilters={extraFilters}
        filterControlRef={internalFilterControlRef}
      />
    ),
    [images, setFilteredImages, extraFilters],
  );

  return (
    <Content className="workspace-form__full-height">
      <Split hasGutter>
        <SplitItem className="workspace-form__filter-sidebar" data-testid="filter-sidebar">
          {imageFilterContent}
        </SplitItem>
        <SplitItem isFilled>
          <WorkspaceFormImageList
            filteredImages={filteredImages}
            allImages={images}
            selectedImage={selectedImage}
            onSelect={onSelect}
            defaultImageId={defaultImageId}
          />
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormImageSelection };
