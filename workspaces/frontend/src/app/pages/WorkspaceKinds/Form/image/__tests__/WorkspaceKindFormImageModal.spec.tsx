import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceKindFormImageModal } from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImageModal';
import { WorkspaceKindImageConfigValue, ImagePullPolicy } from '~/app/types';
import { OptionsRedirectMessageLevel } from '~/generated/data-contracts';

describe('WorkspaceKindFormImageModal', () => {
  const existingImages: WorkspaceKindImageConfigValue[] = [
    {
      id: 'image-1',
      displayName: 'First Image',
      description: 'First description',
      hidden: false,
      restrictions: { deny: false },
      imagePullPolicy: ImagePullPolicy.IfNotPresent,
      ports: [{ id: 'http', displayName: 'HTTP', port: 8888, protocol: 'HTTP' }],
    },
    {
      id: 'image-2',
      displayName: 'Second Image',
      description: 'Second description',
      hidden: false,
      restrictions: { deny: false },
      imagePullPolicy: ImagePullPolicy.IfNotPresent,
      ports: [{ id: 'http', displayName: 'HTTP', port: 8888, protocol: 'HTTP' }],
    },
    {
      id: 'image-3',
      displayName: 'Third Image',
      description: 'Third description',
      hidden: false,
      restrictions: { deny: false },
      imagePullPolicy: ImagePullPolicy.IfNotPresent,
      ports: [{ id: 'http', displayName: 'HTTP', port: 8888, protocol: 'HTTP' }],
    },
  ];

  it('excludes the current image itself from eligible redirect targets in edit mode', () => {
    const currentImage: WorkspaceKindImageConfigValue = {
      ...existingImages[0],
      redirect: { to: 'image-2' },
    };

    render(
      <WorkspaceKindFormImageModal
        mode="edit"
        isOpen
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        editIndex={0}
        image={currentImage}
        setImage={jest.fn()}
        existingImages={existingImages}
      />,
    );

    // Should include image-2 and image-3
    expect(screen.getByRole('option', { name: 'Second Image (image-2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Third Image (image-3)' })).toBeInTheDocument();
    // Should NOT include image-1 itself
    expect(screen.queryByRole('option', { name: 'First Image (image-1)' })).not.toBeInTheDocument();
  });

  it('selects existing valid redirect target correctly', () => {
    const currentImage: WorkspaceKindImageConfigValue = {
      ...existingImages[0],
      redirect: {
        to: 'image-2',
        message: {
          level: OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
          text: 'Redirecting to Second Image',
        },
      },
    };

    render(
      <WorkspaceKindFormImageModal
        mode="edit"
        isOpen
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        editIndex={0}
        image={currentImage}
        setImage={jest.fn()}
        existingImages={existingImages}
      />,
    );

    const select = screen.getByTestId('redirect-to-select') as HTMLSelectElement;
    expect(select.value).toBe('image-2');
  });

  it('disables the Save button when redirect points to a missing target', () => {
    const currentImage: WorkspaceKindImageConfigValue = {
      ...existingImages[0],
      redirect: {
        to: 'non-existent-target',
        message: {
          level: OptionsRedirectMessageLevel.RedirectMessageLevelWarning,
          text: 'Dead link',
        },
      },
    };

    render(
      <WorkspaceKindFormImageModal
        mode="edit"
        isOpen
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        editIndex={0}
        image={currentImage}
        setImage={jest.fn()}
        existingImages={existingImages}
      />,
    );

    const saveButton = screen.getByTestId('image-modal-submit-button');
    expect(saveButton).toBeDisabled();
    expect(screen.getByTestId('redirect-missing-target-error')).toBeInTheDocument();
  });

  it('enables the Save button when redirect target is valid', () => {
    const currentImage: WorkspaceKindImageConfigValue = {
      ...existingImages[0],
      redirect: {
        to: 'image-2',
      },
    };

    render(
      <WorkspaceKindFormImageModal
        mode="edit"
        isOpen
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        editIndex={0}
        image={currentImage}
        setImage={jest.fn()}
        existingImages={existingImages}
      />,
    );

    const saveButton = screen.getByTestId('image-modal-submit-button');
    expect(saveButton).toBeEnabled();
    expect(screen.queryByTestId('redirect-missing-target-error')).not.toBeInTheDocument();
  });

  it('updates choices when existingImages list changes', () => {
    const currentImage: WorkspaceKindImageConfigValue = {
      ...existingImages[0],
      redirect: { to: 'image-2' },
    };

    const { rerender } = render(
      <WorkspaceKindFormImageModal
        mode="edit"
        isOpen
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        editIndex={0}
        image={currentImage}
        setImage={jest.fn()}
        existingImages={existingImages}
      />,
    );

    expect(screen.getByRole('option', { name: 'Third Image (image-3)' })).toBeInTheDocument();

    // Remove image-3 and add image-renamed
    const updatedImages: WorkspaceKindImageConfigValue[] = [
      existingImages[0],
      existingImages[1],
      {
        id: 'image-renamed',
        displayName: 'Renamed Image',
        description: 'New',
        hidden: false,
        restrictions: { deny: false },
      },
    ];

    rerender(
      <WorkspaceKindFormImageModal
        mode="edit"
        isOpen
        onClose={jest.fn()}
        onSubmit={jest.fn()}
        editIndex={0}
        image={currentImage}
        setImage={jest.fn()}
        existingImages={updatedImages}
      />,
    );

    expect(screen.queryByRole('option', { name: 'Third Image (image-3)' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Renamed Image (image-renamed)' }),
    ).toBeInTheDocument();
  });
});
