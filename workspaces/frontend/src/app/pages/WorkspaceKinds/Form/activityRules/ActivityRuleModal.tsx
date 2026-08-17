import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Checkbox } from '@patternfly/react-core/dist/esm/components/Checkbox';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { ActivityRuleEntry } from '~/app/types';
import { EditableRowsTable, KeyValueRow } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import { emptyActivityRule } from '~/app/pages/WorkspaceKinds/Form/helpers';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';

interface ActivityRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rule: ActivityRuleEntry) => void;
  existingRule: ActivityRuleEntry | null;
}

const labelsToRows = (labels?: Record<string, string>): KeyValueRow[] =>
  labels ? Object.entries(labels).map(([key, value]) => ({ key, value })) : [];

const rowsToLabels = (rows: KeyValueRow[]): Record<string, string> | undefined => {
  const filtered = rows.filter((r) => r.key);
  if (filtered.length === 0) {
    return undefined;
  }
  return Object.fromEntries(filtered.map((r) => [r.key, r.value]));
};

export const ActivityRuleModal: React.FC<ActivityRuleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingRule,
}) => {
  const [secondsSinceActive, setSecondsSinceActive] = useState(3600);
  const [minRunningSeconds, setMinRunningSeconds] = useState(0);
  const [pauseWorkspace, setPauseWorkspace] = useState(true);
  const [namespaceLabels, setNamespaceLabels] = useState<KeyValueRow[]>([]);
  const [podConfigLabels, setPodConfigLabels] = useState<KeyValueRow[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (existingRule) {
        setSecondsSinceActive(existingRule.config.secondsSinceActive);
        setMinRunningSeconds(existingRule.config.minRunningSeconds ?? 0);
        setPauseWorkspace(existingRule.effect.pauseWorkspace);
        setNamespaceLabels(labelsToRows(existingRule.match?.matchNamespace?.selector.matchLabels));
        setPodConfigLabels(labelsToRows(existingRule.match?.matchPodConfig?.selector.matchLabels));
      } else {
        const empty = emptyActivityRule();
        setSecondsSinceActive(empty.config.secondsSinceActive);
        setMinRunningSeconds(empty.config.minRunningSeconds ?? 0);
        setPauseWorkspace(empty.effect.pauseWorkspace);
        setNamespaceLabels([]);
        setPodConfigLabels([]);
      }
    }
  }, [isOpen, existingRule]);

  const handleSubmit = useCallback(() => {
    const nsLabels = rowsToLabels(namespaceLabels);
    const pcLabels = rowsToLabels(podConfigLabels);

    const hasMatch = nsLabels || pcLabels;

    const rule: ActivityRuleEntry = {
      id: existingRule?.id ?? emptyActivityRule().id,
      config: {
        secondsSinceActive,
        minRunningSeconds: minRunningSeconds > 0 ? minRunningSeconds : undefined,
      },
      match: hasMatch
        ? {
            matchNamespace: nsLabels ? { selector: { matchLabels: nsLabels } } : undefined,
            matchPodConfig: pcLabels ? { selector: { matchLabels: pcLabels } } : undefined,
          }
        : undefined,
      effect: {
        pauseWorkspace,
      },
    };
    onSubmit(rule);
  }, [
    existingRule,
    secondsSinceActive,
    minRunningSeconds,
    pauseWorkspace,
    namespaceLabels,
    podConfigLabels,
    onSubmit,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="large"
      data-testid="activity-rule-modal"
      aria-labelledby="activity-rule-modal-title"
    >
      <ModalHeader
        title={existingRule ? 'Edit Activity Rule' : 'Create Activity Rule'}
        labelId="activity-rule-modal-title"
      />
      <ModalBody>
        <Form>
          <FormGroup label="Idle Timeout" isRequired fieldId="activity-rule-seconds-since-active">
            <ResourceInputWrapper
              value={String(secondsSinceActive)}
              type="time"
              onChange={(value) => setSecondsSinceActive(Number(value))}
              step={1}
              aria-label="seconds-since-active"
            />
            <HelperText>
              <HelperTextItem>
                How long a workspace can be inactive before the effect runs. Must be greater than 15
                seconds.
              </HelperTextItem>
            </HelperText>
          </FormGroup>

          <FormGroup label="Minimum Running Time" fieldId="activity-rule-min-running-seconds">
            <ResourceInputWrapper
              value={String(minRunningSeconds)}
              type="time"
              onChange={(value) => setMinRunningSeconds(Number(value))}
              min={0}
              step={1}
              aria-label="min-running-seconds"
            />
            <HelperText>
              <HelperTextItem>
                How long a workspace must run before this rule can apply. Prevents newly started
                workspaces from pausing right away.
              </HelperTextItem>
            </HelperText>
          </FormGroup>

          <EditableRowsTable
            title="Namespace Match Labels"
            description="Apply this rule only to workspaces in namespaces with these labels. Leave empty to apply to all namespaces."
            buttonLabel="Namespace Label"
            rows={namespaceLabels}
            setRows={setNamespaceLabels}
            addButtonTestId="add-namespace-label-button"
          />

          <EditableRowsTable
            title="Pod Config Match Labels"
            description="Apply this rule only to workspaces with these pod config labels. Leave empty to apply to all pod configs."
            buttonLabel="Pod Config Label"
            rows={podConfigLabels}
            setRows={setPodConfigLabels}
            addButtonTestId="add-pod-config-label-button"
          />

          <ThemeAwareFormGroupWrapper label="Effect" fieldId="activity-rule-effect" skipFieldset>
            <Checkbox
              id="activity-rule-pause-workspace"
              label="Pause workspace"
              description="Pause the workspace to free cluster resources. Users can resume it from the UI."
              isChecked={pauseWorkspace}
              onChange={(_, checked) => setPauseWorkspace(checked)}
              data-testid="activity-rule-pause-workspace-checkbox"
            />
          </ThemeAwareFormGroupWrapper>
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isDisabled={secondsSinceActive < 16}
          data-testid="activity-rule-modal-submit-button"
        >
          {existingRule ? 'Save' : 'Add'}
        </Button>
        <Button variant="link" onClick={onClose} data-testid="activity-rule-modal-cancel-button">
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
