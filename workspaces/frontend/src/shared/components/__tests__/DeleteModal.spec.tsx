import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import DeleteModal from '~/shared/components/DeleteModal';

describe('DeleteModal', () => {
  const mockOnClose = vi.fn();
  const mockOnDelete = vi.fn();

  const defaultProps = {
    isOpen: true,
    resourceName: 'test-resource',
    namespace: 'default',
    title: 'Delete Resource',
    onClose: mockOnClose,
    onDelete: mockOnDelete,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the modal when isOpen is true', () => {
      render(<DeleteModal {...defaultProps} />);
      expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
    });

    it('should display the correct title', () => {
      render(<DeleteModal {...defaultProps} />);
      expect(screen.getByText('Delete Resource')).toBeInTheDocument();
    });

    it('should display resource name and namespace', () => {
      render(<DeleteModal {...defaultProps} />);
      expect(screen.getByText(/test-resource/)).toBeInTheDocument();
      expect(screen.getByText(/default/)).toBeInTheDocument();
    });

    it('should have delete button disabled initially', () => {
      render(<DeleteModal {...defaultProps} />);
      const deleteButton = screen.getByTestId('delete-button');
      expect(deleteButton).toBeDisabled();
    });
  });

  describe('Input Validation', () => {
    it('should enable delete button when resource name matches', async () => {
      const user = userEvent.setup();
      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      const deleteButton = screen.getByTestId('delete-button');
      expect(deleteButton).not.toBeDisabled();
    });

    it('should show error when input does not match resource name', async () => {
      const user = userEvent.setup();
      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'wrong-name');

      expect(screen.getByTestId('delete-modal-helper-text')).toBeInTheDocument();
      expect(screen.getByText(/The name does not match/)).toBeInTheDocument();
    });

    it('should clear helper text when input matches', async () => {
      const user = userEvent.setup();
      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'wrong-name');
      expect(screen.getByTestId('delete-modal-helper-text')).toBeInTheDocument();

      await user.clear(input);
      await user.type(input, 'test-resource');
      expect(screen.queryByTestId('delete-modal-helper-text')).not.toBeInTheDocument();
    });
  });

  describe('Successful Deletion', () => {
    it('should call onDelete when delete button is clicked with correct name', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);

      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      const deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith('test-resource');
    });

    it('should call onClose after successful deletion', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockResolvedValue(undefined);

      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      const deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });

    it('should disable cancel button during deletion', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockImplementation(
        () =>
            new Promise<void>((resolve) => {
            resolve();
            }),
        );

      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      const deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      const cancelButton = screen.getByTestId('cancel-button');
      expect(cancelButton).not.toBeInTheDocument(); // Cancel button is hidden during deletion
    });
  });

  describe('Error Handling', () => {
    it('should display error message on deletion failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to delete resource';
      mockOnDelete.mockRejectedValue(new Error(errorMessage));

      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      const deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('delete-modal-error')).toBeInTheDocument();
        expect(screen.getByText(/Failed to delete workspace/)).toBeInTheDocument();
      });
    });

    it('should not call onClose on deletion error', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockRejectedValue(new Error('Deletion failed'));

      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      const deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });

    it('should reset isDeletingRef in finally block after error', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockRejectedValue(new Error('Deletion failed'));

      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      let deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      // Wait for error to be displayed
      await waitFor(() => {
        expect(screen.getByTestId('delete-modal-error')).toBeInTheDocument();
      });

      // Delete button should be enabled again (isDeletingRef reset in finally)
      deleteButton = screen.getByTestId('delete-button');
      expect(deleteButton).not.toBeDisabled();
    });

    it('should allow retry after failed deletion', async () => {
      const user = userEvent.setup();
      mockOnDelete
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce(undefined);

      render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      // First attempt - fails
      let deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('delete-modal-error')).toBeInTheDocument();
      });

      // Second attempt - succeeds
      deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled();
      });
    });
  });

  describe('Modal Lifecycle', () => {
    it('should clear input when modal closes', () => {
      const { rerender } = render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'test-resource' } });
      expect(input.value).toBe('test-resource');

      // Pass isOpen={false} as a separate prop object, or override it
      rerender(<DeleteModal {...defaultProps} isOpen={false} />);

      // For true, just omit the value - it's the default
      rerender(<DeleteModal {...defaultProps} />);

      const newInput = screen.getByTestId('delete-modal-input') as HTMLInputElement;
      expect(newInput.value).toBe('');
    });

    it('should clear error when modal closes', async () => {
      const user = userEvent.setup();
      mockOnDelete.mockRejectedValue(new Error('Deletion failed'));

      const { rerender } = render(<DeleteModal {...defaultProps} />);

      const input = screen.getByTestId('delete-modal-input');
      await user.type(input, 'test-resource');

      const deleteButton = screen.getByTestId('delete-button');
      await user.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByTestId('delete-modal-error')).toBeInTheDocument();
      });

      // Close modal - explicitly set to false
      rerender(<DeleteModal {...defaultProps} isOpen={false} />);

      // Reopen modal - omit the prop (defaults to true from defaultProps)
      rerender(<DeleteModal {...defaultProps} />);

      // Error should be cleared
      expect(screen.queryByTestId('delete-modal-error')).not.toBeInTheDocument();
    });
  });

  describe('Cancel Button', () => {
    it('should call onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<DeleteModal {...defaultProps} />);

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
