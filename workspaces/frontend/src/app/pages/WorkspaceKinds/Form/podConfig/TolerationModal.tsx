import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Form } from '@patternfly/react-core/dist/esm/components/Form';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { Radio } from '@patternfly/react-core/dist/esm/components/Radio';
import {
  Select,
  SelectList,
  SelectOption,
} from '@patternfly/react-core/dist/esm/components/Select';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { TolerationEffect, TolerationEntry, TolerationOperator } from '~/app/types';
import { emptyToleration, generateUniqueId } from '~/app/pages/WorkspaceKinds/Form/helpers';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';

const OPERATOR_OPTIONS = [
  { value: TolerationOperator.None, label: 'None', description: undefined },
  {
    value: TolerationOperator.Equal,
    label: 'Equal',
    description:
      'A toleration "matches" a taint if the keys are the same, the effects are the same, and the values are equal.',
  },
  {
    value: TolerationOperator.Exists,
    label: 'Exists',
    description:
      'A toleration "matches" a taint if the keys are the same and the effects are the same. No value should be specified.',
  },
] as const;

const EFFECT_OPTIONS = [
  { value: TolerationEffect.None, label: 'None', description: undefined },
  {
    value: TolerationEffect.NoSchedule,
    label: 'NoSchedule',
    description: 'Prevents scheduling of new pods on the node with the matching taint.',
  },
  {
    value: TolerationEffect.PreferNoSchedule,
    label: 'PreferNoSchedule',
    description: 'Scheduler will try to avoid placing a pod on the node but it is not guaranteed.',
  },
  {
    value: TolerationEffect.NoExecute,
    label: 'NoExecute',
    description: 'Pods will be evicted from the node if they do not tolerate the taint.',
  },
] as const;

interface TolerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (toleration: TolerationEntry) => void;
  existingToleration: TolerationEntry | null;
}

