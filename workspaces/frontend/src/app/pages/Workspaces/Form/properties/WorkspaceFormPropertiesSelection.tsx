import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { ValidatedOptions } from '@patternfly/react-core/dist/esm/helpers';
import { getResourceNameCriteria } from '~/app/pages/Workspaces/Form/helpers';
import { WorkspaceFormPropertiesVolumes } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes';
import {
  WorkspaceFormMode,
  WorkspaceFormProperties,
  WorkspacesPodVolumeMountValue,
} from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { WorkspaceFormPropertiesSecrets } from './WorkspaceFormPropertiesSecrets';

interface WorkspaceFormPropertiesSelectionProps {
  mode: WorkspaceFormMode;
  selectedProperties: WorkspaceFormProperties;
  onSelect: (properties: WorkspaceFormProperties) => void;
  homeVolumeMountPath?: string;
  displayNameError: string | null;
  onDisplayNameChange: (value: string) => void;
  resourceNameError: string | null;
  isResourceNameEditing: boolean;
  onStartResourceNameEdit: () => void;
  onResourceNameChange: (value: string) => void;
}

const WorkspaceFormPropertiesSelection: React.FunctionComponent<
  WorkspaceFormPropertiesSelectionProps
> = ({
  mode,
  selectedProperties,
  onSelect,
  homeVolumeMountPath,
  displayNameError,
  onDisplayNameChange,
  resourceNameError,
  isResourceNameEditing,
  onStartResourceNameEdit,
  onResourceNameChange,
}) => {
  const [isDataVolumesExpanded, setIsDataVolumesExpanded] = useState(false);
  const [isSecretsExpanded, setIsSecretsExpanded] = useState(false);

  const homeVolumeArray: WorkspacesPodVolumeMountValue[] = useMemo(
    () => (selectedProperties.homeVolume ? [selectedProperties.homeVolume] : []),
    [selectedProperties.homeVolume],
  );

  const homePvcNames = useMemo(
    () => new Set(selectedProperties.homeVolume ? [selectedProperties.homeVolume.pvcName] : []),
    [selectedProperties.homeVolume],
  );

  const dataPvcNames = useMemo(
    () => new Set(selectedProperties.volumes.map((v) => v.pvcName)),
    [selectedProperties.volumes],
  );

  const handleSetHomeVolume = useCallback(
    (volumes: WorkspacesPodVolumeMountValue[]) => {
      onSelect({ ...selectedProperties, homeVolume: volumes[0] });
    },
    [selectedProperties, onSelect],
  );

  const dataVolumesInfo = (
    <div className="pf-v6-u-pl-xl pf-v6-u-pt-sm pf-v6-u-pb-sm">
      <div>Workspace volumes enable your project data to persist.</div>
      <div className="pf-u-font-size-sm">
        <strong data-testid="volumes-count">{selectedProperties.volumes.length} added</strong>
      </div>
    </div>
  );

  const secretsInfo = (
    <div className="pf-v6-u-pl-xl pf-v6-u-pt-sm pf-v6-u-pb-sm">
      <div>Secrets enable your project to securely access and manage credentials.</div>
      <div className="pf-u-font-size-sm">
        <strong data-testid="secrets-count">{selectedProperties.secrets.length} added</strong>
      </div>
    </div>
  );

  return (
    <Content className="workspace-form__full-height">
      <div className="pf-u-p-lg pf-u-max-width-xl">
        <Form>
          <ThemeAwareFormGroupWrapper
            label="Display Name"
            isRequired
            fieldId="workspace-display-name"
            className="pf-u-width-520"
            helperTextNode={
              displayNameError ? (
                <HelperText>
                  <HelperTextItem variant="error">{displayNameError}</HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              isRequired
              type="text"
              validated={displayNameError ? ValidatedOptions.error : ValidatedOptions.default}
              value={selectedProperties.displayName}
              onChange={(_, value) => onDisplayNameChange(value)}
              onBlur={() => onDisplayNameChange(selectedProperties.displayName.trim())}
              id="workspace-display-name"
              data-testid="workspace-display-name"
            />
          </ThemeAwareFormGroupWrapper>
          {(selectedProperties.displayName.trim() || isResourceNameEditing) && (
            <>
              {mode === 'create' && isResourceNameEditing ? (
                <ThemeAwareFormGroupWrapper
                  label="Resource Name"
                  isRequired
                  fieldId="workspace-resource-name"
                  className="pf-u-width-520"
                  helperTextNode={
                    <HelperText
                      data-testid="workspace-resource-name-criteria"
                      className="workspace-form__helper-text-icon-visible"
                    >
                      {getResourceNameCriteria(selectedProperties.name).map((criterion) => (
                        <HelperTextItem
                          key={criterion.key}
                          data-testid={`workspace-resource-name-criterion-${criterion.key}`}
                          variant={criterion.isValid ? 'success' : 'error'}
                          className="pf-v6-u-ml-0 pf-v6-u-mt-0"
                        >
                          {criterion.label}
                        </HelperTextItem>
                      ))}
                    </HelperText>
                  }
                >
                  <TextInput
                    id="workspace-resource-name"
                    isRequired
                    autoFocus
                    type="text"
                    value={selectedProperties.name}
                    onChange={(_, value) => onResourceNameChange(value)}
                    validated={
                      resourceNameError ? ValidatedOptions.error : ValidatedOptions.success
                    }
                    aria-label="Resource name"
                    data-testid="workspace-resource-name-input"
                  />
                </ThemeAwareFormGroupWrapper>
              ) : (
                <Flex
                  alignItems={{ default: 'alignItemsCenter' }}
                  spaceItems={{ default: 'spaceItemsSm' }}
                >
                  <FlexItem>
                    <span data-testid="workspace-resource-name">
                      The Resource Name will be{' '}
                      <strong data-testid="workspace-resource-name-value">
                        {selectedProperties.name}
                      </strong>
                    </span>
                  </FlexItem>
                  {mode === 'create' && (
                    <FlexItem>
                      <Button
                        variant="plain"
                        aria-label="Edit resource name"
                        onClick={onStartResourceNameEdit}
                        data-testid="workspace-resource-name-edit"
                      >
                        <PencilAltIcon />
                      </Button>
                    </FlexItem>
                  )}
                </Flex>
              )}
              {mode === 'update' && (
                <HelperText>
                  <HelperTextItem
                    variant="default"
                    data-testid="workspace-resource-name-cannot-be-changed-helper"
                    icon={<InfoCircleIcon className="workspace-form__info-icon" />}
                  >
                    Resource name cannot be changed after creation
                  </HelperTextItem>
                </HelperText>
              )}
            </>
          )}
          <ExpandableSection toggleText="Home Volume" isExpanded isIndented>
            <div className="pf-v6-u-pl-xl pf-v6-u-pt-sm pf-v6-u-pb-sm">
              <div>The home volume persists your workspace home directory.</div>
            </div>
            <FormGroup fieldId="home-volume-table" className="workspace-form__form-group--spaced">
              <WorkspaceFormPropertiesVolumes
                volumes={homeVolumeArray}
                setVolumes={handleSetHomeVolume}
                fixedMountPath={homeVolumeMountPath}
                excludedPvcNames={dataPvcNames}
              />
            </FormGroup>
            {!selectedProperties.homeVolume && (
              <HelperText>
                <HelperTextItem
                  variant="error"
                  data-testid="workspace-home-volume-required-helper"
                  className="pf-v6-u-ml-0 workspace-form__helper-text-icon-visible"
                >
                  <strong>Mounting a home volume is required.</strong>
                </HelperTextItem>
              </HelperText>
            )}
          </ExpandableSection>
          <ExpandableSection
            toggleText="Data Volumes"
            onToggle={() => setIsDataVolumesExpanded((prev) => !prev)}
            isExpanded={isDataVolumesExpanded}
          >
            {dataVolumesInfo}
            {isDataVolumesExpanded && (
              <FormGroup
                fieldId="volumes-table"
                className="workspace-form__form-group--spaced pf-v6-u-pl-lg"
              >
                <WorkspaceFormPropertiesVolumes
                  volumes={selectedProperties.volumes}
                  setVolumes={(volumes) => onSelect({ ...selectedProperties, volumes })}
                  excludedPvcNames={homePvcNames}
                />
              </FormGroup>
            )}
          </ExpandableSection>
          {!isDataVolumesExpanded && dataVolumesInfo}
          <ExpandableSection
            toggleText="Secrets"
            data-testid="secrets-expandable-section"
            onToggle={() => setIsSecretsExpanded((prev) => !prev)}
            isExpanded={isSecretsExpanded}
          >
            {secretsInfo}
            {isSecretsExpanded && (
              <FormGroup
                fieldId="secrets-table"
                className="workspace-form__form-group--spaced pf-v6-u-pl-lg"
              >
                <WorkspaceFormPropertiesSecrets
                  secrets={selectedProperties.secrets}
                  setSecrets={(secrets) => onSelect({ ...selectedProperties, secrets })}
                />
              </FormGroup>
            )}
          </ExpandableSection>
          {!isSecretsExpanded && secretsInfo}
        </Form>
      </div>
    </Content>
  );
};

export { WorkspaceFormPropertiesSelection };
