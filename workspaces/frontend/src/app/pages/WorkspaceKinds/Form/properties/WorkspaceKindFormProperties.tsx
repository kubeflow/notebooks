import React, { useState } from 'react';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { WorkspaceKindProperties } from '~/app/types';

interface WorkspaceKindFormPropertiesProps {
  mode: string;
  properties: WorkspaceKindProperties;
  updateField: (properties: WorkspaceKindProperties) => void;
}

export const WorkspaceKindFormProperties: React.FC<WorkspaceKindFormPropertiesProps> = ({
  mode,
  properties,
  updateField,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <Content>
      <div className="pf-u-mb-0">
        <ExpandableSection
          toggleText="Properties"
          onToggle={() => setIsExpanded((prev) => !prev)}
          isExpanded={isExpanded}
          isIndented
        >
          <Form>
            <FormGroup label="Workspace Kind Name" isRequired fieldId="workspace-kind-name">
              <TextInput
                isRequired
                type="text"
                value={properties.displayName}
                onChange={(_, value) => updateField({ ...properties, displayName: value })}
                id="workspace-kind-name"
              />
            </FormGroup>
            <FormGroup label="Description" fieldId="workspace-kind-description">
              <TextInput
                type="text"
                value={properties.description}
                onChange={(_, value) => updateField({ ...properties, description: value })}
                id="workspace-kind-description"
              />
            </FormGroup>
            {mode === 'edit' && (
              <FormGroup
                style={{ marginTop: 'var(--mui-spacing-16px)' }}
                fieldId="workspace-kind-deprecated"
              >
                <Switch
                  aria-label="workspace-kind-deprecated"
                  isChecked={properties.deprecated}
                  label={
                    <div>
                      <div>Deprecated</div>
                      <HelperText>
                        Flag this workspace kind as deprecated and optionally set a deprecation
                        message
                      </HelperText>
                    </div>
                  }
                  onChange={() =>
                    updateField({ ...properties, deprecated: !properties.deprecated })
                  }
                  id="workspace-kind-deprecated"
                  name="workspace-kind-deprecated-switch"
                />
              </FormGroup>
            )}
            {mode === 'edit' && properties.deprecated && (
              <FormGroup>
                <TextInput
                  isDisabled={!properties.deprecated}
                  type="text"
                  label="Deprecation message"
                  value={properties.deprecationMessage}
                  placeholder="Deprecation message"
                  onChange={(_, value) => updateField({ ...properties, deprecationMessage: value })}
                  id="workspace-kind-deprecated-msg"
                />
              </FormGroup>
            )}
            <FormGroup
              fieldId="workspace-kind-hidden"
              style={{ marginTop: 'var(--mui-spacing-16px)' }}
            >
              <Switch
                isChecked={properties.hidden}
                onChange={() => updateField({ ...properties, hidden: !properties.hidden })}
                id="workspace-kind-hidden"
                name="workspace-kind-hidden-switch"
                aria-label="workspace-kind-hidden"
                label={
                  <div>
                    <div>Hidden</div>
                    <HelperText>Hide this workspace kind from users</HelperText>
                  </div>
                }
              />
            </FormGroup>
            <FormGroup label="Icon URL" isRequired fieldId="workspace-kind-icon">
              <TextInput
                isRequired
                type="text"
                value={properties.icon.url}
                onChange={(_, value) => updateField({ ...properties, icon: { url: value } })}
                id="workspace-kind-icon"
              />
            </FormGroup>
            <FormGroup label="Logo URL" isRequired fieldId="workspace-kind-logo">
              <TextInput
                isRequired
                type="text"
                value={properties.logo.url}
                onChange={(_, value) => updateField({ ...properties, logo: { url: value } })}
                id="workspace-kind-logo"
              />
            </FormGroup>
          </Form>
        </ExpandableSection>
      </div>
    </Content>
  );
};
