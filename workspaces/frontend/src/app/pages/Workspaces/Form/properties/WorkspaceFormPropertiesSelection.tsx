import React, { useCallback, useMemo, useState } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { ValidatedOptions } from '@patternfly/react-core/dist/esm/helpers';
import { WorkspaceFormPropertiesVolumes } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes';
import {
  WorkspaceFormMode,
  WorkspaceFormProperties,
  WorkspacesPodVolumeMountValue,
} from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { generateWorkspaceSlug } from '~/app/pages/Workspaces/Form/utils/slugify';
import {
  MAX_DISPLAY_NAME_LENGTH,
  validateDisplayName,
} from '~/app/pages/Workspaces/Form/helpers';
import { WorkspaceFormPropertiesSecrets } from './WorkspaceFormPropertiesSecrets';

interface WorkspaceFormPropertiesSelectionProps {
  mode: WorkspaceFormMode;
  selectedProperties: WorkspaceFormProperties;
  onSelect: (properties: WorkspaceFormProperties) => void;
  homeVolumeMountPath?: string;
  workspaceNameError: string | null;
  onWorkspaceNameChange: (value: string) => void;
  onDisplayNameChange?: (displayName: string, workspaceName?: string) => void;
}

const WorkspaceFormPropertiesSelection: React.FunctionComponent<
  WorkspaceFormPropertiesSelectionProps
> = ({
  mode,
  selectedProperties,
  onSelect,
  homeVolumeMountPath,
  workspaceNameError,
  onWorkspaceNameChange,
  onDisplayNameChange,
}) => {
  const [isDataVolumesExpanded, setIsDataVolumesExpanded] = useState(false);
  const [isSecretsExpanded, setIsSecretsExpanded] = useState(false);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(
    Boolean(
      mode === 'update' ||
        (selectedProperties.workspaceName && !selectedProperties.displayName),
    ),
  );

  const displayNameError = validateDisplayName(selectedProperties.displayName);

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
      if (!isSlugManuallyEdited && mode !== 'update') {
        const nextWorkspaceName = generateWorkspaceSlug(value);
        if (onDisplayNameChange) {
          onDisplayNameChange(value, nextWorkspaceName);
        } else {
          onSelect({
            ...selectedProperties,
            displayName: value,
            workspaceName: nextWorkspaceName,
          });
          onWorkspaceNameChange(nextWorkspaceName);
        }
      } else {
        if (onDisplayNameChange) {
          onDisplayNameChange(value);
        } else {
          onSelect({
            ...selectedProperties,
            displayName: value,
          });
        }
      }
    },
    [
      isSlugManuallyEdited,
      mode,
      onDisplayNameChange,
      onSelect,
      onWorkspaceNameChange,
      selectedProperties,
    ],
  );

  const handleWorkspaceNameChange = useCallback(
    (value: string) => {
      setIsSlugManuallyEdited(true);
      onWorkspaceNameChange(value);
    },
    [onWorkspaceNameChange],
  );

  const handleDisplayNameBlur = useCallback(() => {
    const trimmed = (selectedProperties.displayName || '').trim();
    if (trimmed !== selectedProperties.displayName) {
      handleDisplayNameChange(trimmed);
    }
  }, [selectedProperties.displayName, handleDisplayNameChange]);

  const handleWorkspaceNameBlur = useCallback(() => {
    const trimmed = selectedProperties.workspaceName.trim();
    if (trimmed !== selectedProperties.workspaceName) {
      handleWorkspaceNameChange(trimmed);
    }
  }, [selectedProperties.workspaceName, handleWorkspaceNameChange]);

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
            helperTextNode={
              displayNameError ? (
                <HelperText>
                  <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                    {displayNameError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              type="text"
              value={selectedProperties.displayName || ''}
              onChange={(_, value) => handleDisplayNameChange(value)}
              onBlur={handleDisplayNameBlur}
              id="display-name"
              data-testid="display-name"
              placeholder="e.g. My Workspace"
              maxLength={MAX_DISPLAY_NAME_LENGTH}
              validated={displayNameError ? ValidatedOptions.error : ValidatedOptions.default}
            />
          </ThemeAwareFormGroupWrapper>

          {/* Workspace Name / Slug Input */}
          <ThemeAwareFormGroupWrapper
            label="Workspace Name"
            isRequired
            fieldId="workspace-name"
            className="pf-u-width-520"
            helperTextNode={
              workspaceNameError ? (
                <HelperText>
                  <HelperTextItem variant="error" icon={<ExclamationCircleIcon />}>
                    {workspaceNameError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              isRequired
              type="text"
              validated={workspaceNameError ? ValidatedOptions.error : ValidatedOptions.default}
              value={selectedProperties.workspaceName}
              onChange={(_, value) => handleWorkspaceNameChange(value)}
              onBlur={handleWorkspaceNameBlur}
              id="workspace-name"
              data-testid="workspace-name"
              isDisabled={mode === 'update'}
            />
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
