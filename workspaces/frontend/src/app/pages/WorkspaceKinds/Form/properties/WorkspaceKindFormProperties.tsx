import React from 'react';
import { Content, Divider, Form, FormGroup, Switch, TextInput } from '@patternfly/react-core';
import { WorkspaceKindProperties } from '~/app/types';

interface WorkspaceKindFormPropertiesProps {
  properties: WorkspaceKindProperties;
  updateField: (properties: WorkspaceKindProperties) => void;
}

export const WorkspaceKindFormProperties: React.FC<WorkspaceKindFormPropertiesProps> = ({
  properties,
  updateField,
}) => (
  <Content style={{ height: '100%' }}>
    <p>Configure properties for your workspace kind.</p>
    <Divider />
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
      <FormGroup label="Description" isRequired fieldId="workspace-kind-description">
        <TextInput
          isRequired
          type="text"
          value={properties.description}
          onChange={(_, value) => updateField({ ...properties, description: value })}
          id="workspace-kind-description"
        />
      </FormGroup>
      <FormGroup label="Deprecated" isRequired fieldId="workspace-kind-deprecated">
        <Switch
          aria-label="workspace-kind-deprecated"
          isChecked={properties.deprecated}
          onChange={() => updateField({ ...properties, deprecated: !properties.deprecated })}
          id="workspace-kind-deprecated"
          name="workspace-kind-deprecated-switch"
        />
      </FormGroup>
      {properties.deprecated && (
        <FormGroup label="Deprecation Message" isRequired fieldId="workspace-kind-deprecated-msg">
          <TextInput
            isDisabled={!properties.deprecated}
            type="text"
            value={properties.deprecationMessage}
            placeholder="Deprecation Message"
            onChange={(_, value) => updateField({ ...properties, deprecationMessage: value })}
            id="workspace-kind-deprecated-msg"
          />
        </FormGroup>
      )}

      <FormGroup label="Hidden" isRequired fieldId="workspace-kind-hidden">
        <Switch
          isChecked={properties.hidden}
          onChange={() => updateField({ ...properties, hidden: !properties.hidden })}
          id="workspace-kind-hidden"
          name="workspace-kind-hidden-switch"
          aria-label="workspace-kind-hidden"
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
  </Content>
);
