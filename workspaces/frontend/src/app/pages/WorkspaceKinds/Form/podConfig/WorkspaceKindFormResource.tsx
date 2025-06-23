import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Button,
  Grid,
  GridItem,
  Title,
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  TextInput,
  Checkbox,
  HelperText,
  HelperTextItem,
} from '@patternfly/react-core';
import { PlusCircleIcon, TrashAltIcon } from '@patternfly/react-icons';
import { generateUniqueId } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { isMemoryLimitLarger } from '~/shared/utilities/valueUnits';
import { ResourceInputWrapper } from './ResourceInputWrapper';

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
  // State for tracking limit toggles
  const [cpuRequestEnabled, setCpuRequestEnabled] = useState(cpu.request.length > 0);
  const [memoryRequestEnabled, setMemoryRequestEnabled] = useState(memory.request.length > 0);
  const [cpuLimitEnabled, setCpuLimitEnabled] = useState(cpu.limit.length > 0);
  const [memoryLimitEnabled, setMemoryLimitEnabled] = useState(memory.limit.length > 0);
  const [customLimitsEnabled, setCustomLimitsEnabled] = useState<Record<string, boolean>>(() => {
    const customToggles: Record<string, boolean> = {};
    custom.forEach((res) => {
      if (res.limit) {
        customToggles[res.id] = true;
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
      { id: generateUniqueId(), type: '', request: '1', limit: '' },
    ]);
  }, [setResources]);

  const handleRemoveCustom = useCallback(
    (resourceId: string) => {
      setResources((resources: PodResourceEntry[]) => resources.filter((r) => r.id !== resourceId));
      // Remove the corresponding limit toggle
      const newCustomLimitsEnabled = { ...customLimitsEnabled };
      delete newCustomLimitsEnabled[resourceId];
      setCustomLimitsEnabled(newCustomLimitsEnabled);
    },
    [customLimitsEnabled, setResources],
  );

  const handleCpuLimitToggle = useCallback(
    (enabled: boolean) => {
      setCpuLimitEnabled(enabled);
      handleChange(cpu.id, 'limit', cpu.request);
      if (!enabled) {
        handleChange(cpu.id, 'limit', '');
      }
    },
    [cpu.id, cpu.request, handleChange],
  );

  const handleCpuRequestToggle = useCallback(
    (enabled: boolean) => {
      setCpuRequestEnabled(enabled);
      handleChange(cpu.id, 'request', '1');
      if (!enabled) {
        handleChange(cpu.id, 'request', '');
        handleCpuLimitToggle(enabled);
      }
    },
    [cpu.id, handleChange, handleCpuLimitToggle],
  );

  const handleMemoryLimitToggle = useCallback(
    (enabled: boolean) => {
      setMemoryLimitEnabled(enabled);
      handleChange(memory.id, 'limit', memory.request);
      if (!enabled) {
        handleChange(memory.id, 'limit', '');
      }
    },
    [handleChange, memory.id, memory.request],
  );

  const handleMemoryRequestToggle = useCallback(
    (enabled: boolean) => {
      setMemoryRequestEnabled(enabled);
      handleChange(memory.id, 'request', '1Mi');
      if (!enabled) {
        handleChange(memory.id, 'request', '');
        handleMemoryLimitToggle(enabled);
      }
    },
    [handleChange, handleMemoryLimitToggle, memory.id],
  );

  const handleCustomLimitToggle = useCallback(
    (resourceId: string, enabled: boolean) => {
      setCustomLimitsEnabled((prev) => ({ ...prev, [resourceId]: enabled }));
      if (!enabled) {
        handleChange(resourceId, 'limit', '');
      }
    },
    [handleChange],
  );
  const cpuRequestLargerThanLimit = useMemo(
    () => parseFloat(cpu.request) > parseFloat(cpu.limit),
    [cpu.request, cpu.limit],
  );

  const memoryRequestLargerThanLimit = useMemo(
    () =>
      memory.request.length > 0 &&
      memory.limit.length > 0 &&
      !isMemoryLimitLarger(memory.request, memory.limit, true),
    [memory.request, memory.limit],
  );

  const requestRequestLargerThanLimit = useMemo(
    () =>
      custom.reduce(
        (prev, curr) => prev || parseFloat(curr.request) > parseFloat(curr.limit),
        false,
      ),
    [custom],
  );

  const getResourceCountText = useCallback(() => {
    const standardResourceCount = (cpu.request ? 1 : 0) + (memory.request ? 1 : 0);
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
  }, [cpu.request, memory.request, custom.length]);

  return (
    <FormFieldGroupExpandable
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
            onChange={(value) => handleChange(cpu.id, 'request', value)}
            placeholder="e.g. 1"
            min={1}
            aria-label="CPU request"
            isDisabled={!cpuRequestEnabled}
          />
        </GridItem>
        <GridItem span={6}>
          <ResourceInputWrapper
            type="memory"
            value={memory.request}
            onChange={(value) => handleChange(memory.id, 'request', value)}
            placeholder="e.g. 512Mi"
            min={1}
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
            onChange={(value) => handleChange(cpu.id, 'limit', value)}
            placeholder="e.g. 2"
            min={parseFloat(cpu.request)}
            step={1}
            aria-label="CPU limit"
            isDisabled={!cpuRequestEnabled || !cpuLimitEnabled}
          />
        </GridItem>
        <GridItem span={6}>
          <ResourceInputWrapper
            type="memory"
            value={memory.limit}
            onChange={(value) => handleChange(memory.id, 'limit', value)}
            placeholder="e.g. 1Gi"
            min={parseFloat(memory.request)}
            aria-label="Memory limit"
            isDisabled={!memoryRequestEnabled || !memoryLimitEnabled}
          />
        </GridItem>
        <GridItem span={6}>
          {cpuRequestLargerThanLimit && (
            <HelperText>
              <HelperTextItem variant="error">
                CPU limit should not be smaller than the request value
              </HelperTextItem>
            </HelperText>
          )}
        </GridItem>
        <GridItem span={6}>
          {memoryRequestLargerThanLimit && (
            <HelperText>
              <HelperTextItem variant="error">
                Memory limit should not be smaller than the request value
              </HelperTextItem>
            </HelperText>
          )}
        </GridItem>
      </Grid>
      <Title headingLevel="h6">Custom Resources</Title>
      {custom.map((res) => (
        <Grid key={res.id} hasGutter className="pf-u-mb-sm">
          <GridItem span={10} className="custom-resource-type-input">
            <TextInput
              value={res.type}
              placeholder="Resource name (e.g. nvidia.com/gpu)"
              aria-label="Custom resource type"
              onChange={(_event, value) => handleChange(res.id, 'type', value)}
            />
          </GridItem>

          <GridItem span={2}>
            <Button
              variant="link"
              isDanger
              onClick={() => handleRemoveCustom(res.id)}
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
              onChange={(value) => handleChange(res.id, 'request', value)}
              placeholder="Request"
              min={1}
              aria-label="Custom resource request"
            />
          </GridItem>
          <GridItem span={12}>
            <Checkbox
              id={`custom-limit-switch-${res.id}`}
              label="Set Limit"
              isChecked={customLimitsEnabled[res.id] || false}
              onChange={(_event, checked) => {
                handleChange(res.id, 'limit', res.request);
                handleCustomLimitToggle(res.id, checked);
              }}
              aria-label={`Enable limit for ${res.type || 'custom resource'}`}
            />
          </GridItem>
          <GridItem span={12}>
            <ResourceInputWrapper
              type="custom"
              value={res.limit}
              onChange={(value) => handleChange(res.id, 'limit', value)}
              placeholder="Limit"
              min={parseFloat(res.request)}
              isDisabled={!customLimitsEnabled[res.id]}
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
      {requestRequestLargerThanLimit && (
        <HelperText>
          <HelperTextItem variant="error">
            Resource limit should not be smaller than the request value
          </HelperTextItem>
        </HelperText>
      )}
    </FormFieldGroupExpandable>
  );
};
