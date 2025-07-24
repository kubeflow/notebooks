import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import {
  Modal,
  ModalHeader,
  ModalFooter,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import {
  EmptyStateFooter,
  EmptyStateActions,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import { WorkspaceKindImageConfigData, WorkspaceKindImageConfigValue } from '~/app/types';
import { emptyImage } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { WorkspaceKindFormPaginatedTable } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindFormPaginatedTable';
import { WorkspaceKindFormImageModal } from './WorkspaceKindFormImageModal';

interface WorkspaceKindFormImageProps {
  mode: string;
  imageConfig: WorkspaceKindImageConfigData;
  updateImageConfig: (images: WorkspaceKindImageConfigData) => void;
}

export const WorkspaceKindFormImage: React.FC<WorkspaceKindFormImageProps> = ({
  mode,
  imageConfig,
  updateImageConfig,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [defaultId, setDefaultId] = useState(imageConfig.default || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [image, setImage] = useState<WorkspaceKindImageConfigValue>({ ...emptyImage });

  const clearForm = useCallback(() => {
    setImage({ ...emptyImage });
    setEditIndex(null);
    setIsModalOpen(false);
  }, []);

  const openDeleteModal = useCallback((i: number) => {
    setIsDeleteModalOpen(true);
    setDeleteIndex(i);
  }, []);

  const handleAddOrEditSubmit = useCallback(() => {
    if (editIndex !== null) {
      const updated = [...imageConfig.values];
      updated[editIndex] = image;
      updateImageConfig({ ...imageConfig, values: updated });
    } else {
      const images = [...imageConfig.values, image];
      if (images.length === 1) {
        updateImageConfig({ default: image.id, values: [...imageConfig.values, image] });
        setDefaultId(image.id);
      } else {
        updateImageConfig({ ...imageConfig, values: [...imageConfig.values, image] });
      }
    }
    clearForm();
  }, [clearForm, editIndex, image, imageConfig, updateImageConfig]);

  const handleEdit = useCallback(
    (index: number) => {
      setImage(imageConfig.values[index]);
      setEditIndex(index);
      setIsModalOpen(true);
    },
    [imageConfig.values],
  );

  const handleDelete = useCallback(() => {
    if (deleteIndex === null) {
      return;
    }
    updateImageConfig({
      default: imageConfig.values[deleteIndex].id === defaultId ? '' : defaultId,
      values: imageConfig.values.filter((_, i) => i !== deleteIndex),
    });
    if (imageConfig.values[deleteIndex].id === defaultId) {
      setDefaultId('');
    }
    setDeleteIndex(null);
    setIsDeleteModalOpen(false);
  }, [deleteIndex, imageConfig, updateImageConfig, setDefaultId, defaultId]);
  const addImageBtn = (
    <Button
      variant="link"
      icon={<PlusCircleIcon />}
      onClick={() => {
        setIsModalOpen(true);
      }}
    >
      Add Image
    </Button>
  );

  return (
    <Content>
      <div className="pf-u-mb-0">
        <ExpandableSection
          toggleText="Workspace Images"
          onToggle={() => setIsExpanded((prev) => !prev)}
          isExpanded={isExpanded}
          isIndented
        >
          {imageConfig.values.length === 0 && (
            <EmptyState titleText="Start by creating an image" headingLevel="h4" icon={CubesIcon}>
              <EmptyStateBody>Add an image configuration to your Workspace Kind</EmptyStateBody>
              <EmptyStateFooter>
                <EmptyStateActions>{addImageBtn}</EmptyStateActions>
              </EmptyStateFooter>
            </EmptyState>
          )}
          {imageConfig.values.length > 0 && (
            <div>
              <WorkspaceKindFormPaginatedTable
                ariaLabel="Images table"
                rows={imageConfig.values}
                defaultId={defaultId}
                setDefaultId={(id) => {
                  updateImageConfig({ ...imageConfig, default: id });
                  setDefaultId(id);
                }}
                handleEdit={handleEdit}
                openDeleteModal={openDeleteModal}
              />
              {addImageBtn}
            </div>
          )}
          <WorkspaceKindFormImageModal
            isOpen={isModalOpen}
            onClose={clearForm}
            onSubmit={handleAddOrEditSubmit}
            editIndex={editIndex}
            image={image}
            setImage={setImage}
            mode={mode}
          />
          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            variant={ModalVariant.small}
          >
            <ModalHeader
              title="Remove Image?"
              description="This image will be removed from the workspace kind."
            />
            <ModalFooter>
              <Button key="remove" variant="danger" onClick={handleDelete}>
                Remove
              </Button>
              <Button key="cancel" variant="link" onClick={() => setIsDeleteModalOpen(false)}>
                Cancel
              </Button>
            </ModalFooter>
          </Modal>
        </ExpandableSection>
      </div>
    </Content>
  );
};
