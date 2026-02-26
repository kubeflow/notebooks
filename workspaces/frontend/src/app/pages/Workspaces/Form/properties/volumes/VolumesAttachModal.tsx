import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalVariant,
} from '@patternfly/react-core/dist/esm/components/Modal';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Form, FormGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { CubeIcon } from '@patternfly/react-icons/dist/esm/icons/cube-icon';
import { TimesIcon } from '@patternfly/react-icons/dist/esm/icons/times-icon';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import {
  Select,
  SelectGroup,
  SelectList,
  SelectOption,
} from '@patternfly/react-core/dist/esm/components/Select';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import {
  TextInputGroup,
  TextInputGroupMain,
  TextInputGroupUtilities,
} from '@patternfly/react-core/dist/esm/components/TextInputGroup';
import { PvcsPVCListItem } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';

const ACCESS_MODE_GROUPS = [
  { label: 'ReadWriteMany (RWX) Storage', mode: 'ReadWriteMany', abbr: 'rwx' },
  { label: 'ReadOnlyMany (ROX) Storage', mode: 'ReadOnlyMany', abbr: 'rox' },
  { label: 'ReadWriteOnce (RWO) Storage', mode: 'ReadWriteOnce', abbr: 'rwo' },
  { label: 'ReadWriteOncePod (RWOP) Storage', mode: 'ReadWriteOncePod', abbr: 'rwop' },
] as const;

interface PVCOptionData {
  /** Display text and filter target */
  content: string;
  /** Unique per group instance: `${abbr}|${pvcName}` */
  value: string;
  isDisabled: boolean;
  description: React.ReactNode;
}

interface PVCGroupData {
  label: string;
  options: PVCOptionData[];
}

export interface VolumesAttachModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onAttach: (pvc: PvcsPVCListItem, mountPath: string, readOnly: boolean) => void;
  availablePVCs: PvcsPVCListItem[];
  /** Set of mount paths already in use across all attached volumes */
  mountedPaths: Set<string>;
  /**
   * When provided the mount path is locked to this value (sourced from the
   * workspace kind's podTemplate.volumeMounts.home) and cannot be edited.
   */
  fixedMountPath?: string;
}

const isRWO = (pvc: PvcsPVCListItem): boolean =>
  (pvc.pvcSpec.accessModes.includes('ReadWriteOnce') ||
    pvc.pvcSpec.accessModes.includes('ReadWriteOncePod')) &&
  !pvc.pvcSpec.accessModes.includes('ReadWriteMany');

const isInUse = (pvc: PvcsPVCListItem): boolean => pvc.pods.length > 0 || pvc.workspaces.length > 0;

