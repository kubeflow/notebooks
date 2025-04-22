import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  TextInput,
  Checkbox,
  Form,
  FormGroup,
  ExpandableSection,
  Divider,
  Split,
  SplitItem,
} from '@patternfly/react-core';
import { WorkspaceCreationImageDetails } from '~/app/pages/Workspaces/Creation/image/WorkspaceCreationImageDetails';
import { WorkspaceCreationPropertiesTable } from '~/app/pages/Workspaces/Creation/properties/WorkspaceCreationPropertiesTable';
import { WorkspaceImage } from '~/shared/types';

interface Volume {
  pvcName: string;
  mountPath: string;
  readOnly: boolean;
}

interface WorkspaceCreationImageSelectionProps {
  selectedImage: WorkspaceImage | undefined;
}

const WorkspaceCreationPropertiesSelection: React.FunctionComponent<
  WorkspaceCreationImageSelectionProps
> = ({ selectedImage }) => {
  const [workspaceName, setWorkspaceName] = useState('');
  const [deferUpdates, setDeferUpdates] = useState(false);
  const [homeDirectory, setHomeDirectory] = useState('');
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [isVolumesExpanded, setIsVolumesExpanded] = useState(false);

  const imageDetailsContent = useMemo(
    () => <WorkspaceCreationImageDetails workspaceImage={selectedImage} />,
    [selectedImage],
  );

  return (
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
                toggleText={isVolumesExpanded ? 'Volumes' : 'Add Volumes'}
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
                        onChange={(_, value) => setHomeDirectory(value)}
                        id="home-directory"
                      />
                    </FormGroup>

                    <FormGroup fieldId="volumes-table" style={{ marginTop: '1rem' }}>
                      <WorkspaceCreationPropertiesTable volumes={volumes} setVolumes={setVolumes} />
                    </FormGroup>
                  </>
                )}
              </ExpandableSection>
            </div>
            {!isVolumesExpanded && (
              <div style={{ paddingLeft: '36px', marginTop: '-10px' }}>
                <div>Workspace volume enables your project data to be persist</div>
                <div className="pf-u-font-size-sm">
                  <strong>{volumes.length} added</strong>
                </div>
              </div>
            )}
          </Form>
        </div>
      </SplitItem>
    </Split>
  );
};

export { WorkspaceCreationPropertiesSelection };
