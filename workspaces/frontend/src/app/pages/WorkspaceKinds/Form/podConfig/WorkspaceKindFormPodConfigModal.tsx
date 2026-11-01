import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { WorkspaceKindPodConfigValue } from '~/app/types';
import { EditableRowsTable, KeyValueRow } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import {
  getResources,
  validateOptionId,
  validateOptionDisplayName,
} from '~/app/pages/WorkspaceKinds/Form/helpers';
import { OptionsOptionLabel } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { WorkspaceKindFormResource, PodResourceEntry } from './WorkspaceKindFormResource';
import { getResourceErrors, requiresMatchingResources } from './resourceValidation';

const getEditableResources = (config: WorkspaceKindPodConfigValue): PodResourceEntry[] =>
  getResources(config).map((resource) =>
    requiresMatchingResources(resource.type)
      ? { ...resource, request: '', limit: resource.limit || resource.request }
      : resource,
  );

interface WorkspaceKindFormPodConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (podConfig: WorkspaceKindPodConfigValue) => void;
  editIndex: number | null;
  currConfig: WorkspaceKindPodConfigValue;
  setCurrConfig: (currConfig: WorkspaceKindPodConfigValue) => void;
  existingIds?: string[];
}

export const WorkspaceKindFormPodConfigModal: React.FC<WorkspaceKindFormPodConfigModalProps> = (
  props,
) => (
  <WorkspaceKindFormPodConfigModalContent
    key={`${props.isOpen}-${props.editIndex}-${props.currConfig.id}`}
    {...props}
  />
);