export const VolumesAttachModal: React.FC<VolumesAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onAttach,
  availablePVCs,
  mountedPaths,
  fixedMountPath,
}) => {
  // Form state
  const [selectedPvcName, setSelectedPvcName] = useState('');
  const [mountPath, setMountPath] = useState(fixedMountPath ?? '/data/');
  const [readOnly, setReadOnly] = useState(false);
  const [formError, setFormError] = useState('');

  // Typeahead select state
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const textInputRef = useRef<HTMLInputElement>(undefined);

  useEffect(() => {
    if (isOpen) {
      setSelectedPvcName('');
      setMountPath(fixedMountPath ?? '/data/');
      setReadOnly(false);
      setFormError('');
      setIsSelectOpen(false);
      setInputValue('');
      setFilterValue('');
      setFocusedItemIndex(null);
      setActiveItemId(null);
    }
  }, [isOpen, fixedMountPath]);

  // ── PVC option building ──────────────────────────────────────────────────

  const buildDescription = useCallback((pvc: PvcsPVCListItem): React.ReactNode => {
    const inUse = isInUse(pvc);
    const rwo = isRWO(pvc);
    return (
      <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
        <FlexItem>
          <Stack style={{ width: '100%' }}>
            <StackItem>
              <LabelGroup>
                <Label isCompact>{pvc.pvcSpec.requests.storage}</Label>
                <Label isCompact variant="outline">
                  {pvc.pvcSpec.storageClassName}
                </Label>
                {pvc.pvcSpec.accessModes.map((mode) => (
                  <Label key={mode} isCompact color={mode === 'ReadWriteOnce' ? 'blue' : 'green'}>
                    {mode}
                  </Label>
                ))}
                {inUse && rwo && (
                  <Label isCompact color="red">
                    In use (RWO)
                  </Label>
                )}
                {inUse && !rwo && (
                  <Label isCompact color="orange">
                    In use
                  </Label>
                )}
                {!pvc.canMount && <Label isCompact>Unmountable</Label>}
              </LabelGroup>
            </StackItem>
            {pvc.workspaces.length > 0 && (
              <StackItem className="pf-v6-u-ml-sm pf-v6-u-mt-xs">
                <Flex gap={{ default: 'gapXs' }}>
                  <FlexItem>Workspaces:</FlexItem>
                  <FlexItem>
                    <LabelGroupWithTooltip
                      labels={pvc.workspaces.map((w) => w.name)}
                      limit={3}
                      variant="outline"
                      icon={<CubeIcon color="teal" />}
                      isCompact
                      color="teal"
                    />
                  </FlexItem>
                </Flex>
              </StackItem>
            )}
            {pvc.pods.length > 0 && (
              <StackItem className="pf-v6-u-ml-sm pf-v6-u-mt-xs">
                <Flex gap={{ default: 'gapXs' }}>
                  <FlexItem>Pods:</FlexItem>
                  <FlexItem>
                    <LabelGroupWithTooltip
                      labels={pvc.pods.map((pod) => pod.name)}
                      limit={3}
                      variant="outline"
                      isCompact
                    />
                  </FlexItem>
                </Flex>
              </StackItem>
            )}
          </Stack>
        </FlexItem>
        <FlexItem>
          <Tooltip
            aria="none"
            aria-live="polite"
            content={
              <Stack>
                <StackItem>{`Created at: ${new Date(pvc.audit.createdAt).toLocaleString()} by ${pvc.audit.createdBy}`}</StackItem>
                <StackItem>{`Updated at: ${new Date(pvc.audit.updatedAt).toLocaleString()} by ${pvc.audit.updatedBy}`}</StackItem>
              </Stack>
            }
          >
            <span style={{ cursor: 'default' }}>
              <InfoCircleIcon />
            </span>
          </Tooltip>
        </FlexItem>
      </Flex>
    );
  }, []);

  // ── Grouped / filtered option data ──────────────────────────────────────

  const pvcGroups = useMemo(
    (): PVCGroupData[] =>
      ACCESS_MODE_GROUPS.flatMap(({ label, mode, abbr }) => {
        const options = availablePVCs
          .filter((pvc) => pvc.pvcSpec.accessModes.includes(mode))
          .map(
            (pvc): PVCOptionData => ({
              content: pvc.name,
              value: `${abbr}|${pvc.name}`,
              isDisabled: !pvc.canMount,
              description: buildDescription(pvc),
            }),
          );
        return options.length > 0 ? [{ label, options }] : [];
      }),
    [availablePVCs, buildDescription],
  );

  /** Flat ordered list used for keyboard navigation and focus tracking. */
  const filteredFlatOptions = useMemo((): PVCOptionData[] => {
    const all = pvcGroups.flatMap((g) => g.options);
    if (!filterValue) {
      return all;
    }
    return all.filter((opt) => opt.content.toLowerCase().includes(filterValue.toLowerCase()));
  }, [pvcGroups, filterValue]);

  /** Groups with per-group filtering applied; empty groups are excluded. */
  const filteredGroups = useMemo((): PVCGroupData[] => {
    if (!filterValue) {
      return pvcGroups;
    }
    return pvcGroups
      .map((g) => ({
        ...g,
        options: g.options.filter((opt) =>
          opt.content.toLowerCase().includes(filterValue.toLowerCase()),
        ),
      }))
      .filter((g) => g.options.length > 0);
  }, [pvcGroups, filterValue]);

  // ── Typeahead select handlers ────────────────────────────────────────────

  const openMenu = useCallback(() => {
    setIsSelectOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsSelectOpen(false);
    setFocusedItemIndex(null);
    setActiveItemId(null);
  }, []);

  const handleSelectOption = useCallback(
    (value: string) => {
      // Values are prefixed with the group abbreviation: "rwx|pvc-name"
      const pvcName = value.includes('|') ? value.split('|').slice(1).join('|') : value;
      setSelectedPvcName(pvcName);
      setMountPath(fixedMountPath ?? `/data/${pvcName}`);
      setInputValue(pvcName);
      setFilterValue('');
      setFormError('');
      closeMenu();
    },
    [closeMenu, fixedMountPath],
  );

  const handleInternalSelect = useCallback(
    (_ev: React.MouseEvent | undefined, value?: string | number) => {
      if (value !== undefined) {
        handleSelectOption(String(value));
      }
    },
    [handleSelectOption],
  );

  const handleInputChange = useCallback(
    (_ev: React.FormEvent<HTMLInputElement>, value: string) => {
      setInputValue(value);
      setFilterValue(value);
      setFocusedItemIndex(null);
      setActiveItemId(null);
      if (!isSelectOpen) {
        openMenu();
      }
    },
    [isSelectOpen, openMenu],
  );

  const handleInputClick = useCallback(() => {
    if (!isSelectOpen) {
      openMenu();
    } else if (!inputValue) {
      closeMenu();
    }
  }, [isSelectOpen, inputValue, openMenu, closeMenu]);

  const handleToggleClick = useCallback(() => {
    setIsSelectOpen((prev) => !prev);
    textInputRef.current?.focus();
  }, []);

  const handleClearButtonClick = useCallback(() => {
    setSelectedPvcName('');
    setInputValue('');
    setFilterValue('');
    setFocusedItemIndex(null);
    setActiveItemId(null);
    textInputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const total = filteredFlatOptions.length;
      if (total === 0) {
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (isSelectOpen && focusedItemIndex !== null) {
          const focused = filteredFlatOptions[focusedItemIndex];
          if (!focused.isDisabled) {
            handleSelectOption(focused.value);
          }
        } else {
          openMenu();
        }
        return;
      }

      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return;
      }
      event.preventDefault();
      openMenu();

      let next = 0;
      if (event.key === 'ArrowUp') {
        next =
          focusedItemIndex === null || focusedItemIndex === 0 ? total - 1 : focusedItemIndex - 1;
        while (filteredFlatOptions[next].isDisabled) {
          next = next === 0 ? total - 1 : next - 1;
        }
      } else {
        next =
          focusedItemIndex === null || focusedItemIndex === total - 1 ? 0 : focusedItemIndex + 1;
        while (filteredFlatOptions[next].isDisabled) {
          next = next === total - 1 ? 0 : next + 1;
        }
      }

      setFocusedItemIndex(next);
      setActiveItemId(filteredFlatOptions[next].value);
    },
    [filteredFlatOptions, focusedItemIndex, isSelectOpen, openMenu, handleSelectOption],
  );

  // ── In-use warning alert ─────────────────────────────────────────────────

  const selectedPvc = useMemo(
    () => availablePVCs.find((p) => p.name === selectedPvcName),
    [availablePVCs, selectedPvcName],
  );

  const inUseAlert = useMemo(() => {
    if (!selectedPvc || !isInUse(selectedPvc)) {
      return null;
    }
    if (isRWO(selectedPvc)) {
      return {
        variant: AlertVariant.danger,
        title: 'PVC is in use with ReadWriteOnce or ReadWriteOncePod access',
        body: 'This PVC uses ReadWriteOnce or ReadWriteOncePod access mode and is already mounted. Attaching it to this workspace may fail if it is scheduled on a different node.',
      };
    }
    return {
      variant: AlertVariant.warning,
      title: 'PVC is currently in use',
      body: 'This PVC is already mounted by other workspaces or pods. Verify that sharing is supported.',
    };
  }, [selectedPvc]);

  // ── Attach handler ───────────────────────────────────────────────────────

  const handleAttach = useCallback(() => {
    if (!selectedPvc) {
      return;
    }
    const trimmedPath = mountPath.trim().replace(/\/+$/, '');
    if (mountedPaths.has(trimmedPath)) {
      setFormError(`Mount path "${trimmedPath}" is already in use by another volume.`);
      return;
    }
    onAttach(selectedPvc, trimmedPath, readOnly);
  }, [selectedPvc, mountPath, readOnly, mountedPaths, onAttach]);

  // ── Render ───────────────────────────────────────────────────────────────

  const toggle = (toggleRef: React.Ref<HTMLButtonElement>) => (
    <MenuToggle
      ref={toggleRef}
      variant="typeahead"
      aria-label="PVC typeahead menu toggle"
      onClick={handleToggleClick}
      isExpanded={isSelectOpen}
      isFullWidth
    >
      <TextInputGroup isPlain>
        <TextInputGroupMain
          value={inputValue}
          onClick={handleInputClick}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          innerRef={textInputRef}
          placeholder="Select a PVC"
          role="combobox"
          isExpanded={isSelectOpen}
          aria-controls="pvc-select-listbox"
          {...(activeItemId ? { 'aria-activedescendant': activeItemId } : {})}
        />
        <TextInputGroupUtilities {...(!inputValue ? { style: { display: 'none' } } : {})}>
          <Button
            variant="plain"
            onClick={handleClearButtonClick}
            aria-label="Clear PVC selection"
            icon={<TimesIcon />}
          />
        </TextInputGroupUtilities>
      </TextInputGroup>
    </MenuToggle>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      ouiaId="VolumesAttachModal"
      aria-labelledby="volumes-attach-modal-title"
      aria-describedby="volumes-attach-modal-body"
      variant={ModalVariant.large}
    >
      <ModalHeader title="Attach Existing PVC" labelId="volumes-attach-modal-title" />
      <ModalBody id="volumes-attach-modal-body">
        <Stack hasGutter>
          {formError && (
            <StackItem>
              <Alert variant={AlertVariant.danger} isInline title="Error">
                {formError}
              </Alert>
            </StackItem>
          )}
          {inUseAlert && (
            <StackItem>
              <Alert variant={inUseAlert.variant} isInline title={inUseAlert.title}>
                {inUseAlert.body}
              </Alert>
            </StackItem>
          )}
          <StackItem>
            <Form>
              <ThemeAwareFormGroupWrapper label="PVC" fieldId="pvc-select">
                <Select
                  id="pvc-select"
                  isOpen={isSelectOpen}
                  selected={selectedPvcName}
                  onSelect={handleInternalSelect}
                  onOpenChange={(open) => {
                    if (!open) {
                      closeMenu();
                    }
                  }}
                  toggle={toggle}
                  variant="typeahead"
                  isScrollable
                  maxMenuHeight="30rem"
                >
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((group, index) => (
                      <React.Fragment key={group.label}>
                        {index > 0 && <Divider />}
                        <SelectGroup label={group.label}>
                          <SelectList>
                            {group.options.map((opt) => {
                              const flatIndex = filteredFlatOptions.findIndex(
                                (o) => o.value === opt.value,
                              );
                              return (
                                <SelectOption
                                  key={opt.value}
                                  value={opt.value}
                                  isDisabled={opt.isDisabled}
                                  isFocused={focusedItemIndex === flatIndex}
                                  id={opt.value}
                                  description={opt.description}
                                >
                                  {opt.content}
                                </SelectOption>
                              );
                            })}
                          </SelectList>
                        </SelectGroup>
                      </React.Fragment>
                    ))
                  ) : (
                    <SelectList>
                      <SelectOption isAriaDisabled value="no-results">
                        {filterValue ? `No PVC found for "${filterValue}"` : 'No PVCs available'}
                      </SelectOption>
                    </SelectList>
                  )}
                </Select>
              </ThemeAwareFormGroupWrapper>
              <ThemeAwareFormGroupWrapper
                label="Mount Path"
                isRequired
                fieldId="pvc-mount-path"
                helperTextNode={
                  fixedMountPath && (
                    <HelperText>
                      <HelperTextItem variant="warning">
                        The mount path is defined by the workspace kind and cannot be changed.
                      </HelperTextItem>
                    </HelperText>
                  )
                }
              >
                <TextInput
                  name="mountPath"
                  isRequired
                  type="text"
                  id="pvc-mount-path"
                  value={mountPath}
                  isDisabled={!!fixedMountPath}
                  onChange={(_, val) => {
                    setMountPath(val);
                    setFormError('');
                  }}
                  placeholder="/data/my-volume"
                />
              </ThemeAwareFormGroupWrapper>
              <FormGroup fieldId="pvc-read-only" className="pf-v6-u-pt-sm">
                <Switch
                  id="pvc-read-only-switch"
                  label="Read-only access"
                  isChecked={readOnly}
                  onChange={(_ev, checked) => setReadOnly(checked)}
                  data-testid="pvc-read-only-switch"
                />
              </FormGroup>
            </Form>
          </StackItem>
        </Stack>
      </ModalBody>
      <ModalFooter>
        <Button
          key="attach"
          variant="primary"
          isDisabled={!selectedPvcName || !mountPath.trim()}
          onClick={handleAttach}
          data-testid="attach-pvc-button"
        >
          Attach
        </Button>
        <Button key="cancel" variant="link" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </ModalFooter>
    </Modal>
  );
};
