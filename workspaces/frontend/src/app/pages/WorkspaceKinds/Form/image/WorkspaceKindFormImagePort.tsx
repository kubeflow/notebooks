import React from 'react';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  FormGroup,
  Grid,
  GridItem,
  TextInput,
} from '@patternfly/react-core';
import { WorkspaceKindImagePort } from '~/app/types';

interface WorkspaceKindFormImagePortProps {
  ports: WorkspaceKindImagePort[];
  setPorts: (ports: WorkspaceKindImagePort[]) => void;
}

export const WorkspaceKindFormImagePort: React.FC<WorkspaceKindFormImagePortProps> = ({
  ports,
  setPorts,
}) => (
  <FormFieldGroupExpandable
    toggleAriaLabel="Port Details"
    header={
      <FormFieldGroupHeader
        titleText={{
          text: 'Port Configuration',
          id: 'workspace-kind-image-ports',
        }}
        titleDescription="Configure which port where this image will serve from"
      />
    }
  >
    <Grid hasGutter md={6}>
      <GridItem span={3}>
        <FormGroup label="ID" isRequired fieldId="port-id">
          <TextInput
            name="id"
            isRequired
            type="text"
            value={ports[0].id}
            onChange={(_, val) => setPorts([{ ...ports[0], id: val }])}
            id="port-id"
          />
        </FormGroup>
      </GridItem>
      <GridItem span={3}>
        <FormGroup label="Display Name" isRequired fieldId="port-display-name">
          <TextInput
            name="displayName"
            isRequired
            type="text"
            value={ports[0].displayName}
            onChange={(_, val) => setPorts([{ ...ports[0], displayName: val }])}
            id="port-display-name"
          />
        </FormGroup>
      </GridItem>
      <GridItem span={3}>
        <FormGroup label="Port" isRequired fieldId="port-number">
          <TextInput
            name="port"
            isRequired
            type="number"
            value={ports[0].port}
            onChange={(_, val) => setPorts([{ ...ports[0], port: Number(val) }])}
            id="port-number"
          />
        </FormGroup>
      </GridItem>
      <GridItem span={3}>
        <FormGroup label="Protocol" isRequired fieldId="port-protocol">
          <TextInput
            name="displayName"
            isDisabled
            type="text"
            value={ports[0].protocol}
            id="port-protocol"
          />
        </FormGroup>
      </GridItem>
    </Grid>
  </FormFieldGroupExpandable>
);
