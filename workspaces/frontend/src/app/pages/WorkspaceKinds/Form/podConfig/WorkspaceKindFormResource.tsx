import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Grid, GridItem } from '@patternfly/react-core/dist/esm/layouts/Grid';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import {
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { useThemeContext } from 'mod-arch-kubeflow';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { generateUniqueId } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';
import { getResourceErrors } from './resourceValidation';

export type PodResourceEntry = {
  id: string; // Unique identifier for each resource entry
  type: string;
  request: string;
  limit: string;
};

interface WorkspaceKindFormResourceProps {
  setResources: (value: React.SetStateAction<PodResourceEntry[]>) => void;
  cpu: PodResourceEntry;
  memory: PodResourceEntry;
  custom: PodResourceEntry[];
}

export const WorkspaceKindFormResource: React.FC<WorkspaceKindFormResourceProps> = ({
  setResources,
  cpu,
  memory,
  custom,
}) => {
  const [cpuRequestEnabled, setCpuRequestEnabled] = useState(cpu.request.length > 0);
  const [memoryRequestEnabled, setMemoryRequestEnabled] = useState(memory.request.length > 0);
  const [cpuLimitEnabled, setCpuLimitEnabled] = useState(cpu.limit.length > 0);
  const [memoryLimitEnabled, setMemoryLimitEnabled] = useState(memory.limit.length > 0);
  const { isMUITheme } = useThemeContext();
  const handleChange = useCallback(
    (resourceId: string, field: 'type' | 'request' | 'limit', value: string) => {
      setResources((resources: PodResourceEntry[]) =>
        resources.map((r) => (r.id === resourceId ? { ...r, [field]: value } : r)),
      );
    },
    [setResources],
  );

  const handleAddCustom = useCallback(() => {
    setResources((resources: PodResourceEntry[]) => [
      ...resources,
      { id: generateUniqueId(), type: '', request: '', limit: '1' },
    ]);
  }, [setResources]);

  const handleRemoveCustom = useCallback(
    (resourceId: string) => {
      setResources((resources: PodResourceEntry[]) => resources.filter((r) => r.id !== resourceId));
    },
    [setResources],
  );

  const handleCpuLimitToggle = (enabled: boolean) => {
    setCpuLimitEnabled(enabled);
    handleChange(cpu.id, 'limit', enabled ? cpu.request || '1' : '');
  };
  const handleCpuRequestToggle = (enabled: boolean) => {
    setCpuRequestEnabled(enabled);
    handleChange(cpu.id, 'request', enabled ? cpu.limit || '1' : '');
  };
  const handleMemoryLimitToggle = (enabled: boolean) => {
    setMemoryLimitEnabled(enabled);
    handleChange(memory.id, 'limit', enabled ? memory.request || '1Mi' : '');
  };
  const handleMemoryRequestToggle = (enabled: boolean) => {
    setMemoryRequestEnabled(enabled);
    handleChange(memory.id, 'request', enabled ? memory.limit || '1Mi' : '');
  };

  const resourceErrors = [cpu, memory].flatMap(getResourceErrors);
  const getResourceCountText = useCallback(() => {
    const standardResourceCount =
      (cpu.request || cpu.limit ? 1 : 0) + (memory.request || memory.limit ? 1 : 0);
    const customResourceCount = custom.length;
    if (standardResourceCount > 0 && customResourceCount > 0) {
      return `${standardResourceCount} standard and ${customResourceCount} custom resources added`;
    }
    if (standardResourceCount > 0) {
      return `${standardResourceCount} standard resources added`;
    }
    if (customResourceCount > 0) {
      return `${customResourceCount} custom resources added`;
    }
    return '0 added';
  }, [cpu.request, cpu.limit, memory.request, memory.limit, custom.length]);

  return (
    <FormFieldGroupExpandable
      data-testid="pod-config-resources"
      className="form-label-field-group"
      toggleAriaLabel="Resources"
      header={
        <FormFieldGroupHeader
          titleText={{
            text: 'Resources',
            id: 'workspace-kind-pod-config-resource',
          }}
          titleDescription={
            <>
              <div style={{ fontSize: '12px' }}>
                Optional: Configure k8s Pod Resource Requests & Limits.
              </div>
              <div className="pf-u-font-size-sm">
                <strong>{getResourceCountText()}</strong>
              </div>
            </>
          }
        />
      }
    >
      <div className="pf-v6-c-form">
        <Title headingLevel="h6">Standard Resources</Title>
        <Grid hasGutter className="pf-v6-u-mb-sm">
          <GridItem span={6}>
            <Checkbox
              id="cpu-request-checkbox"
              data-testid="cpu-request-checkbox"
              onChange={(_event, checked) => handleCpuRequestToggle(checked)}
              isChecked={cpuRequestEnabled}
              label="CPU Request"
            />
          </GridItem>
          <GridItem span={6}>
            <Checkbox
              id="memory-request-checkbox"
              data-testid="memory-request-checkbox"
              onChange={(_event, checked) => handleMemoryRequestToggle(checked)}
              isChecked={memoryRequestEnabled}
              label="Memory Request"
            />
          </GridItem>
          <GridItem span={6}>
            <ResourceInputWrapper
              allowEmpty
              type="cpu"
              value={cpu.request}
              onChange={(value) => handleChange(cpu.id, 'request', value)}
              placeholder="e.g. 1"
              min={0}
              aria-label="CPU request"
              isDisabled={!cpuRequestEnabled}
            />
          </GridItem>
          <GridItem span={6}>
            <ResourceInputWrapper
              allowEmpty
              type="memory"
              value={memory.request}
              onChange={(value) => handleChange(memory.id, 'request', value)}
              placeholder="e.g. 512Mi"
              min={0}
              aria-label="Memory request"
              isDisabled={!memoryRequestEnabled}
            />
          </GridItem>
          <GridItem span={6}>
            <Checkbox
              id="cpu-limit-checkbox"
              data-testid="cpu-limit-checkbox"
              onChange={(_event, checked) => handleCpuLimitToggle(checked)}
              isChecked={cpuLimitEnabled}
              label="CPU Limit"
              aria-label="Enable CPU limit"
            />
          </GridItem>
          <GridItem span={6}>
            <Checkbox
              id="memory-limit-checkbox"
              data-testid="memory-limit-checkbox"
              onChange={(_event, checked) => handleMemoryLimitToggle(checked)}
              isChecked={memoryLimitEnabled}
              label="Memory Limit"
              aria-label="Enable Memory limit"
            />
          </GridItem>
          <GridItem span={6}>
            <ResourceInputWrapper
              allowEmpty
              type="cpu"
              value={cpu.limit}
              onChange={(value) => handleChange(cpu.id, 'limit', value)}
              placeholder="e.g. 2"
              min={0}
              step={1}
              aria-label="CPU limit"
              isDisabled={!cpuLimitEnabled}
            />
          </GridItem>
          <GridItem span={6}>
            <ResourceInputWrapper
              allowEmpty
              type="memory"
              value={memory.limit}
              onChange={(value) => handleChange(memory.id, 'limit', value)}
              placeholder="e.g. 1Gi"
              min={0}
              aria-label="Memory limit"
              isDisabled={!memoryLimitEnabled}
            />
          </GridItem>
        </Grid>
        <Title headingLevel="h6">Custom Resources</Title>
        {custom.map((res) => (
          <React.Fragment key={res.id}>
            <Table borders={false} aria-label="Custom resource" className="pf-u-mb-sm">
              <Thead>
                <Tr>
                  <Th>Resource name</Th>
                  <Th screenReaderText="Delete button" />
                </Tr>
              </Thead>
              <Tbody>
                <Tr>
                  <Td>
                    <ThemeAwareFormGroupWrapper fieldId={`custom-resource-type-${res.id}`}>
                      <TextInput
                        data-testid="custom-resource-type"
                        value={res.type}
                        placeholder="Resource name (e.g. nvidia.com/gpu)"
                        aria-label="Custom resource type"
                        onChange={(_event, value) => handleChange(res.id, 'type', value)}
                      />
                    </ThemeAwareFormGroupWrapper>
                  </Td>

                  <Td dataLabel="Delete button">
                    <Button
                      variant="link"
                      isDanger
                      onClick={() => handleRemoveCustom(res.id)}
                      aria-label={`Remove ${res.type || 'custom resource'}`}
                    >
                      <TrashAltIcon />
                    </Button>
                  </Td>
                </Tr>
              </Tbody>
            </Table>
            <ThemeAwareFormGroupWrapper
              label="Limit"
              fieldId={`custom-resource-limit-${res.id}`}
              skipFieldset
              className={isMUITheme ? 'pf-v6-u-pl-sm pf-v6-u-mb-lg' : undefined}
            >
              <ResourceInputWrapper
                allowEmpty
                type="custom"
                value={res.limit}
                onChange={(value) => handleChange(res.id, 'limit', value)}
                placeholder="Limit"
                min={0}
                inputId={`custom-resource-limit-${res.id}`}
                aria-describedby={`resource-help-${res.id}`}
                aria-label={`${res.type || 'Custom resource'} limit`}
              />
            </ThemeAwareFormGroupWrapper>
            <HelperText id={`resource-help-${res.id}`} data-testid={`resource-help-${res.id}`}>
              <HelperTextItem>
                Kubernetes uses this value for both the request and limit.
              </HelperTextItem>
              {getResourceErrors(res).map((error) => (
                <HelperTextItem key={error} variant="error">
                  {error}
                </HelperTextItem>
              ))}
            </HelperText>
            <Divider />
          </React.Fragment>
        ))}
        <Button
          data-testid="add-custom-resource"
          style={{ width: 'fit-content' }}
          variant="link"
          icon={<PlusCircleIcon />}
          onClick={handleAddCustom}
          className="pf-u-mt-sm"
        >
          Add Custom Resource
        </Button>
        {resourceErrors.map((error) => (
          <HelperText key={error}>
            <HelperTextItem variant="error">{error}</HelperTextItem>
          </HelperText>
        ))}
      </div>
    </FormFieldGroupExpandable>
  );
};
