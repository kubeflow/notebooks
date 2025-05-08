import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  TextInput,
  Checkbox,
  Form,
  FormGroup,
  ExpandableSection,
  Divider,
  Split,
  SplitItem,
  Content,
} from '@patternfly/react-core';
import { WorkspaceCreationImageDetails } from '~/app/pages/Workspaces/Creation/image/WorkspaceCreationImageDetails';
import { WorkspaceCreationPropertiesVolumes } from '~/app/pages/Workspaces/Creation/properties/WorkspaceCreationPropertiesVolumes';
import { WorkspaceImage, WorkspaceVolumes, WorkspaceVolume, WorkspaceSecret } from '~/shared/types';
import { WorkspaceCreationPropertiesSecrets } from './WorkspaceCreationPropertiesSecrets';

interface WorkspaceCreationPropertiesSelectionProps {
  selectedImage: WorkspaceImage | undefined;
}

const WorkspaceCreationPropertiesSelection: React.FunctionComponent<
  WorkspaceCreationPropertiesSelectionProps
> = ({ selectedImage }) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [deferUpdates, setDeferUpdates] = useState(false);
  const [homeDirectory, setHomeDirectory] = useState('');
  const [volumes, setVolumes] = useState<WorkspaceVolumes>({ home: '', data: [], secrets: [] });
  const [volumesData, setVolumesData] = useState<WorkspaceVolume[]>([]);
  const [secrets, setSecrets] = useState<WorkspaceSecret[]>(
    volumes.secrets.length ? volumes.secrets : [],
  );
  const [isVolumesExpanded, setIsVolumesExpanded] = useState(false);
  const [isSecretsExpanded, setIsSecretsExpanded] = useState(false);

  useEffect(() => {
    setVolumes((prev) => ({
      ...prev,
      data: volumesData,
    }));
  }, [volumesData]);

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
                  value={workspaceName}
                  onChange={(_, value) => setWorkspaceName(value)}
                  id="workspace-name"
                />
              </FormGroup>
              <FormGroup fieldId="defer-updates">
                <Checkbox
                  label="Defer Updates"
                  isChecked={deferUpdates}
                  onChange={() => setDeferUpdates((prev) => !prev)}
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
                          value={homeDirectory}
                          onChange={(_, value) => {
                            setHomeDirectory(value);
                            setVolumes((prev) => ({ ...prev, home: value }));
                          }}
                          id="home-directory"
                        />
                      </FormGroup>

                      <FormGroup fieldId="volumes-table" style={{ marginTop: '1rem' }}>
                        <WorkspaceCreationPropertiesVolumes
                          volumes={volumesData}
                          setVolumes={setVolumesData}
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
                    <strong>{volumes.data.length} added</strong>
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
                        secrets={secrets}
                        setSecrets={setSecrets}
                      />
                    </FormGroup>
                  )}
                </ExpandableSection>
              </div>
              {!isSecretsExpanded && (
                <div style={{ paddingLeft: '36px', marginTop: '-10px' }}>
                  <div>Secrets enable your project to securely access and manage credentials.</div>
                  <div className="pf-u-font-size-sm">
                    <strong>{secrets.length} added</strong>
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
