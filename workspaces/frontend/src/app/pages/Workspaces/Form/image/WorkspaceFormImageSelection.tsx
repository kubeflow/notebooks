import React, { useEffect, useRef, useMemo, useState, useImperativeHandle } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { WorkspaceFormImageList } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageList';
import {
  ExtraFilter,
  FilterByLabels,
  FilterControlHandle,
} from '~/app/pages/Workspaces/Form/labelFilter/FilterByLabels';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { computeDefaultFilterValues } from '~/app/pages/Workspaces/Form/utils/filterDefaults';

export type ImageSelectionFilterHandle = {
  adaptFiltersForImage: (image: WorkspacekindsImageConfigValue) => void;
};

interface WorkspaceFormImageSelectionProps {
  images: WorkspacekindsImageConfigValue[];
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  onSelect: (image: WorkspacekindsImageConfigValue | undefined) => void;
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
  const [filteredImages, setFilteredImages] = useState<WorkspacekindsImageConfigValue[]>(images);
  const internalFilterControlRef = useRef<FilterControlHandle>(null);
  const lastEnsuredVisibleImageId = useRef<string | null>(null);

  const defaultFilterValues = useMemo(() => {
    const defaults = computeDefaultFilterValues(images, defaultImageId);
    // Also enable filters if selectedImage needs them
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

  const extraFilters: ExtraFilter<WorkspacekindsImageConfigValue>[] = useMemo(
    () => [
      {
        label: 'Show hidden',
        value: defaultFilterValues.showHidden,
        key: 'showHidden',
        matchesFilter: (image: WorkspacekindsImageConfigValue, value: boolean) =>
          value || !image.hidden,
      },
      {
        label: 'Show redirected',
        value: defaultFilterValues.showRedirected,
        key: 'showRedirected',
        matchesFilter: (image: WorkspacekindsImageConfigValue, value: boolean) =>
          value || image.redirect === undefined,
      },
    ],
    [defaultFilterValues],
  );

  useEffect(() => {
    if (!selectedImage) {
      return;
    }

    // Skip deselection if we just ensured this image is visible
    if (lastEnsuredVisibleImageId.current === selectedImage.id) {
      lastEnsuredVisibleImageId.current = null;
      return;
    }

    const isSelectedInFilteredList = filteredImages.some((image) => image.id === selectedImage.id);

    if (!isSelectedInFilteredList) {
      onSelect(undefined);
    }
  }, [filteredImages, selectedImage, onSelect]);

  useImperativeHandle(
    filterControlRef,
    () => ({
      adaptFiltersForImage: (image: WorkspacekindsImageConfigValue) => {
        lastEnsuredVisibleImageId.current = image.id;
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
        setLabelledObjects={(obj) => setFilteredImages(obj as WorkspacekindsImageConfigValue[])}
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