const WorkspaceKindFormPodConfigModalContent: React.FC<WorkspaceKindFormPodConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editIndex,
  currConfig,
  setCurrConfig,
  existingIds = [],
}) => {
  const initialResources = useMemo(() => getEditableResources(currConfig), [currConfig]);

  const [resources, setResources] = useState<PodResourceEntry[]>(initialResources);
  const [labels, setLabels] = useState<OptionsOptionLabel[]>(currConfig.labels ?? []);
  const [nodeSelectors, setNodeSelectors] = useState<KeyValueRow[]>(
    Object.entries(currConfig.nodeSelector ?? {}).map(([key, value]) => ({ key, value })),
  );
  const [id, setId] = useState(currConfig.id);
  const [displayName, setDisplayName] = useState(currConfig.displayName);
  const [description, setDescription] = useState(currConfig.description);
  const [hidden, setHidden] = useState<boolean>(currConfig.hidden || false);
  const [isIdTouched, setIsIdTouched] = useState(false);
  const [isDisplayNameTouched, setIsDisplayNameTouched] = useState(false);
  const initialIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      initialIdRef.current = editIndex !== null ? currConfig.id : undefined;
      setIsIdTouched(editIndex !== null);
      setIsDisplayNameTouched(editIndex !== null);
    } else {
      setIsIdTouched(false);
      setIsDisplayNameTouched(false);
    }
  }, [isOpen, editIndex, currConfig.id]);

  useEffect(() => {
    setResources(getEditableResources(currConfig));
    setId(currConfig.id);
    setDisplayName(currConfig.displayName);
    setDescription(currConfig.description);
    setHidden(currConfig.hidden || false);
    setLabels(currConfig.labels ?? []);
    setNodeSelectors(
      Object.entries(currConfig.nodeSelector ?? {}).map(([key, value]) => ({ key, value })),
    );
  }, [currConfig, isOpen, editIndex]);

  const idError =
    isIdTouched || id.length > 0 ? validateOptionId(id, existingIds, initialIdRef.current) : null;

  const displayNameError =
    isDisplayNameTouched || displayName.length > 0 ? validateOptionDisplayName(displayName) : null;

  const isFormValid =
    !idError && !displayNameError && id.trim().length > 0 && displayName.trim().length > 0;

  // merge resource entries to k8s resources type
  // resources: {requests: {}, limits: {}}
  const mergeResourceLabels = useCallback((resourceEntries: PodResourceEntry[]) => {
    const parsedResources = resourceEntries.reduce(
      (acc, r) => {
        if (r.type.length) {
          if (r.limit.length) {
            acc.limits[r.type] = r.limit;
          }
          if (r.request.length && !requiresMatchingResources(r.type)) {
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

  const hasResourceErrors = resources.some((resource) => getResourceErrors(resource).length > 0);

  const handleSubmit = useCallback(() => {
    if (hasResourceErrors || !isFormValid) {
      return;
    }
    const updatedConfig = {
      ...currConfig,
      id,
      displayName,
      description,
      hidden,
      resources: mergeResourceLabels(resources),
      labels,
      nodeSelector: Object.fromEntries(
        nodeSelectors.filter((ns) => ns.key.length > 0).map(({ key, value }) => [key, value]),
      ),
    };
    setCurrConfig(updatedConfig);
    onSubmit(updatedConfig);
  }, [
    currConfig,
    hasResourceErrors,
    isFormValid,
    description,
    displayName,
    hidden,
    id,
    labels,
    mergeResourceLabels,
    nodeSelectors,
    onSubmit,
    resources,
    setCurrConfig,
  ]);

  const cpuResource: PodResourceEntry = useMemo(
    () =>
      resources.find((r) => r.type === 'cpu') || {
        id: 'cpu-resource',
        type: 'cpu',
        request: '',
        limit: '',
      },
    [resources],
  );

  const memoryResource: PodResourceEntry = useMemo(
    () =>
      resources.find((r) => r.type === 'memory') || {
        id: 'memory-resource',
        type: 'memory',
        request: '',
        limit: '',
      },
    [resources],
  );

  const customResources: PodResourceEntry[] = useMemo(
    () => resources.filter((r) => r.type !== 'cpu' && r.type !== 'memory'),
    [resources],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} variant="large" data-testid="pod-config-modal">
      <ModalHeader
        title={
          <span data-testid="pod-config-modal-title">
            {editIndex === null ? 'Create A Pod Configuration' : 'Edit Pod Configuration'}
          </span>
        }
        labelId="pod-config-modal-title"
        description={editIndex === null ? 'Add a pod configuration to your Workspace Kind' : ''}
      />
      <ModalBody>
        <Form>
          <ThemeAwareFormGroupWrapper
            label="ID"
            isRequired
            fieldId="workspace-kind-pod-config-id"
            hasError={!!idError}
            helperTextNode={
              idError ? (
                <HelperText>
                  <HelperTextItem variant="error" data-testid="pod-config-id-error">
                    {idError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              isRequired
              type="text"
              value={id}
              onChange={(_, value) => {
                setIsIdTouched(true);
                setId(value);
              }}
              onBlur={() => setIsIdTouched(true)}
              id="workspace-kind-pod-config-id"
              data-testid="workspace-kind-pod-config-id-input"
              validated={idError ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Display Name"
            isRequired
            fieldId="workspace-kind-pod-config-name"
            hasError={!!displayNameError}
            helperTextNode={
              displayNameError ? (
                <HelperText>
                  <HelperTextItem variant="error" data-testid="pod-config-name-error">
                    {displayNameError}
                  </HelperTextItem>
                </HelperText>
              ) : null
            }
          >
            <TextInput
              isRequired
              type="text"
              value={displayName}
              onChange={(_, value) => {
                setIsDisplayNameTouched(true);
                setDisplayName(value);
              }}
              onBlur={() => setIsDisplayNameTouched(true)}
              id="workspace-kind-pod-config-name"
              data-testid="workspace-kind-pod-config-name-input"
              validated={displayNameError ? 'error' : 'default'}
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Description"
            fieldId="workspace-kind-pod-config-description"
          >
            <TextInput
              type="text"
              value={description}
              onChange={(_, value) => setDescription(value)}
              id="workspace-kind-pod-config-description"
              data-testid="workspace-kind-pod-config-description-input"
            />
          </ThemeAwareFormGroupWrapper>
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
                  <HelperText>Hide this Pod Config from users</HelperText>
                </div>
              }
              aria-label="pod config hidden controlled check"
              onChange={() => setHidden(!hidden)}
              id="workspace-kind-pod-config-hidden"
              name="check5"
            />
          </FormGroup>
          <EditableRowsTable rows={labels} setRows={(newLabels) => setLabels(newLabels)} />
          <EditableRowsTable
            rows={nodeSelectors}
            setRows={setNodeSelectors}
            title="Node Selector"
            description="Node selector constraints for pod scheduling. Key/value pairs that must match node labels."
            buttonLabel="selector"
          />
          <WorkspaceKindFormResource
            setResources={setResources}
            cpu={cpuResource}
            memory={memoryResource}
            custom={customResources}
          />
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="confirm"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={hasResourceErrors || !isFormValid}
          data-testid="pod-config-modal-submit-button"
        >
          {editIndex !== null ? 'Save' : 'Create'}
        </Button>
        <Button
          key="cancel"
          variant="link"
          onClick={onClose}
          data-testid="pod-config-modal-cancel-button"
        >
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
