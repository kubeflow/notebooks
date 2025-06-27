import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Form,
  FormGroup,
  TextInput,
  Switch,
  HelperText,
} from '@patternfly/react-core';
import { WorkspaceKindPodConfigValue } from '~/app/types';
import { WorkspaceOptionLabel } from '~/shared/api/backendApiTypes';
import { WorkspaceKindFormLabelTable } from '~/app/pages/WorkspaceKinds/Form/WorkspaceKindFormLabels';
import {
  WorkspaceKindFormPodConfigResource,
  PodResourceEntry,
} from './WorkspaceKindFormPodConfigResource';

interface WorkspaceKindFormPodConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (podConfig: WorkspaceKindPodConfigValue) => void;
  editIndex: number | null;
  currConfig: WorkspaceKindPodConfigValue;
  setCurrConfig: (currConfig: WorkspaceKindPodConfigValue) => void;
}

// convert from k8s resource object {limits: {}, requests{}} to array of {type: '', limit: '', request: ''} for each type of resource (e.g. CPU, memory, nvidia.com/gpu)
const getResources = (currConfig: WorkspaceKindPodConfigValue): PodResourceEntry[] => {
  const grouped = new Map<string, { request: string; limit: string }>([
    ['cpu', { request: '', limit: '' }],
    ['memory', { request: '', limit: '' }],
  ]);
  const { requests = {}, limits = {} } = currConfig.resources || {};
  const types = new Set([...Object.keys(requests), ...Object.keys(limits), 'cpu', 'memory']);
  types.forEach((type) => {
    const entry = grouped.get(type) || { request: '', limit: '' };
    if (type in requests) {
      entry.request = String(requests[type]);
    }
    if (type in limits) {
      entry.limit = String(limits[type]);
    }
    grouped.set(type, entry);
  });

  // Convert to UI-types
  return Array.from(grouped.entries()).map(([type, { request, limit }]) => ({
    type,
    request,
    limit,
  }));
};

export const WorkspaceKindFormPodConfigModal: React.FC<WorkspaceKindFormPodConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editIndex,
  currConfig,
  setCurrConfig,
}) => {
  const initialResources = useMemo(() => getResources(currConfig), [currConfig]);

  const [resources, setResources] = useState<PodResourceEntry[]>(initialResources);
  const [labels, setLabels] = useState<WorkspaceOptionLabel[]>(currConfig.labels);
  const [id, setId] = useState(currConfig.id);
  const [displayName, setDisplayName] = useState(currConfig.displayName);
  const [description, setDescription] = useState(currConfig.description);
  const [hidden, setHidden] = useState<boolean>(currConfig.hidden || false);

  useEffect(() => {
    setResources(getResources(currConfig));
    setId(currConfig.id);
    setDisplayName(currConfig.displayName);
    setDescription(currConfig.description);
    setHidden(currConfig.hidden || false);
    setLabels(currConfig.labels);
  }, [currConfig, isOpen, editIndex]);

  // merge resource entries to k8s resources type
  // resources: {requests: {}, limits: {}}
  const mergeResourceLabels = useCallback((resourceEntries: PodResourceEntry[]) => {
    const parsedResources = resourceEntries.reduce(
      (acc, r) => {
        if (r.type.length) {
          if (r.limit.length) {
            acc.limits[r.type] = r.limit;
          }
          if (r.request.length) {
            acc.requests[r.type] = r.request;
          }
        }
        return acc;
      },
      { requests: {}, limits: {} } as {
        requests: { [key: string]: string };
        limits: { [key: string]: string };
      },
    );
    return parsedResources;
  }, []);

  const handleSubmit = useCallback(() => {
    const updatedConfig = {
      ...currConfig,
      id,
      displayName,
      description,
      hidden,
      resources: mergeResourceLabels(resources),
      labels,
    };
    setCurrConfig(updatedConfig);
    onSubmit(updatedConfig);
  }, [
    currConfig,
    description,
    displayName,
    hidden,
    id,
    labels,
    mergeResourceLabels,
    onSubmit,
    resources,
    setCurrConfig,
  ]);

  const cpuResource = useMemo(
    () => resources.find((r) => r.type === 'cpu') || { type: 'cpu', request: '', limit: '' },
    [resources],
  );

  const memoryResource = useMemo(
    () => resources.find((r) => r.type === 'memory') || { type: 'memory', request: '', limit: '' },
    [resources],
  );

  const customResources = useMemo(
    () => resources.filter((r) => r.type !== 'cpu' && r.type !== 'memory'),
    [resources],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="medium">
      <ModalHeader
        title={editIndex === null ? 'Create A Pod Configuration' : 'Edit Pod Configuration'}
        labelId="pod-config-modal-title"
        description={editIndex === null ? 'Add a pod configuration to your Workspace Kind' : ''}
      />
      <ModalBody>
        <Form>
          <FormGroup label="ID" isRequired fieldId="workspace-kind-pod-config-id">
            <TextInput
              isRequired
              type="text"
              value={id}
              onChange={(_, value) => setId(value)}
              id="workspace-kind-pod-config-id"
            />
          </FormGroup>
          <FormGroup label="Display Name" isRequired fieldId="workspace-kind-pod-config-name">
            <TextInput
              isRequired
              type="text"
              value={displayName}
              onChange={(_, value) => setDisplayName(value)}
              id="workspace-kind-pod-config-name"
            />
          </FormGroup>
          <FormGroup label="Description" fieldId="workspace-kind-pod-config-description">
            <TextInput
              type="text"
              value={description}
              onChange={(_, value) => setDescription(value)}
              id="workspace-kind-pod-config-description"
            />
          </FormGroup>
          <FormGroup
            isRequired
            style={{ marginTop: 'var(--mui-spacing-16px)' }}
            fieldId="workspace-kind-pod-config-hidden"
          >
            <Switch
              isChecked={hidden}
              label={
                <div>
                  <div>Hidden</div>
                  <HelperText>Hide this image from users </HelperText>
                </div>
              }
              aria-label="pod config hidden controlled check"
              onChange={() => setHidden(!hidden)}
              id="workspace-kind-pod-config-hidden"
              name="check5"
            />
          </FormGroup>
          <WorkspaceKindFormLabelTable
            rows={labels}
            setRows={(newLabels) => setLabels(newLabels)}
          />
          <WorkspaceKindFormPodConfigResource
            setResources={setResources}
            cpu={cpuResource}
            memory={memoryResource}
            custom={customResources}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button key="confirm" variant="primary" onClick={handleSubmit}>
          {editIndex !== null ? 'Save' : 'Create'}
        </Button>
        <Button key="cancel" variant="link" onClick={onClose}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
