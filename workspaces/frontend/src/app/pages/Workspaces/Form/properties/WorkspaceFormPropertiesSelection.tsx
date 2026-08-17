import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { WorkspaceFormPropertiesVolumes } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes';
import {
  WorkspaceFormMode,
  WorkspaceFormProperties,
  WorkspacesPodVolumeMountValue,
} from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { generateWorkspaceSlug } from '~/app/pages/Workspaces/Form/utils/slugify';
import { WorkspaceFormPropertiesSecrets } from './WorkspaceFormPropertiesSecrets';

interface WorkspaceFormPropertiesSelectionProps {
  mode: WorkspaceFormMode;
  selectedProperties: WorkspaceFormProperties;
  onSelect: (properties: WorkspaceFormProperties) => void;
  homeVolumeMountPath?: string;
  onValidityChange?: (isValid: boolean) => void;
}

const DISPLAY_NAME_VALID_PATTERN = /^[a-zA-Z0-9\-._\s]*$/;
const isDisplayNameValid = (value: string): boolean => DISPLAY_NAME_VALID_PATTERN.test(value);

const RFC1123_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
const isWorkspaceNameValid = (value: string): boolean =>
  value.length > 0 && value.length <= 253 && RFC1123_PATTERN.test(value);

const WorkspaceFormPropertiesSelection: React.FunctionComponent<
  WorkspaceFormPropertiesSelectionProps
> = ({ mode, selectedProperties, onSelect, homeVolumeMountPath, onValidityChange }) => {
  const [isDataVolumesExpanded, setIsDataVolumesExpanded] = useState(false);
  const [isSecretsExpanded, setIsSecretsExpanded] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [isDisplayNameInvalid, setIsDisplayNameInvalid] = useState(false);
  const [isWorkspaceNameInvalid, setIsWorkspaceNameInvalid] = useState(false);

  useEffect(() => {
    onValidityChange?.(!isDisplayNameInvalid && !isWorkspaceNameInvalid);
  }, [isDisplayNameInvalid, isWorkspaceNameInvalid, onValidityChange]);

  const homeVolumeArray: WorkspacesPodVolumeMountValue[] = useMemo(
    () => (selectedProperties.homeVolume ? [selectedProperties.homeVolume] : []),
    [selectedProperties.homeVolume],
  );

  const homePvcNames = useMemo(
    () =>
      new Set<string>(selectedProperties.homeVolume ? [selectedProperties.homeVolume.pvcName] : []),
    [selectedProperties.homeVolume],
  );

  const dataPvcNames = useMemo(
    () =>
      new Set<string>(
        selectedProperties.volumes.map((v) => v.pvcName).filter((name): name is string => !!name),
      ),
    [selectedProperties.volumes],
  );

  const handleDisplayNameChange = useCallback(
    (value: string) => {
      setIsDisplayNameInvalid(!isDisplayNameValid(value));
      const nextWorkspaceName =
        isSlugManuallyEdited || mode === 'update'
          ? selectedProperties.workspaceName
          : generateWorkspaceSlug(value);
      onSelect({
        ...selectedProperties,
        displayName: value,
        workspaceName: nextWorkspaceName,
      });
    },
    [selectedProperties, onSelect, isSlugManuallyEdited, mode],
  );

  const handleWorkspaceNameChange = useCallback(
    (value: string) => {
      setIsSlugManuallyEdited(true);
      setIsWorkspaceNameInvalid(!isWorkspaceNameValid(value));
      onSelect({
        ...selectedProperties,
        workspaceName: value,
      });
    },
    [selectedProperties, onSelect],
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
          {/* Display Name Input */}
          <ThemeAwareFormGroupWrapper
            label="Display Name"
            fieldId="display-name"
            className="pf-u-width-520"
          >
            <TextInput
              type="text"
              value={selectedProperties.displayName || ''}
              onChange={(_, value) => handleDisplayNameChange(value)}
              onBlur={() => handleDisplayNameChange((selectedProperties.displayName || '').trim())}
              id="display-name"
              data-testid="display-name"
              placeholder="e.g. My Workspace"
              maxLength={253}
              validated={isDisplayNameInvalid ? 'error' : 'default'}
            />
            {isDisplayNameInvalid && (
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  Only letters, numbers, spaces, and - _ . are allowed.
                </HelperTextItem>
              </HelperText>
            )}
          </ThemeAwareFormGroupWrapper>

          {/* Workspace Name / Slug Input */}
          <ThemeAwareFormGroupWrapper label="Workspace Name" fieldId="workspace-name" isRequired>
            <TextInput
              isRequired
              type="text"
              value={selectedProperties.workspaceName}
              onChange={(_, value) => handleWorkspaceNameChange(value)}
              id="workspace-name"
              data-testid="workspace-name"
              validated={isWorkspaceNameInvalid ? 'error' : 'default'}
              isDisabled={mode === 'update'}
            />
            {isWorkspaceNameInvalid && (
              <HelperText>
                <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                  Must be lowercase alphanumeric or &apos;-&apos;, and start/end with a letter or
                  number.
                </HelperTextItem>
              </HelperText>
            )}
          </ThemeAwareFormGroupWrapper>
          {mode === 'update' && (
            <HelperText>
              <HelperTextItem
                variant="default"
                data-testid="workspace-name-cannot-be-changed-helper"
                icon={<InfoCircleIcon className="workspace-form__info-icon" />}
              >
                Workspace name cannot be changed after creation
              </HelperTextItem>
            </HelperText>
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
                  className="pf-v6-u-ml-0"
                >
                  <InfoCircleIcon className="pf-v6-u-mr-xs" />
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
