import React, { useState } from 'react';
import {
  FormFieldGroup,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Radio } from '@patternfly/react-core/dist/esm/components/Radio';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import {
  V1Beta1WorkspaceKindAsset,
  V1Beta1WorkspaceKindAssetMediaType,
} from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

type AssetMode = 'url' | 'configMap';

interface WorkspaceKindAssetFieldProps {
  label: string;
  fieldIdPrefix: string;
  asset: V1Beta1WorkspaceKindAsset;
  onChange: (asset: V1Beta1WorkspaceKindAsset) => void;
}

export const WorkspaceKindAssetField: React.FC<WorkspaceKindAssetFieldProps> = ({
  label,
  fieldIdPrefix,
  asset,
  onChange,
}) => {
  const [mode, setMode] = useState<AssetMode>('url');

  return (
    <FormFieldGroup
      aria-label={`${label} Asset`}
      header={
        <FormFieldGroupHeader
          titleText={{
            text: label,
            id: `${fieldIdPrefix}-group`,
          }}
        />
      }
    >
      <ThemeAwareFormGroupWrapper
        label="Source"
        fieldId={`${fieldIdPrefix}-source-type`}
        role="radiogroup"
        skipFieldset
      >
        <Flex spaceItems={{ default: 'spaceItemsSm' }}>
          <FlexItem>
            <Radio
              id={`${fieldIdPrefix}-source-url`}
              data-testid={`${fieldIdPrefix}-source-url`}
              name={`${fieldIdPrefix}-source-type`}
              label="URL"
              isChecked={mode === 'url'}
              onChange={() => {
                setMode('url');
                onChange({ url: '' });
              }}
            />
          </FlexItem>
          <FlexItem>
            <Radio
              id={`${fieldIdPrefix}-source-config-map`}
              data-testid={`${fieldIdPrefix}-source-config-map`}
              name={`${fieldIdPrefix}-source-type`}
              label="ConfigMap"
              isChecked={mode === 'configMap'}
              onChange={() => {
                setMode('configMap');
                onChange({
                  configMap: {
                    name: '',
                    namespace: '',
                    key: '',
                    mediaType: V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG,
                  },
                });
              }}
            />
          </FlexItem>
        </Flex>
      </ThemeAwareFormGroupWrapper>

      {mode === 'url' && (
        <ThemeAwareFormGroupWrapper
          label={`${label} URL`}
          isRequired
          fieldId={`${fieldIdPrefix}-url`}
          helperTextNode={
            <HelperText>
              <HelperTextItem icon={<InfoCircleIcon />}>
                Value must be a valid URL to an image
              </HelperTextItem>
            </HelperText>
          }
        >
          <TextInput
            isRequired
            type="text"
            value={asset.url ?? ''}
            onChange={(_, value) => onChange({ url: value })}
            id={`${fieldIdPrefix}-url`}
            data-testid={`${fieldIdPrefix}-url-input`}
          />
        </ThemeAwareFormGroupWrapper>
      )}

      {mode === 'configMap' && (
        <>
          <ThemeAwareFormGroupWrapper
            label="Name"
            isRequired
            fieldId={`${fieldIdPrefix}-config-map-name`}
          >
            <TextInput
              isRequired
              type="text"
              value={asset.configMap?.name ?? ''}
              onChange={(_, value) =>
                onChange({
                  configMap: { ...asset.configMap!, name: value },
                })
              }
              id={`${fieldIdPrefix}-config-map-name`}
              data-testid={`${fieldIdPrefix}-config-map-name-input`}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Namespace"
            isRequired
            fieldId={`${fieldIdPrefix}-config-map-namespace`}
          >
            <TextInput
              isRequired
              type="text"
              value={asset.configMap?.namespace ?? ''}
              onChange={(_, value) =>
                onChange({
                  configMap: { ...asset.configMap!, namespace: value },
                })
              }
              id={`${fieldIdPrefix}-config-map-namespace`}
              data-testid={`${fieldIdPrefix}-config-map-namespace-input`}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Key"
            isRequired
            fieldId={`${fieldIdPrefix}-config-map-key`}
            helperTextNode={
              <HelperText>
                <HelperTextItem icon={<InfoCircleIcon />}>
                  Only letters, digits, hyphens, dots, or underscores
                </HelperTextItem>
              </HelperText>
            }
          >
            <TextInput
              isRequired
              type="text"
              value={asset.configMap?.key ?? ''}
              onChange={(_, value) =>
                onChange({
                  configMap: { ...asset.configMap!, key: value },
                })
              }
              id={`${fieldIdPrefix}-config-map-key`}
              data-testid={`${fieldIdPrefix}-config-map-key-input`}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Media Type"
            fieldId={`${fieldIdPrefix}-config-map-media-type`}
          >
            <TextInput
              type="text"
              value={
                asset.configMap?.mediaType ??
                V1Beta1WorkspaceKindAssetMediaType.WorkspaceKindAssetMediaTypeSVG
              }
              isDisabled
              id={`${fieldIdPrefix}-config-map-media-type`}
              data-testid={`${fieldIdPrefix}-config-map-media-type-input`}
            />
          </ThemeAwareFormGroupWrapper>
        </>
      )}
    </FormFieldGroup>
  );
};
