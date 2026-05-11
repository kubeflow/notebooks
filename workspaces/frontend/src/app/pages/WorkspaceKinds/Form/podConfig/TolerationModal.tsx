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
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { ExclamationCircleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-circle-icon';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { OutlinedQuestionCircleIcon } from '@patternfly/react-icons/dist/esm/icons/outlined-question-circle-icon';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { V1TaintEffect, V1TolerationOperator } from '~/generated/data-contracts';
import { TolerationEntry } from '~/app/types';
import { emptyToleration, generateUniqueId } from '~/app/pages/WorkspaceKinds/Form/helpers';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';

const OPERATOR_OPTIONS = [
  {
    value: V1TolerationOperator.TolerationOpEqual,
    label: 'Equal',
    description:
      'A toleration "matches" a taint if the keys are the same, the effects are the same, and the values are equal.',
  },
  {
    value: V1TolerationOperator.TolerationOpExists,
    label: 'Exists',
    description:
      'A toleration "matches" a taint if the keys are the same and the effects are the same. No value should be specified.',
  },
] as const;

type EffectSelectValue = V1TaintEffect | '';

const EFFECT_OPTIONS: ReadonlyArray<{
  value: EffectSelectValue;
  label: string;
  description: string;
}> = [
  {
    value: '',
    label: 'None',
    description: 'An empty effect matches all effects with key and value.',
  },
  {
    value: V1TaintEffect.TaintEffectNoSchedule,
    label: 'NoSchedule',
    description: 'Prevents scheduling of new pods on the node with the matching taint.',
  },
  {
    value: V1TaintEffect.TaintEffectPreferNoSchedule,
    label: 'PreferNoSchedule',
    description: 'Scheduler will try to avoid placing a pod on the node but it is not guaranteed.',
  },
  {
    value: V1TaintEffect.TaintEffectNoExecute,
    label: 'NoExecute',
    description: 'Pods will be evicted from the node if they do not tolerate the taint.',
  },
];

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
  const [operator, setOperator] = useState<V1TolerationOperator>(
    V1TolerationOperator.TolerationOpEqual,
  );
  const [effect, setEffect] = useState<EffectSelectValue>('');
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [isForever, setIsForever] = useState(true);
  const [tolerationSeconds, setTolerationSeconds] = useState<number>(0);
  const [isOperatorOpen, setIsOperatorOpen] = useState(false);
  const [isEffectOpen, setIsEffectOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (existingToleration) {
        setOperator(existingToleration.operator ?? V1TolerationOperator.TolerationOpEqual);
        setEffect(existingToleration.effect ?? '');
        setKey(existingToleration.key ?? '');
        setValue(existingToleration.value ?? '');
        setIsForever(existingToleration.tolerationSeconds == null);
        setTolerationSeconds(existingToleration.tolerationSeconds ?? 0);
      } else {
        const empty = emptyToleration();
        setOperator(empty.operator ?? V1TolerationOperator.TolerationOpEqual);
        setEffect(empty.effect ?? '');
        setKey(empty.key ?? '');
        setValue(empty.value ?? '');
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
      effect: effect === '' ? undefined : effect,
      key,
      value: operator === V1TolerationOperator.TolerationOpExists ? '' : value,
      tolerationSeconds:
        effect === V1TaintEffect.TaintEffectNoExecute && !isForever ? tolerationSeconds : undefined,
    };
    onSubmit(toleration);
  }, [existingToleration, operator, effect, key, value, isForever, tolerationSeconds, onSubmit]);

  const operatorLabel = OPERATOR_OPTIONS.find((o) => o.value === operator)?.label ?? 'Equal';
  const effectLabel = EFFECT_OPTIONS.find((o) => o.value === effect)?.label ?? 'NoExecute';

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
                setOperator(val as V1TolerationOperator);
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
                setEffect(val as EffectSelectValue);
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
                    key={opt.label}
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

          <ThemeAwareFormGroupWrapper
            label="Value"
            fieldId="toleration-value"
            helperTextNode={
              operator === V1TolerationOperator.TolerationOpExists ? (
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />}>
                    Value is not allowed for Exists operator.
                  </HelperTextItem>
                </HelperText>
              ) : undefined
            }
          >
            <TextInput
              id="toleration-value"
              data-testid="toleration-value-input"
              isDisabled={operator === V1TolerationOperator.TolerationOpExists} // Value is not allowed for Exists operator
              type="text"
              value={value}
              onChange={(_, val) => setValue(val)}
            />
          </ThemeAwareFormGroupWrapper>

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
            helperTextNode={
              effect !== V1TaintEffect.TaintEffectNoExecute && (
                <HelperText>
                  <HelperTextItem icon={<ExclamationCircleIcon />}>
                    Toleration seconds is only available for NoExecute effect.
                  </HelperTextItem>
                </HelperText>
              )
            }
          >
            <Flex spaceItems={{ default: 'spaceItemsSm' }}>
              <FlexItem>
                <Radio
                  id="toleration-seconds-forever"
                  data-testid="toleration-seconds-forever"
                  name="toleration-seconds-type"
                  label="Forever"
                  isChecked={effect === V1TaintEffect.TaintEffectNoExecute ? isForever : false}
                  onChange={() => {
                    setIsForever(true);
                    setTolerationSeconds(0);
                  }}
                  isDisabled={effect !== V1TaintEffect.TaintEffectNoExecute}
                />
              </FlexItem>
              <FlexItem>
                <Radio
                  id="toleration-seconds-custom"
                  data-testid="toleration-seconds-custom"
                  name="toleration-seconds-type"
                  label="Custom value (in seconds)"
                  isChecked={effect === V1TaintEffect.TaintEffectNoExecute ? !isForever : false}
                  onChange={() => {
                    setIsForever(false);
                  }}
                  isDisabled={effect !== V1TaintEffect.TaintEffectNoExecute}
                />
              </FlexItem>
            </Flex>
            {!isForever && (
              <ResourceInputWrapper
                isDisabled={effect !== V1TaintEffect.TaintEffectNoExecute}
                type="custom"
                value={String(tolerationSeconds)}
                onChange={(v) => setTolerationSeconds(parseInt(v, 10) || 0)}
                min={0}
                aria-label="toleration-seconds-input"
              />
            )}
          </ThemeAwareFormGroupWrapper>
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
