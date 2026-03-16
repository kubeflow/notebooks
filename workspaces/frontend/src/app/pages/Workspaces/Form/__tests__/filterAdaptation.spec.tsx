import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  WorkspaceFormImageSelection,
  ImageSelectionFilterHandle,
} from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageSelection';
import {
  WorkspaceFormPodConfigSelection,
  PodConfigSelectionFilterHandle,
} from '~/app/pages/Workspaces/Form/podConfig/WorkspaceFormPodConfigSelection';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import type {
  WorkspacekindsImageConfigValue,
  WorkspacekindsPodConfigValue,
} from '~/generated/data-contracts';

describe('Filter Adaptation Functions', () => {
  describe('adaptFiltersForImage', () => {
    it('should expose adaptFiltersForImage method through ref', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const images = workspaceKind.podTemplate.options.imageConfig.values;
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<{
        adaptFiltersForImage: (image: WorkspacekindsImageConfigValue) => void;
      }>();

      render(
        <WorkspaceFormImageSelection
          images={images}
          selectedImage={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      expect(filterControlRef.current).toBeDefined();
      expect(filterControlRef.current?.adaptFiltersForImage).toBeDefined();
      expect(typeof filterControlRef.current?.adaptFiltersForImage).toBe('function');
    });

    it('should call adaptFiltersForImage to show hidden image', async () => {
      const workspaceKind = buildMockWorkspaceKind();
      const images = workspaceKind.podTemplate.options.imageConfig.values;

      // Create a hidden image
      const hiddenImage: WorkspacekindsImageConfigValue = {
        ...images[0],
        id: 'hidden-image',
        displayName: 'Hidden Image',
        hidden: true,
        redirect: undefined,
      };

      const allImages = [...images, hiddenImage];
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<{
        adaptFiltersForImage: (image: WorkspacekindsImageConfigValue) => void;
      }>();

      render(
        <WorkspaceFormImageSelection
          images={allImages}
          selectedImage={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      expect(screen.queryByText('Hidden Image')).not.toBeInTheDocument();

      filterControlRef.current?.adaptFiltersForImage(hiddenImage);

      await waitFor(() => {
        expect(screen.getByText('Hidden Image')).toBeInTheDocument();
      });
    });

    it('should call adaptFiltersForImage to show redirected image', async () => {
      const workspaceKind = buildMockWorkspaceKind();
      const images = workspaceKind.podTemplate.options.imageConfig.values;

      // Create a redirected image
      const redirectedImage: WorkspacekindsImageConfigValue = {
        ...images[0],
        id: 'redirected-image',
        displayName: 'Redirected Image',
        hidden: false,
        redirect: {
          to: 'target-image',
        },
      };

      const allImages = [...images, redirectedImage];
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<{
        adaptFiltersForImage: (image: WorkspacekindsImageConfigValue) => void;
      }>();

      render(
        <WorkspaceFormImageSelection
          images={allImages}
          selectedImage={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      filterControlRef.current?.adaptFiltersForImage(redirectedImage);

      await waitFor(() => {
        expect(screen.getByText('Redirected Image')).toBeInTheDocument();
      });
    });

    it('should call adaptFiltersForImage to show both hidden and redirected image', async () => {
      const workspaceKind = buildMockWorkspaceKind();
      const images = workspaceKind.podTemplate.options.imageConfig.values;

      const hiddenRedirectedImage: WorkspacekindsImageConfigValue = {
        ...images[0],
        id: 'hidden-redirected-image',
        displayName: 'Hidden Redirected Image',
        hidden: true,
        redirect: {
          to: 'target-image',
        },
      };

      const allImages = [...images, hiddenRedirectedImage];
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<{
        adaptFiltersForImage: (image: WorkspacekindsImageConfigValue) => void;
      }>();

      render(
        <WorkspaceFormImageSelection
          images={allImages}
          selectedImage={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      filterControlRef.current?.adaptFiltersForImage(hiddenRedirectedImage);

      await waitFor(() => {
        expect(screen.getByText('Hidden Redirected Image')).toBeInTheDocument();
      });
    });
  });

  describe('adaptFiltersForPodConfig', () => {
    it('should expose adaptFiltersForPodConfig method through ref', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const podConfigs = workspaceKind.podTemplate.options.podConfig.values;
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<{
        adaptFiltersForPodConfig: (podConfig: WorkspacekindsPodConfigValue) => void;
      }>();

      render(
        <WorkspaceFormPodConfigSelection
          podConfigs={podConfigs}
          selectedPodConfig={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      expect(filterControlRef.current).toBeDefined();
      expect(filterControlRef.current?.adaptFiltersForPodConfig).toBeDefined();
      expect(typeof filterControlRef.current?.adaptFiltersForPodConfig).toBe('function');
    });

    it('should call adaptFiltersForPodConfig to show hidden pod config', async () => {
      const workspaceKind = buildMockWorkspaceKind();
      const podConfigs = workspaceKind.podTemplate.options.podConfig.values;

      // Create a hidden pod config
      const hiddenPodConfig: WorkspacekindsPodConfigValue = {
        ...podConfigs[0],
        id: 'hidden-pod-config',
        displayName: 'Hidden Pod Config',
        hidden: true,
        redirect: undefined,
      };

      const allPodConfigs = [...podConfigs, hiddenPodConfig];
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<{
        adaptFiltersForPodConfig: (podConfig: WorkspacekindsPodConfigValue) => void;
      }>();

      render(
        <WorkspaceFormPodConfigSelection
          podConfigs={allPodConfigs}
          selectedPodConfig={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      expect(screen.queryByText('Hidden Pod Config')).not.toBeInTheDocument();

      filterControlRef.current?.adaptFiltersForPodConfig(hiddenPodConfig);

      await waitFor(() => {
        expect(screen.getByText('Hidden Pod Config')).toBeInTheDocument();
      });
    });

    it('should call adaptFiltersForPodConfig to show redirected pod config', async () => {
      const workspaceKind = buildMockWorkspaceKind();
      const podConfigs = workspaceKind.podTemplate.options.podConfig.values;

      // Create a redirected pod config
      const redirectedPodConfig: WorkspacekindsPodConfigValue = {
        ...podConfigs[0],
        id: 'redirected-pod-config',
        displayName: 'Redirected Pod Config',
        hidden: false,
        redirect: {
          to: 'target-pod-config',
        },
      };

      const allPodConfigs = [...podConfigs, redirectedPodConfig];
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<{
        adaptFiltersForPodConfig: (podConfig: WorkspacekindsPodConfigValue) => void;
      }>();

      render(
        <WorkspaceFormPodConfigSelection
          podConfigs={allPodConfigs}
          selectedPodConfig={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      filterControlRef.current?.adaptFiltersForPodConfig(redirectedPodConfig);

      await waitFor(() => {
        expect(screen.getByText('Redirected Pod Config')).toBeInTheDocument();
      });
    });
  });

  describe('Function naming verification', () => {
    it('should NOT have clearFiltersForImage method (old name)', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const images = workspaceKind.podTemplate.options.imageConfig.values;
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<ImageSelectionFilterHandle>();

      render(
        <WorkspaceFormImageSelection
          images={images}
          selectedImage={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      expect(
        (filterControlRef.current as unknown as Record<string, unknown>).clearFiltersForImage,
      ).toBeUndefined();
    });

    it('should NOT have clearFiltersForPodConfig method (old name)', () => {
      const workspaceKind = buildMockWorkspaceKind();
      const podConfigs = workspaceKind.podTemplate.options.podConfig.values;
      const mockOnSelect = jest.fn();
      const filterControlRef = React.createRef<PodConfigSelectionFilterHandle>();

      render(
        <WorkspaceFormPodConfigSelection
          podConfigs={podConfigs}
          selectedPodConfig={undefined}
          onSelect={mockOnSelect}
          filterControlRef={filterControlRef}
        />,
      );

      expect(
        (filterControlRef.current as unknown as Record<string, unknown>).clearFiltersForPodConfig,
      ).toBeUndefined();
    });
  });
});
