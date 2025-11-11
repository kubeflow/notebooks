import React from 'react';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { Grid, GridItem } from '@patternfly/react-core/dist/esm/layouts/Grid';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { WorkspaceKindImagePort } from '~/app/types';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';

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
        <ThemeAwareFormGroupWrapper label="ID" isRequired fieldId="port-id">
          <TextInput
            name="id"
            isRequired
            type="text"
            value={ports[0].id}
            onChange={(_, val) => setPorts([{ ...ports[0], id: val }])}
            id="port-id"
          />
        </ThemeAwareFormGroupWrapper>
      </GridItem>
      <GridItem span={3}>
        <ThemeAwareFormGroupWrapper label="Display Name" isRequired fieldId="port-display-name">
          <TextInput
            name="displayName"
            isRequired
            type="text"
            value={ports[0].displayName}
            onChange={(_, val) => setPorts([{ ...ports[0], displayName: val }])}
            id="port-display-name"
          />
        </ThemeAwareFormGroupWrapper>
      </GridItem>
      <GridItem span={3}>
        <ThemeAwareFormGroupWrapper label="Port" isRequired fieldId="port-number">
          <TextInput
            name="port"
            isRequired
            type="number"
            value={ports[0].port}
            onChange={(_, val) => setPorts([{ ...ports[0], port: Number(val) }])}
            id="port-number"
          />
        </ThemeAwareFormGroupWrapper>
      </GridItem>
      <GridItem span={3}>
        <ThemeAwareFormGroupWrapper label="Protocol" isRequired fieldId="port-protocol">
          <TextInput
            name="displayName"
            isDisabled
            type="text"
            value={ports[0].protocol}
            id="port-protocol"
          />
        </ThemeAwareFormGroupWrapper>
      </GridItem>
    </Grid>
  </FormFieldGroupExpandable>
);
