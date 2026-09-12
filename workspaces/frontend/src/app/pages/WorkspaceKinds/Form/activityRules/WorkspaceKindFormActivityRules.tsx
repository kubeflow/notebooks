import React, { useCallback, useState } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  FormFieldGroup,
  FormFieldGroupHeader,
} from '@patternfly/react-core/dist/esm/components/Form';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { HelperText } from '@patternfly/react-core/dist/esm/components/HelperText';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { PlusCircleIcon } from '@patternfly/react-icons/dist/esm/icons/plus-circle-icon';
import { ActivityRuleEntry } from '~/app/types';
import { formatSeconds } from '~/app/pages/WorkspaceKinds/Form/helpers';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';
import { ActivityRuleModal } from './ActivityRuleModal';

interface WorkspaceKindFormActivityRulesProps {
  activityRules: ActivityRuleEntry[];
  updateActivityRules: (rules: ActivityRuleEntry[]) => void;
}

const formatMatchLabels = (labels?: Record<string, string>): string | React.ReactNode[] => {
  if (!labels || Object.keys(labels).length === 0) {
    return '-';
  }
  return Object.entries(labels).map(([k, v]) => (
    <LabelGroupWithTooltip key={k} labels={[`${k}=${v}`]} limit={1} variant="outline" />
  ));
};

export const WorkspaceKindFormActivityRules: React.FC<WorkspaceKindFormActivityRulesProps> = ({
  activityRules,
  updateActivityRules,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleEdit = useCallback((index: number) => {
    setEditIndex(index);
    setIsModalOpen(true);
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      updateActivityRules(activityRules.filter((_, i) => i !== index));
    },
    [activityRules, updateActivityRules],
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditIndex(null);
  }, []);

  const handleModalSubmit = useCallback(
    (rule: ActivityRuleEntry) => {
      if (editIndex !== null) {
        updateActivityRules(activityRules.map((r, i) => (i === editIndex ? rule : r)));
      } else {
        updateActivityRules([...activityRules, rule]);
      }
      setIsModalOpen(false);
      setEditIndex(null);
    },
    [editIndex, activityRules, updateActivityRules],
  );

  return (
    <FormFieldGroup
      aria-label="Activity Rules"
      header={
        <FormFieldGroupHeader
          titleText={{
            text: 'Activity Rules',
            id: 'workspace-kind-activity-rules',
          }}
          titleDescription={
            <HelperText>
              Define rules that automatically pause idle workspaces based on inactivity thresholds.
              Rules are evaluated in order; the first matching rule applies.
            </HelperText>
          }
        />
      }
    >
      {activityRules.length > 0 && (
        <Table aria-label="Activity rules table" data-testid="activity-rules-table">
          <Thead>
            <Tr>
              <Th>Idle Timeout</Th>
              <Th>Min Running Time</Th>
              <Th>Namespace Match</Th>
              <Th>Pod Config Match</Th>
              <Th>Effect</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {activityRules.map((rule, index) => (
              <Tr key={rule.id} data-testid={`activity-rule-row-${index}`}>
                <Td dataLabel="Idle Timeout" data-testid={`activity-rule-timeout-cell-${index}`}>
                  {formatSeconds(rule.config.secondsSinceActive)}
                </Td>
                <Td
                  dataLabel="Min Running Time"
                  data-testid={`activity-rule-min-running-cell-${index}`}
                >
                  {rule.config.minRunningSeconds
                    ? formatSeconds(rule.config.minRunningSeconds)
                    : '-'}
                </Td>
                <Td
                  dataLabel="Namespace Match"
                  data-testid={`activity-rule-ns-match-cell-${index}`}
                >
                  {formatMatchLabels(rule.match?.matchNamespace?.selector.matchLabels)}
                </Td>
                <Td
                  dataLabel="Pod Config Match"
                  data-testid={`activity-rule-pc-match-cell-${index}`}
                >
                  {formatMatchLabels(rule.match?.matchPodConfig?.selector.matchLabels)}
                </Td>
                <Td dataLabel="Effect" data-testid={`activity-rule-effect-cell-${index}`}>
                  {rule.effect.pauseWorkspace ? 'Pause Workspace' : '-'}
                </Td>
                <Td isActionCell>
                  <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'nowrap' }}>
                    <FlexItem>
                      <Button
                        onClick={() => handleEdit(index)}
                        data-testid={`activity-rule-edit-${index}`}
                        variant="plain"
                        aria-label="Edit activity rule"
                        icon={<PencilAltIcon />}
                      />
                    </FlexItem>
                    <FlexItem>
                      <Button
                        onClick={() => handleRemove(index)}
                        data-testid={`activity-rule-remove-${index}`}
                        variant="plain"
                        aria-label="Remove activity rule"
                        icon={<TrashAltIcon />}
                      />
                    </FlexItem>
                  </Flex>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Button
        variant="link"
        icon={<PlusCircleIcon />}
        onClick={() => setIsModalOpen(true)}
        data-testid="add-activity-rule-button"
        style={{ width: 'fit-content' }}
      >
        Add Rule
      </Button>

      <ActivityRuleModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        existingRule={editIndex !== null ? activityRules[editIndex] : null}
      />
    </FormFieldGroup>
  );
};
