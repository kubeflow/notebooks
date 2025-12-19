import React, { useMemo, useState } from 'react';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { WorkspaceFormImageDetails } from '~/app/pages/Workspaces/Form/image/WorkspaceFormImageDetails';
import { WorkspaceFormPropertiesVolumes } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes';
import { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { WorkspaceFormMode, WorkspaceFormProperties } from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { WorkspaceFormPropertiesSecrets } from './WorkspaceFormPropertiesSecrets';

interface WorkspaceFormPropertiesSelectionProps {
  mode: WorkspaceFormMode;
  selectedImage: WorkspacekindsImageConfigValue | undefined;
  selectedProperties: WorkspaceFormProperties;
  onSelect: (properties: WorkspaceFormProperties) => void;
}

const WorkspaceFormPropertiesSelection: React.FunctionComponent<
  WorkspaceFormPropertiesSelectionProps
> = ({ mode, selectedImage, selectedProperties, onSelect }) => {
  const [isVolumesExpanded, setIsVolumesExpanded] = useState(false);
  const [isSecretsExpanded, setIsSecretsExpanded] = useState(false);

  const imageDetailsContent = useMemo(
    () => <WorkspaceFormImageDetails workspaceImage={selectedImage} />,
    [selectedImage],
  );

  return (
    <Content style={{ height: '100%' }}>
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{imageDetailsContent}</SplitItem>
        <SplitItem isFilled>
          <div className="pf-u-p-lg pf-u-max-width-xl">
            <Form>
              <ThemeAwareFormGroupWrapper
                label="Workspace Name"
                isRequired
                fieldId="workspace-name"
                className="pf-u-width-520"
              >
                <TextInput
                  isDisabled={mode === 'update'}
                  isRequired
                  type="text"
                  value={selectedProperties.workspaceName}
                  onChange={(_, value) => onSelect({ ...selectedProperties, workspaceName: value })}
                  id="workspace-name"
                  data-testid="workspace-name"
                />
              </ThemeAwareFormGroupWrapper>
              {mode === 'update' && (
                <HelperText>
                  <HelperTextItem
                    variant="default"
                    data-testid="workspace-name-cannot-be-changed-helper"
                    icon={
                      <InfoCircleIcon
                        style={{ color: 'var(--pf-t--global--icon--color--status--info--default)' }}
                      />
                    }
                  >
                    Workspace name cannot be changed after creation
                  </HelperTextItem>
                </HelperText>
              )}
              <FormGroup fieldId="defer-updates" className="pf-v6-u-pt-sm pf-v6-u-pb-sm">
                <Checkbox
                  label="Defer Updates"
                  isChecked={selectedProperties.deferUpdates}
                  onChange={() =>
                    onSelect({
                      ...selectedProperties,
                      deferUpdates: !selectedProperties.deferUpdates,
                    })
                  }
                  id="defer-updates"
                  data-testid="defer-updates-checkbox"
                />
              </FormGroup>
              <Divider />
              <ExpandableSection
                toggleText="Volumes"
                onToggle={() => setIsVolumesExpanded((prev) => !prev)}
                isExpanded={isVolumesExpanded}
                isIndented
              >
                {isVolumesExpanded && (
                  <Form>
                    <ThemeAwareFormGroupWrapper
                      label="Home Directory"
                      fieldId="home-directory"
                      className="pf-u-width-500"
                    >
                      <TextInput
                        value={selectedProperties.homeDirectory}
                        onChange={(_, value) => {
                          onSelect({
                            ...selectedProperties,
                            homeDirectory: value,
                          });
                        }}
                        id="home-directory"
                        type="text"
                        name="home-directory"
                      />
                    </ThemeAwareFormGroupWrapper>

                    <FormGroup fieldId="volumes-table" style={{ marginTop: '1rem' }}>
                      <WorkspaceFormPropertiesVolumes
                        volumes={selectedProperties.volumes}
                        setVolumes={(volumes) => onSelect({ ...selectedProperties, volumes })}
                      />
                    </FormGroup>
                  </Form>
                )}
              </ExpandableSection>
              {!isVolumesExpanded && (
                <div className="pf-v6-u-pl-xl pf-v6-u-pt-sm">
                  <div>Workspace volumes enable your project data to persist.</div>
                  <div className="pf-u-font-size-sm pf-v6-u-pb-md">
                    <strong data-testid="volumes-count">
                      {selectedProperties.volumes.length} added
                    </strong>
                  </div>
                </div>
              )}
              <ExpandableSection
                toggleText="Secrets"
                onToggle={() => setIsSecretsExpanded((prev) => !prev)}
                isExpanded={isSecretsExpanded}
                isIndented
              >
                {isSecretsExpanded && (
                  <FormGroup fieldId="secrets-table" style={{ marginTop: '1rem' }}>
                    <WorkspaceFormPropertiesSecrets
                      secrets={selectedProperties.secrets}
                      setSecrets={(secrets) => onSelect({ ...selectedProperties, secrets })}
                    />
                  </FormGroup>
                )}
              </ExpandableSection>
              {!isSecretsExpanded && (
                <div className="pf-v6-u-pl-xl pf-v6-u-mt-sm">
                  <div>Secrets enable your project to securely access and manage credentials.</div>
                  <div className="pf-u-font-size-sm">
                    <strong data-testid="secrets-count">
                      {selectedProperties.secrets.length} added
                    </strong>
                  </div>
                </div>
              )}
            </Form>
          </div>
        </SplitItem>
      </Split>
    </Content>
  );
};

export { WorkspaceFormPropertiesSelection };
