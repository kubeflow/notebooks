import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { userEvent } from '@testing-library/user-event';
import { WorkspaceKindAssetField } from '~/app/pages/WorkspaceKinds/Form/properties/WorkspaceKindAssetField';
import {
  V1Beta1WorkspaceKindAsset,
  V1Beta1WorkspaceKindAssetMediaType,
} from '~/generated/data-contracts';

const renderAssetField = (asset: V1Beta1WorkspaceKindAsset, onChange = jest.fn()) =>
  render(
    <WorkspaceKindAssetField
      label="Icon"
      fieldIdPrefix="test-icon"
      asset={asset}
      onChange={onChange}
    />,
  );

describe('WorkspaceKindAssetField', () => {
  it('should show URL fields when asset has url', () => {
    renderAssetField({ url: 'https://example.com/icon.png' });

    expect(screen.getByTestId('test-icon-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon-url-input')).toHaveValue('https://example.com/icon.png');
    expect(screen.queryByTestId('test-icon-config-map-name-input')).not.toBeInTheDocument();
  });

  it('should show ConfigMap fields when asset has configMap', () => {
    renderAssetField({
      configMap: {
        name: 'my-icons',
        namespace: 'kubeflow',
        key: 'icon.svg',
        mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
      },
    });

    expect(screen.queryByTestId('test-icon-url-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-icon-config-map-name-input')).toHaveValue('my-icons');
    expect(screen.getByTestId('test-icon-config-map-namespace-input')).toHaveValue('kubeflow');
    expect(screen.getByTestId('test-icon-config-map-key-input')).toHaveValue('icon.svg');
  });

  it('should switch to ConfigMap fields when asset prop changes from url to configMap', () => {
    const { rerender } = render(
      <WorkspaceKindAssetField
        label="Icon"
        fieldIdPrefix="test-icon"
        asset={{ url: '' }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('test-icon-url-input')).toBeInTheDocument();
    expect(screen.queryByTestId('test-icon-config-map-name-input')).not.toBeInTheDocument();

    rerender(
      <WorkspaceKindAssetField
        label="Icon"
        fieldIdPrefix="test-icon"
        asset={{
          configMap: {
            name: 'my-icons',
            namespace: 'kubeflow',
            key: 'icon.svg',
            mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
          },
        }}
        onChange={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('test-icon-url-input')).not.toBeInTheDocument();
    expect(screen.getByTestId('test-icon-config-map-name-input')).toHaveValue('my-icons');
  });

  it('should call onChange with url shape when URL radio is clicked', async () => {
    const onChange = jest.fn();
    renderAssetField(
      {
        configMap: {
          name: 'my-icons',
          namespace: 'kubeflow',
          key: 'icon.svg',
          mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
        },
      },
      onChange,
    );

    await userEvent.click(screen.getByTestId('test-icon-source-url'));
    expect(onChange).toHaveBeenCalledWith({ url: '' });
  });

  it('should call onChange with configMap shape when ConfigMap radio is clicked', async () => {
    const onChange = jest.fn();
    renderAssetField({ url: 'https://example.com/icon.png' }, onChange);

    await userEvent.click(screen.getByTestId('test-icon-source-config-map'));
    expect(onChange).toHaveBeenCalledWith({
      configMap: {
        name: '',
        namespace: '',
        key: '',
        mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
      },
    });
  });

  it('should default to URL mode when asset is empty', () => {
    renderAssetField({});

    expect(screen.getByTestId('test-icon-url-input')).toBeInTheDocument();
    expect(screen.queryByTestId('test-icon-config-map-name-input')).not.toBeInTheDocument();
  });
});
