import React, { Dispatch, SetStateAction, useCallback, useState } from 'react';
import { Table, Thead, Tr, Th, Tbody, Td } from '@patternfly/react-table/dist/esm/components/Table';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { PencilAltIcon } from '@patternfly/react-icons/dist/esm/icons/pencil-alt-icon';
import { TrashAltIcon } from '@patternfly/react-icons/dist/esm/icons/trash-alt-icon';
import { TolerationEntry, TolerationOperator } from '~/app/types';
import { TolerationModal } from './TolerationModal';

interface WorkspaceKindFormTolerationsProps {
  tolerations: TolerationEntry[];
  setTolerations: Dispatch<SetStateAction<TolerationEntry[]>>;
  isTolerationModalOpen: boolean;
  setIsTolerationModalOpen: Dispatch<SetStateAction<boolean>>;
}

export const WorkspaceKindFormTolerations: React.FC<WorkspaceKindFormTolerationsProps> = ({
  tolerations,
  setTolerations,
  isTolerationModalOpen,
  setIsTolerationModalOpen,
}) => {
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const handleEdit = useCallback(
    (index: number) => {
      setEditIndex(index);
      setIsTolerationModalOpen(true);
    },
    [setIsTolerationModalOpen],
  );

  const handleRemove = useCallback(
    (index: number) => {
      setTolerations((prev) => prev.filter((_, i) => i !== index));
    },
    [setTolerations],
  );

  const handleModalClose = useCallback(() => {
    setIsTolerationModalOpen(false);
    setEditIndex(null);
  }, [setIsTolerationModalOpen]);

  const handleModalSubmit = useCallback(
    (toleration: TolerationEntry) => {
      if (editIndex !== null) {
        setTolerations((prev) => prev.map((t, i) => (i === editIndex ? toleration : t)));
      } else {
        setTolerations((prev) => [...prev, toleration]);
      }
      setIsTolerationModalOpen(false);
      setEditIndex(null);
    },
    [editIndex, setTolerations, setIsTolerationModalOpen],
  );

  return (
    <>
      {tolerations.length > 0 && (
        <Table aria-label="Tolerations table" data-testid="tolerations-table">
          <Thead>
            <Tr>
              <Th>Key</Th>
              <Th>Value</Th>
              <Th>Operator</Th>
              <Th>Effect</Th>
              <Th>Toleration Seconds</Th>
              <Th screenReaderText="Actions" />
            </Tr>
          </Thead>
          <Tbody>
            {tolerations.map((toleration, index) => (
              <Tr key={toleration.id} data-testid={`toleration-row-${index}`}>
                <Td dataLabel="Key" data-testid={`toleration-key-cell-${index}`}>
                  {toleration.key || '-'}
                </Td>
                <Td dataLabel="Value" data-testid={`toleration-value-cell-${index}`}>
                  {toleration.operator === TolerationOperator.Exists
                    ? '-'
                    : toleration.value || '-'}
                </Td>
                <Td dataLabel="Operator" data-testid={`toleration-operator-cell-${index}`}>
                  {toleration.operator}
                </Td>
                <Td dataLabel="Effect" data-testid={`toleration-effect-cell-${index}`}>
                  {toleration.effect || 'None'}
                </Td>
                <Td dataLabel="Toleration Seconds" data-testid={`toleration-seconds-cell-${index}`}>
                  {toleration.tolerationSeconds === null
                    ? 'Forever'
                    : `${toleration.tolerationSeconds}s`}
                </Td>
                <Td isActionCell>
                  <Flex spaceItems={{ default: 'spaceItemsXs' }} flexWrap={{ default: 'nowrap' }}>
                    <FlexItem>
                      <Button
                        onClick={() => handleEdit(index)}
                        data-testid={`toleration-edit-${index}`}
                        variant="plain"
                        aria-label="Edit toleration"
                        icon={<PencilAltIcon />}
                      />
                    </FlexItem>
                    <FlexItem>
                      <Button
                        onClick={() => handleRemove(index)}
                        data-testid={`toleration-remove-${index}`}
                        variant="plain"
                        aria-label="Remove toleration"
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
      <TolerationModal
        isOpen={isTolerationModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        existingToleration={editIndex !== null ? tolerations[editIndex] : null}
      />
    </>
  );
};
