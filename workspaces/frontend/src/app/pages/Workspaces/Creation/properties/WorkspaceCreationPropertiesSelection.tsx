import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  Checkbox,
  Content,
  Divider,
  ExpandableSection,
  Form,
  FormGroup,
  Split,
  SplitItem,
  TextInput,
} from '@patternfly/react-core';
import { WorkspaceCreationImageDetails } from '~/app/pages/Workspaces/Creation/image/WorkspaceCreationImageDetails';
import { WorkspaceCreationPropertiesVolumes } from '~/app/pages/Workspaces/Creation/properties/WorkspaceCreationPropertiesVolumes';
import { WorkspaceCreateProperties } from '~/app/types';
import { WorkspaceImageConfigValue } from '~/shared/api/backendApiTypes';
import { WorkspaceCreationPropertiesSecrets } from './WorkspaceCreationPropertiesSecrets';

interface WorkspaceCreationPropertiesSelectionProps {
  selectedImage: WorkspaceImageConfigValue | undefined;
  selectedProperties: WorkspaceCreateProperties;
  onSelect: (properties: WorkspaceCreateProperties) => void;
}

const WorkspaceCreationPropertiesSelection: React.FunctionComponent<
  WorkspaceCreationPropertiesSelectionProps
> = ({ selectedImage, selectedProperties, onSelect }) => {
  const [isVolumesExpanded, setIsVolumesExpanded] = useState(false);
  const [isSecretsExpanded, setIsSecretsExpanded] = useState(false);

  const imageDetailsContent = useMemo(
    () => <WorkspaceCreationImageDetails workspaceImage={selectedImage} />,
    [selectedImage],
  );

  return (
    <Content style={{ height: '100%' }}>
      <p>Configure properties for your workspace.</p>
      <Divider />
      <Split hasGutter>
        <SplitItem style={{ minWidth: '200px' }}>{imageDetailsContent}</SplitItem>
        <SplitItem isFilled>
          <div className="pf-u-p-lg pf-u-max-width-xl">
            <Form>
              <FormGroup
                label="Workspace Name"
                isRequired
                fieldId="workspace-name"
                style={{ width: 520 }}
              >
                <TextInput
                  isRequired
                  type="text"
                  value={selectedProperties.workspaceName}
                  onChange={(_, value) => onSelect({ ...selectedProperties, workspaceName: value })}
                  id="workspace-name"
                />
              </FormGroup>
              <FormGroup fieldId="defer-updates">
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
                />
              </FormGroup>
              <Divider />
              <div className="pf-u-mb-0">
                <ExpandableSection
                  toggleText="Volumes"
                  onToggle={() => setIsVolumesExpanded((prev) => !prev)}
                  isExpanded={isVolumesExpanded}
                  isIndented
                >
                  {isVolumesExpanded && (
                    <>
                      <FormGroup
                        label="Home Directory"
                        fieldId="home-directory"
                        style={{ width: 500 }}
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
                        />
                      </FormGroup>

                      <FormGroup fieldId="volumes-table" style={{ marginTop: '1rem' }}>
                        <WorkspaceCreationPropertiesVolumes
                          volumes={selectedProperties.volumes}
                          setVolumes={(volumes) => onSelect({ ...selectedProperties, volumes })}
                        />
                      </FormGroup>
                    </>
                  )}
                </ExpandableSection>
              </div>
              {!isVolumesExpanded && (
                <div style={{ paddingLeft: '36px', marginTop: '-10px' }}>
                  <div>Workspace volumes enable your project data to persist.</div>
                  <div className="pf-u-font-size-sm">
                    <strong>{selectedProperties.volumes.length} added</strong>
                  </div>
                </div>
              )}
              <div className="pf-u-mb-0">
                <ExpandableSection
                  toggleText="Secrets"
                  onToggle={() => setIsSecretsExpanded((prev) => !prev)}
                  isExpanded={isSecretsExpanded}
                  isIndented
                >
                  {isSecretsExpanded && (
                    <FormGroup fieldId="secrets-table" style={{ marginTop: '1rem' }}>
                      <WorkspaceCreationPropertiesSecrets
                        secrets={selectedProperties.secrets}
                        setSecrets={(secrets) => onSelect({ ...selectedProperties, secrets })}
                      />
                    </FormGroup>
                  )}
                </ExpandableSection>
              </div>
              {!isSecretsExpanded && (
                <div style={{ paddingLeft: '36px', marginTop: '-10px' }}>
                  <div>Secrets enable your project to securely access and manage credentials.</div>
                  <div className="pf-u-font-size-sm">
                    <strong>{selectedProperties.secrets.length} added</strong>
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

export { WorkspaceCreationPropertiesSelection };
