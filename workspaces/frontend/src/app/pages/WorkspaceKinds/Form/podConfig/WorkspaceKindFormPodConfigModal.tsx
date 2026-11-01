import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { HelperText } from '@patternfly/react-core/dist/esm/components/HelperText';
import { WorkspaceKindPodConfigValue } from '~/app/types';
import { EditableRowsTable, KeyValueRow } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import { getResources, getRedirectMessageError } from '~/app/pages/WorkspaceKinds/Form/helpers';
import {
  OptionsOptionLabel,
  OptionsOptionRedirect,
  OptionsRedirectMessageLevel,
} from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { WorkspaceKindFormResource, PodResourceEntry } from './WorkspaceKindFormResource';
import { getResourceErrors, requiresMatchingResources } from './resourceValidation';
import { WorkspaceKindFormPodConfigRedirect } from './WorkspaceKindFormPodConfigRedirect';

const getEditableResources = (config: WorkspaceKindPodConfigValue): PodResourceEntry[] =>
  getResources(config).map((resource) =>
    requiresMatchingResources(resource.type)
      ? { ...resource, request: '', limit: resource.limit || resource.request }
      : resource,
  );

interface WorkspaceKindFormPodConfigModalProps {
  mode?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (podConfig: WorkspaceKindPodConfigValue) => void;
  editIndex: number | null;
  currConfig: WorkspaceKindPodConfigValue;
  setCurrConfig: (currConfig: WorkspaceKindPodConfigValue) => void;
  podConfigOptions?: WorkspaceKindPodConfigValue[];
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
  mode,
  isOpen,
  onClose,
  onSubmit,
  editIndex,
  currConfig,
  setCurrConfig,
  podConfigOptions,
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
  const [redirect, setRedirect] = useState<OptionsOptionRedirect>(
    currConfig.redirect || { to: '' },
  );

  useEffect(() => {
    setResources(getEditableResources(currConfig));
    setId(currConfig.id);
    setDisplayName(currConfig.displayName);
    setDescription(currConfig.description);
    setHidden(currConfig.hidden || false);
    setRedirect(currConfig.redirect || { to: '' });
    setLabels(currConfig.labels ?? []);
    setNodeSelectors(
      Object.entries(currConfig.nodeSelector ?? {}).map(([key, value]) => ({ key, value })),
    );
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
  const redirectText = redirect.message?.text.trim() || '';
  const hasRedirectError = Boolean(getRedirectMessageError(redirect));

  const handleSubmit = useCallback(() => {
    if (hasResourceErrors || hasRedirectError) {
      return;
    }
    const finalRedirect: OptionsOptionRedirect | undefined = redirect.to
      ? {
          to: redirect.to,
          message: redirectText
            ? {
                level:
                  redirect.message?.level || OptionsRedirectMessageLevel.RedirectMessageLevelInfo,
                text: redirectText,
              }
            : undefined,
        }
      : undefined;

    const updatedConfig: WorkspaceKindPodConfigValue = {
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
      redirect: finalRedirect,
    };
    setCurrConfig(updatedConfig);
    onSubmit(updatedConfig);
  }, [
    currConfig,
    description,
    displayName,
    hasRedirectError,
    hasResourceErrors,
    hidden,
    id,
    labels,
    mergeResourceLabels,
    nodeSelectors,
    onSubmit,
    redirect.message?.level,
    redirect.to,
    redirectText,
    resources,
    setCurrConfig,
  ]);

  const candidateTargets = useMemo(
    () =>
      (podConfigOptions ?? [])
        .filter((opt) => opt.id && opt.id !== id && opt.id !== currConfig.id)
        .map((opt) => ({ id: opt.id, displayName: opt.displayName })),
    [podConfigOptions, id, currConfig.id],
  );

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
          <ThemeAwareFormGroupWrapper label="ID" isRequired fieldId="workspace-kind-pod-config-id">
            <TextInput
              isRequired
              type="text"
              value={id}
              onChange={(_, value) => setId(value)}
              id="workspace-kind-pod-config-id"
              data-testid="workspace-kind-pod-config-id-input"
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Display Name"
            isRequired
            fieldId="workspace-kind-pod-config-name"
          >
            <TextInput
              isRequired
              type="text"
              value={displayName}
              onChange={(_, value) => setDisplayName(value)}
              id="workspace-kind-pod-config-name"
              data-testid="workspace-kind-pod-config-name-input"
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
          {mode === 'edit' && (
            <WorkspaceKindFormPodConfigRedirect
              redirect={redirect}
              setRedirect={setRedirect}
              candidateTargets={candidateTargets}
            />
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          key="confirm"
          variant="primary"
          onClick={handleSubmit}
          isDisabled={hasResourceErrors || hasRedirectError}
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
