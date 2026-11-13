import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import {
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core/dist/esm/components/FormSelect';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { WorkspaceKindImageConfigValue, ImagePullPolicy } from '~/app/types';
import { EditableRowsTable } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import {
  getRedirectMessageError,
  normalizeRedirect,
  validateImageUrl,
  validateOptionDescription,
  validateOptionDisplayName,
  validateOptionId,
} from '~/app/pages/WorkspaceKinds/Form/helpers';
import { WorkspaceKindFormRedirect } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindFormRedirect';
import { WorkspaceKindFormImagePort } from './WorkspaceKindFormImagePort';

interface WorkspaceKindFormImageModalProps {
  mode: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (image: WorkspaceKindImageConfigValue) => void;
  editIndex: number | null;
  image: WorkspaceKindImageConfigValue;
  setImage: (image: WorkspaceKindImageConfigValue) => void;
  imageOptions?: WorkspaceKindImageConfigValue[];
  existingIds?: string[];
}

export const WorkspaceKindFormImageModal: React.FC<WorkspaceKindFormImageModalProps> = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  editIndex,
  image,
  setImage,
  imageOptions,
  existingIds,
}) => {
  const [isIdTouched, setIsIdTouched] = useState(false);
  const [isDisplayNameTouched, setIsDisplayNameTouched] = useState(false);
  const [isDescriptionTouched, setIsDescriptionTouched] = useState(false);
  const [isImageUrlTouched, setIsImageUrlTouched] = useState(false);
  const imageIdRef = useRef(image.id);
  imageIdRef.current = image.id;
  const initialIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      initialIdRef.current = editIndex !== null ? imageIdRef.current : undefined;
      setIsIdTouched(editIndex !== null);
      setIsDisplayNameTouched(editIndex !== null);
      setIsDescriptionTouched(editIndex !== null);
      setIsImageUrlTouched(editIndex !== null);
    } else {
      initialIdRef.current = undefined;
      setIsIdTouched(false);
      setIsDisplayNameTouched(false);
      setIsDescriptionTouched(false);
      setIsImageUrlTouched(false);
    }
  }, [isOpen, editIndex]);

  const resolvedExistingIds = useMemo(
    () => existingIds ?? (imageOptions ?? []).map((opt) => opt.id),
    [existingIds, imageOptions],
  );

  const originalId =
    editIndex !== null && imageOptions?.[editIndex]
      ? imageOptions[editIndex]?.id
      : initialIdRef.current;

  const idError =
    isIdTouched || image.id.length > 0
      ? validateOptionId(image.id, resolvedExistingIds, originalId)
      : null;

  const displayNameError =
    isDisplayNameTouched || image.displayName.length > 0
      ? validateOptionDisplayName(image.displayName)
      : null;

  const descriptionError =
    isDescriptionTouched || image.description.length > 0
      ? validateOptionDescription(image.description)
      : null;

  const imageUrlError =
    isImageUrlTouched || (image.image?.length ?? 0) > 0 ? validateImageUrl(image.image) : null;

  const isFormValid =
    !idError &&
    !displayNameError &&
    !descriptionError &&
    !imageUrlError &&
    validateOptionId(image.id, resolvedExistingIds, originalId) === null &&
    validateOptionDisplayName(image.displayName) === null &&
    validateOptionDescription(image.description) === null &&
    validateImageUrl(image.image) === null;

  const candidateTargets = useMemo(
    () =>
      (imageOptions ?? [])
        .filter((opt) => opt.id && opt.id !== image.id && opt.id !== originalId)
        .map((opt) => ({ id: opt.id, displayName: opt.displayName })),
    [imageOptions, image.id, originalId],
  );

  const isMissingRedirectTarget =
    Boolean(image.redirect?.to) &&
    !candidateTargets.some((target) => target.id === image.redirect?.to);
  const hasRedirectError =
    Boolean(getRedirectMessageError(image.redirect)) || isMissingRedirectTarget;

  const handleSubmit = () => {
    if (!isFormValid || hasRedirectError) {
      return;
    }
    const finalRedirect = normalizeRedirect(image.redirect);

    const updatedImage: WorkspaceKindImageConfigValue = {
      ...image,
      redirect: finalRedirect,
    };
    setImage(updatedImage);
    onSubmit(updatedImage);
  };

  const options = [
    { value: 'please choose', label: 'Select one', disabled: true },
    { value: ImagePullPolicy.IfNotPresent, label: ImagePullPolicy.IfNotPresent, disabled: false },
    { value: ImagePullPolicy.Always, label: ImagePullPolicy.Always, disabled: false },
    { value: ImagePullPolicy.Never, label: ImagePullPolicy.Never, disabled: false },
  ];
  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="medium" data-testid="image-modal">
      <ModalHeader
        title={
          <span data-testid="image-modal-title">
            {editIndex === null ? 'Add Image' : 'Edit Image'}
          </span>
        }
        labelId="image-modal-title"
        description={editIndex === null ? 'Add an image configuration to your Workspace Kind' : ''}
      />
      <ModalBody>
        <Form>
          <ThemeAwareFormGroupWrapper
            label="ID"
            isRequired
            fieldId="workspace-kind-image-id"
            hasError={!!idError}
            helperTextNode={
              idError ? (
                <HelperText>
                  <HelperTextItem variant="error" data-testid="image-id-error">
                    {idError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              isRequired
              type="text"
              value={image.id}
              onChange={(_, value) => {
                setIsIdTouched(true);
                setImage({ ...image, id: value });
              }}
              onBlur={() => setIsIdTouched(true)}
              id="workspace-kind-image-id"
              data-testid="workspace-kind-image-id-input"
              validated={idError ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Display Name"
            isRequired
            fieldId="workspace-kind-image-name"
            hasError={!!displayNameError}
            helperTextNode={
              displayNameError ? (
                <HelperText>
                  <HelperTextItem variant="error" data-testid="image-name-error">
                    {displayNameError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              isRequired
              type="text"
              value={image.displayName}
              onChange={(_, value) => {
                setIsDisplayNameTouched(true);
                setImage({ ...image, displayName: value });
              }}
              onBlur={() => setIsDisplayNameTouched(true)}
              id="workspace-kind-image-name"
              data-testid="workspace-kind-image-name-input"
              validated={displayNameError ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Description"
            fieldId="workspace-kind-image-description"
            hasError={!!descriptionError}
            helperTextNode={
              descriptionError ? (
                <HelperText>
                  <HelperTextItem variant="error" data-testid="image-description-error">
                    {descriptionError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              type="text"
              value={image.description}
              onChange={(_, value) => {
                setIsDescriptionTouched(true);
                setImage({ ...image, description: value });
              }}
              onBlur={() => setIsDescriptionTouched(true)}
              id="workspace-kind-image-description"
              data-testid="workspace-kind-image-description-input"
              validated={descriptionError ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Image URL"
            isRequired
            fieldId="workspace-kind-image-url"
            hasError={!!imageUrlError}
            helperTextNode={
              imageUrlError ? (
                <HelperText>
                  <HelperTextItem variant="error" data-testid="image-url-error">
                    {imageUrlError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              isRequired
              type="url"
              value={image.image}
              onChange={(_, value) => {
                setIsImageUrlTouched(true);
                setImage({ ...image, image: value });
              }}
              onBlur={() => setIsImageUrlTouched(true)}
              id="workspace-kind-image-url"
              data-testid="workspace-kind-image-url-input"
              validated={imageUrlError ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <FormGroup
            isRequired
            fieldId="workspace-kind-image-hidden"
            style={{ marginTop: 'var(--mui-spacing-16px)' }}
          >
            <Switch
              isChecked={image.hidden}
              label={
                <div>
                  <div>Hidden</div>
                  <HelperText>Hide this image from users</HelperText>
                </div>
              }
              aria-label="-controlled-check"
              onChange={() => setImage({ ...image, hidden: !image.hidden })}
              id="workspace-kind-image-hidden"
              name="workspace-kind-image-hidden-switch"
            />
          </FormGroup>
          <EditableRowsTable
            rows={image.labels ?? []}
            setRows={(labels) => setImage({ ...image, labels })}
          />
          <ThemeAwareFormGroupWrapper
            label="Image Pull Policy"
            isRequired
            fieldId="workspace-kind-image-pull-policy"
          >
            <FormSelect
              value={image.imagePullPolicy}
              onChange={(_, value) =>
                setImage({ ...image, imagePullPolicy: value as ImagePullPolicy })
              }
              aria-label="FormSelect Input"
              id="workspace-kind-image-pull-policy"
              ouiaId="BasicFormSelect"
            >
              {options.map((option, index) => (
                <FormSelectOption
                  isDisabled={option.disabled}
                  key={index}
                  value={option.value}
                  label={option.label}
                />
              ))}
            </FormSelect>
          </ThemeAwareFormGroupWrapper>
          <WorkspaceKindFormImagePort
            ports={image.ports || []}
            setPorts={(ports) => setImage({ ...image, ports })}
          />
          {mode === 'edit' && (
            <WorkspaceKindFormRedirect
              redirect={image.redirect || { to: '' }}
              setRedirect={(redirect) => setImage({ ...image, redirect })}
              candidateTargets={candidateTargets}
              fieldIdPrefix="workspace-kind-image-redirect"
              targetLabel="Redirect To"
              entityType="image"
            />
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="confirm"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={hasRedirectError || !isFormValid}
          data-testid="image-modal-submit-button"
        >
          {editIndex !== null ? 'Save' : 'Add'}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={onClose}
          data-testid="image-modal-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
