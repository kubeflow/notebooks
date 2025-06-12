import React, { useCallback, useEffect, useState } from 'react';
import {
  Button,
  Grid,
  GridItem,
  Title,
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  TextInput,
  Checkbox,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashAltIcon } from '@patternfly/react-icons';
import { ResourceInputWrapper } from './ResourceInputWrapper';

export type PodResourceEntry = {
  type: string;
  request: string;
  limit: string;
};

interface Props {
  setResources: (value: React.SetStateAction<PodResourceEntry[]>) => void;
  cpu: PodResourceEntry;
  memory: PodResourceEntry;
  custom: PodResourceEntry[];
}

export const WorkspaceKindFormPodConfigResource: React.FC<Props> = ({
  setResources,
  cpu,
  memory,
  custom,
}) => {
  // State for tracking limit toggles
  const [cpuRequestEnabled, setCpuRequestEnabled] = useState<boolean>(cpu.request.length > 0);
  const [memoryRequestEnabled, setMemoryRequestEnabled] = useState<boolean>(
    memory.request.length > 0,
  );
  const [cpuLimitEnabled, setCpuLimitEnabled] = useState<boolean>(cpu.limit.length > 0);
  const [memoryLimitEnabled, setMemoryLimitEnabled] = useState<boolean>(memory.limit.length > 0);
  const [customLimitsEnabled, setCustomLimitsEnabled] = useState<Record<number, boolean>>(() => {
    const customToggles: Record<number, boolean> = {};
    custom.forEach((res, idx) => {
      if (res.limit) {
        customToggles[idx] = true;
      }
    });
    return customToggles;
  });

  useEffect(() => {
    setCpuRequestEnabled(cpu.request.length > 0);
    setMemoryRequestEnabled(memory.request.length > 0);
    setCpuLimitEnabled(cpu.request.length > 0 && cpu.limit.length > 0);
    setMemoryLimitEnabled(memory.request.length > 0 && memory.limit.length > 0);
  }, [cpu.limit.length, cpu.request.length, memory.limit.length, memory.request.length]);

  const handleChange = useCallback(
    (type: string, field: 'type' | 'request' | 'limit', value: string) => {
      setResources((resources: PodResourceEntry[]) =>
        resources.map((r) => (r.type === type ? { ...r, [field]: value } : r)),
      );
    },
    [setResources],
  );

  const handleAddCustom = useCallback(() => {
    setResources((resources: PodResourceEntry[]) => [
      ...resources,
      { type: '', request: '', limit: '' },
    ]);
  }, [setResources]);

  const handleRemoveCustom = useCallback(
    (idx: number) => {
      setResources((resources: PodResourceEntry[]) =>
        resources.filter((r) => custom[idx].type !== r.type),
      );
      // Remove the corresponding limit toggle
      const newCustomLimitsEnabled = { ...customLimitsEnabled };
      delete newCustomLimitsEnabled[idx];
      // Reindex remaining toggles
      const reindexed: Record<number, boolean> = {};
      Object.keys(newCustomLimitsEnabled).forEach((key, newIdx) => {
        const oldIdx = parseInt(key);
        if (oldIdx > idx) {
          reindexed[newIdx] = newCustomLimitsEnabled[oldIdx];
        } else {
          reindexed[oldIdx] = newCustomLimitsEnabled[oldIdx];
        }
      });
      setCustomLimitsEnabled(reindexed);
    },
    [custom, customLimitsEnabled, setResources],
  );

  const handleCpuLimitToggle = useCallback(
    (enabled: boolean) => {
      setCpuLimitEnabled(enabled);
      if (!enabled) {
        handleChange('cpu', 'limit', '');
      }
    },
    [handleChange],
  );

  const handleCpuRequestToggle = useCallback(
    (enabled: boolean) => {
      setCpuRequestEnabled(enabled);
      if (!enabled) {
        handleChange('cpu', 'request', '');
        handleCpuLimitToggle(enabled);
      }
    },
    [handleChange, handleCpuLimitToggle],
  );

  const handleMemoryLimitToggle = useCallback(
    (enabled: boolean) => {
      setMemoryLimitEnabled(enabled);
      if (!enabled) {
        handleChange('memory', 'limit', '');
      }
    },
    [handleChange],
  );

  const handleMemoryRequestToggle = useCallback(
    (enabled: boolean) => {
      setMemoryRequestEnabled(enabled);
      if (!enabled) {
        handleChange('memory', 'request', '');
        handleMemoryLimitToggle(enabled);
      }
    },
    [handleChange, handleMemoryLimitToggle],
  );

  const handleCustomLimitToggle = useCallback(
    (idx: number, enabled: boolean) => {
      setCustomLimitsEnabled((prev) => ({ ...prev, [idx]: enabled }));
      if (!enabled) {
        const customResource = custom[idx];
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (customResource) {
          handleChange(customResource.type, 'limit', '');
        }
      }
    },
    [custom, handleChange],
  );
  return (
    <FormFieldGroupExpandable
      toggleAriaLabel="Resources"
      header={
        <FormFieldGroupHeader
          titleText={{
            text: 'Resources',
            id: 'workspace-kind-podconfig-resource',
          }}
          titleDescription={
            <p style={{ fontSize: '12px' }}>
              Optional: Configure k8s Pod Resource Requests & Limits
            </p>
          }
        />
      }
    >
      <Title headingLevel="h6">Standard Resources</Title>
      <Grid hasGutter className="pf-v6-u-mb-sm">
        <GridItem span={6}>
          <Checkbox
            id="cpu-request-checkbox"
            onChange={(_event, checked) => handleCpuRequestToggle(checked)}
            isChecked={cpuRequestEnabled}
            label="CPU Request"
          />
        </GridItem>
        <GridItem span={6}>
          <Checkbox
            id="memory-request-checkbox"
            onChange={(_event, checked) => handleMemoryRequestToggle(checked)}
            isChecked={memoryRequestEnabled}
            label="Memory Request"
          />
        </GridItem>
        <GridItem span={6}>
          <ResourceInputWrapper
            type="cpu"
            value={cpu.request}
            onChange={(value) => handleChange('cpu', 'request', value)}
            placeholder="e.g. 1"
            min={0}
            aria-label="CPU request"
            isDisabled={!cpuRequestEnabled}
          />
        </GridItem>
        <GridItem span={6}>
          <ResourceInputWrapper
            type="memory"
            value={memory.request}
            onChange={(value) => handleChange('memory', 'request', value)}
            placeholder="e.g. 512Mi"
            min={0}
            aria-label="Memory request"
            isDisabled={!memoryRequestEnabled}
          />
        </GridItem>
        <GridItem span={6}>
          <Checkbox
            id="cpu-limit-checkbox"
            onChange={(_event, checked) => handleCpuLimitToggle(checked)}
            isChecked={cpuLimitEnabled}
            label="CPU Limit"
            isDisabled={!cpuRequestEnabled}
            aria-label="Enable CPU limit"
          />
        </GridItem>
        <GridItem span={6}>
          <Checkbox
            id="memory-limit-checkbox"
            onChange={(_event, checked) => handleMemoryLimitToggle(checked)}
            isChecked={memoryLimitEnabled}
            isDisabled={!memoryRequestEnabled}
            label="Memory Limit"
            aria-label="Enable Memory limit"
          />
        </GridItem>
        <GridItem span={6}>
          <ResourceInputWrapper
            type="cpu"
            value={cpu.limit}
            onChange={(value) => handleChange('cpu', 'limit', value)}
            placeholder="e.g. 2"
            min={0}
            step={1}
            aria-label="CPU limit"
            isDisabled={!cpuRequestEnabled || !cpuLimitEnabled}
          />
        </GridItem>
        <GridItem span={6}>
          <ResourceInputWrapper
            type="memory"
            value={memory.limit}
            onChange={(value) => handleChange('memory', 'limit', value)}
            placeholder="e.g. 1Gi"
            min={0}
            aria-label="Memory limit"
            isDisabled={!memoryRequestEnabled || !memoryLimitEnabled}
          />
        </GridItem>
      </Grid>
      <Title headingLevel="h6">Custom Resources</Title>
      {custom.map((res, idx) => (
        <Grid key={idx} hasGutter className="pf-u-mb-sm">
          <GridItem span={10}>
            <TextInput
              value={res.type}
              placeholder="Resource name (e.g. nvidia.com/gpu)"
              aria-label="Custom resource type"
              onChange={(_event, value) => handleChange(res.type, 'type', value)}
            />
          </GridItem>
          <GridItem span={2}>
            <Button
              variant="link"
              isDanger
              onClick={() => handleRemoveCustom(idx)}
              aria-label={`Remove ${res.type || 'custom resource'}`}
            >
              <TrashAltIcon />
            </Button>
          </GridItem>
          <GridItem span={12}>Request</GridItem>
          <GridItem span={12}>
            <ResourceInputWrapper
              type="custom"
              value={res.request}
              onChange={(value) => handleChange(res.type, 'request', value)}
              placeholder="Request"
              min={0}
              aria-label="Custom resource request"
            />
          </GridItem>
          <GridItem span={12}>
            <Checkbox
              id={`custom-limit-switch-${idx}`}
              label="Set Limit"
              isChecked={customLimitsEnabled[idx] || false}
              onChange={(_event, checked) => handleCustomLimitToggle(idx, checked)}
              aria-label={`Enable limit for ${res.type || 'custom resource'}`}
            />
          </GridItem>
          <GridItem span={12}>
            <ResourceInputWrapper
              type="custom"
              value={res.limit}
              onChange={(value) => handleChange(res.type, 'limit', value)}
              placeholder="Limit"
              min={0}
              isDisabled={!customLimitsEnabled[idx]}
              aria-label={`${res.type || 'Custom resource'} limit`}
            />
          </GridItem>
        </Grid>
      ))}
      <Button
        style={{ width: 'fit-content' }}
        variant="link"
        icon={<PlusCircleIcon />}
        onClick={handleAddCustom}
        className="pf-u-mt-sm"
      >
        Add Custom Resource
      </Button>
    </FormFieldGroupExpandable>
  );
};