export const TolerationModal: React.FC<TolerationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingToleration,
}) => {
  const [operator, setOperator] = useState<TolerationOperator>(TolerationOperator.None);
  const [effect, setEffect] = useState<TolerationEffect>(TolerationEffect.None);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isForever, setIsForever] = useState(true);
  const [tolerationSeconds, setTolerationSeconds] = useState<number>(0);
  const [isOperatorOpen, setIsOperatorOpen] = useState(false);
  const [isEffectOpen, setIsEffectOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingToleration) {
        setOperator(existingToleration.operator);
        setEffect(existingToleration.effect);
        setKey(existingToleration.key);
        setValue(existingToleration.value);
        setIsForever(existingToleration.tolerationSeconds === null);
        setTolerationSeconds(existingToleration.tolerationSeconds ?? 0);
      } else {
        const empty = emptyToleration();
        setOperator(empty.operator);
        setEffect(empty.effect);
        setKey(empty.key);
        setValue(empty.value);
        setIsForever(true);
        setTolerationSeconds(0);
      }
      setIsOperatorOpen(false);
      setIsEffectOpen(false);
    }
  }, [isOpen, existingToleration]);

  const handleSubmit = useCallback(() => {
    const toleration: TolerationEntry = {
      id: existingToleration?.id ?? generateUniqueId(),
      operator,
      effect,
      key,
      value: operator === TolerationOperator.Exists ? '' : value,
      tolerationSeconds:
        effect === TolerationEffect.NoExecute && !isForever ? tolerationSeconds : null,
    };
    onSubmit(toleration);
  }, [existingToleration, operator, effect, key, value, isForever, tolerationSeconds, onSubmit]);

  const operatorLabel = OPERATOR_OPTIONS.find((o) => o.value === operator)?.label ?? 'None';
  const effectLabel = EFFECT_OPTIONS.find((o) => o.value === effect)?.label ?? 'None';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      variant="large"
      data-testid="toleration-modal"
      aria-labelledby="toleration-modal-title"
    >
      <ModalHeader
        title={existingToleration ? 'Edit Toleration' : 'Add Toleration'}
        labelId="toleration-modal-title"
      />
      <ModalBody>
        <Form>
          <ThemeAwareFormGroupWrapper label="Operator" fieldId="toleration-operator">
            <Select
              id="toleration-operator"
              isOpen={isOperatorOpen}
              selected={operator}
              onSelect={(_ev, val) => {
                setOperator(val as TolerationOperator);
                setIsOperatorOpen(false);
              }}
              onOpenChange={setIsOperatorOpen}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsOperatorOpen((prev) => !prev)}
                  isExpanded={isOperatorOpen}
                  isFullWidth
                  data-testid="toleration-operator-select"
                >
                  {operatorLabel}
                </MenuToggle>
              )}
            >
              <SelectList>
                {OPERATOR_OPTIONS.map((opt) => (
                  <SelectOption
                    key={opt.value}
                    value={opt.value}
                    description={opt.description}
                    data-testid={`toleration-operator-option-${opt.label}`}
                  >
                    {opt.label}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ThemeAwareFormGroupWrapper>

          <ThemeAwareFormGroupWrapper label="Effect" fieldId="toleration-effect">
            <Select
              id="toleration-effect"
              isOpen={isEffectOpen}
              selected={effect}
              onSelect={(_ev, val) => {
                setEffect(val as TolerationEffect);
                setIsEffectOpen(false);
              }}
              onOpenChange={setIsEffectOpen}
              toggle={(toggleRef) => (
                <MenuToggle
                  ref={toggleRef}
                  onClick={() => setIsEffectOpen((prev) => !prev)}
                  isExpanded={isEffectOpen}
                  isFullWidth
                  data-testid="toleration-effect-select"
                >
                  {effectLabel}
                </MenuToggle>
              )}
            >
              <SelectList>
                {EFFECT_OPTIONS.map((opt) => (
                  <SelectOption
                    key={opt.value}
                    value={opt.value}
                    description={opt.description}
                    data-testid={`toleration-effect-option-${opt.label}`}
                  >
                    {opt.label}
                  </SelectOption>
                ))}
              </SelectList>
            </Select>
          </ThemeAwareFormGroupWrapper>

          <ThemeAwareFormGroupWrapper label="Key" isRequired fieldId="toleration-key">
            <TextInput
              id="toleration-key"
              data-testid="toleration-key-input"
              isRequired
              type="text"
              value={key}
              onChange={(_, val) => setKey(val)}
            />
          </ThemeAwareFormGroupWrapper>

          <ThemeAwareFormGroupWrapper label="Value" fieldId="toleration-value">
            <TextInput
              id="toleration-value"
              data-testid="toleration-value-input"
              type="text"
              value={operator === TolerationOperator.Exists ? '' : value}
              onChange={(_, val) => setValue(val)}
              isDisabled={operator === TolerationOperator.Exists}
            />
          </ThemeAwareFormGroupWrapper>

          {effect === TolerationEffect.NoExecute && (
            <ThemeAwareFormGroupWrapper
              label="Toleration Seconds"
              fieldId="toleration-seconds"
              role="radiogroup"
              skipFieldset
              labelHelp={
                <Popover
                  headerContent="Toleration seconds"
                  bodyContent="Toleration seconds specifies how long a pod can remain bound to a node before being evicted."
                >
                  <OutlinedQuestionCircleIcon />
                </Popover>
              }
            >
              <Flex spaceItems={{ default: 'spaceItemsSm' }}>
                <FlexItem>
                  <Radio
                    id="toleration-seconds-forever"
                    data-testid="toleration-seconds-forever"
                    name="toleration-seconds-type"
                    label="Forever"
                    isChecked={isForever}
                    onChange={() => {
                      setIsForever(true);
                      setTolerationSeconds(0);
                    }}
                  />
                </FlexItem>
                <FlexItem>
                  <Radio
                    id="toleration-seconds-custom"
                    data-testid="toleration-seconds-custom"
                    name="toleration-seconds-type"
                    label="Custom value (in seconds)"
                    isChecked={!isForever}
                    onChange={() => {
                      setIsForever(false);
                    }}
                  />
                </FlexItem>
              </Flex>
              {!isForever && (
                <ResourceInputWrapper
                  type="custom"
                  value={String(tolerationSeconds)}
                  onChange={(v) => setTolerationSeconds(parseInt(v, 10) || 0)}
                  min={0}
                  aria-label="toleration-seconds-input"
                />
              )}
            </ThemeAwareFormGroupWrapper>
          )}
        </Form>
      </ModalBody>
      <ModalFooter>
        <Button
          variant="primary"
          onClick={handleSubmit}
          isDisabled={!key}
          data-testid="toleration-modal-submit-button"
        >
          {existingToleration ? 'Save' : 'Add'}
        </Button>
        <Button variant="link" onClick={onClose} data-testid="toleration-modal-cancel-button">
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
