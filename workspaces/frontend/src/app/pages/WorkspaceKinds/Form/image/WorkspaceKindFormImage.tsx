import React, { useCallback, useState } from 'react';
import {
  Button,
  Divider,
  Content,
  Dropdown,
  MenuToggle,
  DropdownItem,
  Modal,
  ModalHeader,
  ModalFooter,
  ModalVariant,
  EmptyState,
  EmptyStateFooter,
  EmptyStateActions,
} from '@patternfly/react-core';
import { Table, Thead, Tbody, Tr, Th, Td } from '@patternfly/react-table';
import { PlusCircleIcon, EllipsisVIcon, CubesIcon } from '@patternfly/react-icons';
import { WorkspaceKindImageConfigValue, WorkspaceKindImageFormInput } from '~/app/types';
import { emptyImage } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { WorkspaceKindFormImageModal } from './WorkspaceKindFormImageModal';

interface WorkspaceKindFormImageProps {
  imageConfig: WorkspaceKindImageFormInput;
  updateImageConfig: (images: WorkspaceKindImageFormInput) => void;
}

export const WorkspaceKindFormImage: React.FC<WorkspaceKindFormImageProps> = ({
  imageConfig,
  updateImageConfig,
}) => {
  const [defaultId, setDefaultId] = useState(imageConfig.default || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
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
      updateImageConfig({ ...imageConfig, values: [...imageConfig.values, image] });
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
    <Content style={{ height: '100%' }}>
      <p>Configure images for your workspace kind and select an image as default.</p>
      <Divider />
      {imageConfig.values.length === 0 && (
        <EmptyState titleText="Add An Image To Workspace Kind" headingLevel="h4" icon={CubesIcon}>
          <EmptyStateFooter>
            <EmptyStateActions>{addImageBtn}</EmptyStateActions>
          </EmptyStateFooter>
        </EmptyState>
      )}
      {imageConfig.values.length > 0 && (
        <Table aria-label="Images table">
          <Thead>
            <Tr>
              <Th screenReaderText="Row select">Default</Th>
              <Th>ID</Th>
              <Th>Display Name</Th>
              <Th>Hidden</Th>
              <Th>Pull Policy</Th>
              <Th aria-label="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {imageConfig.values.map((img, index) => (
              <Tr key={img.id}>
                <Td>
                  <input
                    type="radio"
                    name="default-image"
                    checked={defaultId === img.id}
                    onChange={() => {
                      setDefaultId(img.id);
                      updateImageConfig({ ...imageConfig, default: img.id });
                    }}
                    aria-label={`Select ${img.id} as default`}
                  />
                </Td>
                <Td>{img.id}</Td>
                <Td>{img.displayName}</Td>
                <Td>{img.hidden ? 'Yes' : 'No'}</Td>
                <Td>{img.imagePullPolicy}</Td>
                <Td isActionCell>
                  <Dropdown
                    toggle={(toggleRef) => (
                      <MenuToggle
                        ref={toggleRef}
                        isExpanded={dropdownOpen === index}
                        onClick={() => setDropdownOpen(dropdownOpen === index ? null : index)}
                        variant="plain"
                        aria-label="plain kebab"
                      >
                        <EllipsisVIcon />
                      </MenuToggle>
                    )}
                    isOpen={dropdownOpen === index}
                    onSelect={() => setDropdownOpen(null)}
                    popperProps={{ position: 'right' }}
                  >
                    <DropdownItem onClick={() => handleEdit(index)}>Edit</DropdownItem>
                    <DropdownItem onClick={() => openDeleteModal(index)}>Remove</DropdownItem>
                  </Dropdown>
                </Td>
              </Tr>
            ))}
          </Tbody>
          {addImageBtn}
        </Table>
      )}
      <WorkspaceKindFormImageModal
        isOpen={isModalOpen}
        onClose={clearForm}
        onSubmit={handleAddOrEditSubmit}
        editIndex={editIndex}
        image={image}
        setImage={setImage}
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
    </Content>
  );
};
