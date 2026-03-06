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
import { PvcsPVCListItem, StorageclassesStorageClassListItem } from '~/generated/data-contracts';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';
import {
  normalizeMountPath,
  validateMountPath,
  getMountPathUniquenessError,
} from '~/app/pages/Workspaces/Form/helpers';
import { MountPathField } from '~/app/pages/Workspaces/Form/MountPathField';

interface PVCOptionData {
  /** Display text and filter target */
  content: string;
  value: string;
  isDisabled: boolean;
  description: React.ReactNode;
  /** Explains why the PVC is unmountable, shown as a tooltip on hover */
  tooltip: string | null;
}

interface PVCGroupData {
  label: string;
  displayName: string;
  description: string;
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
  /** PVC names already mounted in the other volume section (home or data) */
  excludedPvcNames?: Set<string>;
  /** API-loaded storage classes for display name and description lookup */
  storageClasses: StorageclassesStorageClassListItem[];
}

const isRWO = (pvc: PvcsPVCListItem): boolean =>
  (pvc.pvcSpec.accessModes.includes('ReadWriteOnce') ||
    pvc.pvcSpec.accessModes.includes('ReadWriteOncePod')) &&
  !pvc.pvcSpec.accessModes.includes('ReadWriteMany');

const isInUse = (pvc: PvcsPVCListItem): boolean => pvc.pods.length > 0 || pvc.workspaces.length > 0;

const getUnmountableTooltip = (pvc: PvcsPVCListItem): string | null => {
  if (pvc.canMount) {
    return null;
  }
  const modes = pvc.pvcSpec.accessModes;
  if (modes.includes('ReadWriteOncePod') && pvc.pods.length > 0) {
    return 'This volume uses ReadWriteOncePod access and is already mounted by a pod.';
  }
  if (modes.includes('ReadWriteOnce') && pvc.workspaces.length > 0) {
    return 'This volume uses ReadWriteOnce access and is already mounted by a workspace.';
  }
  return null;
};

export const VolumesAttachModal: React.FC<VolumesAttachModalProps> = ({
  isOpen,
  setIsOpen,
  onAttach,
  availablePVCs,
  mountedPaths,
  fixedMountPath,
  excludedPvcNames,
  storageClasses,
}) => {
  // Form state
  const [selectedPvcName, setSelectedPvcName] = useState('');
  const [mountPath, setMountPath] = useState(fixedMountPath ?? '/data/');
  const [isMountPathEditing, setIsMountPathEditing] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [formError, setFormError] = useState('');

  const mountPathFormatError = isMountPathEditing ? validateMountPath(mountPath) : null;
  const mountPathUniquenessError = !mountPathFormatError
    ? getMountPathUniquenessError([...mountedPaths], mountPath)
    : null;
  const mountPathError = mountPathFormatError ?? mountPathUniquenessError;

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
      setIsMountPathEditing(false);
      setReadOnly(false);
      setFormError('');
      setIsSelectOpen(false);
      setInputValue('');
      setFilterValue('');
      setFocusedItemIndex(null);
      setActiveItemId(null);
    }
  }, [isOpen, fixedMountPath]);

  const handleStartMountPathEdit = useCallback(() => {
    setIsMountPathEditing(true);
    setFormError('');
  }, []);

  const handleConfirmMountPathEdit = useCallback(() => {
    const err =
      validateMountPath(mountPath) ?? getMountPathUniquenessError([...mountedPaths], mountPath);
    if (err) {
      return;
    }
    setIsMountPathEditing(false);
  }, [mountPath, mountedPaths]);

  const handleCancelMountPathEdit = useCallback(() => {
    if (selectedPvcName) {
      setMountPath(fixedMountPath ?? `/data/${selectedPvcName}`);
    } else {
      setMountPath(fixedMountPath ?? '/data/');
    }
    setIsMountPathEditing(false);
  }, [selectedPvcName, fixedMountPath]);

  // ── PVC option building ──────────────────────────────────────────────────

  const buildDescription = useCallback(
    (pvc: PvcsPVCListItem): React.ReactNode => {
      const isExcluded = excludedPvcNames?.has(pvc.name) ?? false;
      return (
        <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
          <FlexItem>
            <Stack style={{ width: '100%' }}>
              <StackItem>
                <LabelGroup numLabels={5}>
                  <Label isCompact className={!pvc.canMount ? 'pf-m-disabled' : undefined}>
                    {pvc.pvcSpec.requests.storage}
                  </Label>
                  {pvc.pvcSpec.accessModes.map((mode) => (
                    <Label
                      key={mode}
                      isCompact
                      className={!pvc.canMount ? 'pf-m-disabled' : undefined}
                      color="blue"
                    >
                      {mode}
                    </Label>
                  ))}
                  {isExcluded && (
                    <Label isCompact color="purple">
                      Already mounted
                    </Label>
                  )}
                  {!pvc.canMount && (
                    <Label isCompact className="pf-m-disabled">
                      Unmountable
                    </Label>
                  )}
                </LabelGroup>
              </StackItem>
              {pvc.workspaces.length > 0 && (
                <StackItem className="pf-v6-u-ml-sm pf-v6-u-mt-xs">
                  <Flex gap={{ default: 'gapXs' }}>
                    <FlexItem>Connected Workspaces:</FlexItem>
                    <FlexItem>
                      <LabelGroupWithTooltip
                        labels={pvc.workspaces.map((w) => w.name)}
                        limit={5}
                        variant="outline"
                        icon={<CubeIcon color="teal" />}
                        isCompact
                        color="teal"
                        className={!pvc.canMount ? 'pf-m-disabled' : undefined}
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
    },
    [excludedPvcNames],
  );

  // ── Grouped / filtered option data ──────────────────────────────────────

  const pvcGroups = useMemo((): PVCGroupData[] => {
    const scMap = new Map(storageClasses.map((s) => [s.name, s]));
    const grouped = new Map<
      string,
      { description: string; displayName: string; options: PVCOptionData[] }
    >();
    for (const pvc of availablePVCs) {
      const sc = pvc.pvcSpec.storageClassName || 'default';
      if (!grouped.has(sc)) {
        grouped.set(sc, {
          description: scMap.get(sc)?.description ?? '',
          displayName: scMap.get(sc)?.displayName ?? sc,
          options: [],
        });
      }
      grouped.get(sc)!.options.push({
        content: pvc.name,
        value: pvc.name,
        isDisabled: !pvc.canMount || (excludedPvcNames?.has(pvc.name) ?? false),
        description: buildDescription(pvc),
        tooltip: getUnmountableTooltip(pvc),
      });
    }
    return Array.from(grouped.entries()).map(([sc, { description, displayName, options }]) => ({
      label: displayName || sc,
      displayName,
      description,
      options: options.sort((a, b) => Number(a.isDisabled) - Number(b.isDisabled)),
    }));
  }, [availablePVCs, buildDescription, excludedPvcNames, storageClasses]);

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
      const pvcName = value;
      setSelectedPvcName(pvcName);
      setMountPath(fixedMountPath ?? `/data/${pvcName}`);
      setIsMountPathEditing(false);
      setInputValue(pvcName);
      setFilterValue('');
      setFormError('');
      closeMenu();
    },
    [closeMenu, fixedMountPath],
  );

  const handleInternalSelect = useCallback(
    (_ev: React.MouseEvent | undefined, value?: string | number) => {
      if (value === undefined) {
        return;
      }
      const opt = filteredFlatOptions.find((o) => o.value === String(value));
      if (opt?.isDisabled) {
        return;
      }
      handleSelectOption(String(value));
    },
    [handleSelectOption, filteredFlatOptions],
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
        title: 'Volume is in use with ReadWriteOnce or ReadWriteOncePod access',
        body: 'This volume uses ReadWriteOnce or ReadWriteOncePod access mode and is already mounted. Attaching it to this workspace may fail if it is scheduled on a different node.',
      };
    }
    return {
      variant: AlertVariant.warning,
      title: 'Volume is currently in use',
      body: 'This volume is already mounted by other workspaces or pods. Verify that sharing is supported.',
    };
  }, [selectedPvc]);

  // ── Attach handler ───────────────────────────────────────────────────────

  const handleAttach = useCallback(() => {
    if (!selectedPvc) {
      return;
    }
    const trimmedPath = normalizeMountPath(mountPath);
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
      aria-label="Volume typeahead menu toggle"
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
          placeholder="Select a volume"
          role="combobox"
          isExpanded={isSelectOpen}
          aria-controls="pvc-select-listbox"
          {...(activeItemId ? { 'aria-activedescendant': activeItemId } : {})}
        />
        <TextInputGroupUtilities {...(!inputValue ? { style: { display: 'none' } } : {})}>
          <Button
            variant="plain"
            onClick={handleClearButtonClick}
            aria-label="Clear volume selection"
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
      <ModalHeader title="Attach Existing Volume" labelId="volumes-attach-modal-title" />
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
              <ThemeAwareFormGroupWrapper label="Volume" fieldId="pvc-select">
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
                  maxMenuHeight="25rem"
                >
                  {filteredGroups.length > 0 ? (
                    filteredGroups.map((group, index) => (
                      <React.Fragment key={group.label}>
                        {index > 0 && <Divider />}
                        <SelectGroup
                          label={`${group.displayName ? group.displayName : group.label} ${group.description ? `- ${group.description}` : ''}`}
                        >
                          <SelectList>
                            {group.options.map((opt) => {
                              const flatIndex = filteredFlatOptions.findIndex(
                                (o) => o.value === opt.value,
                              );
                              return (
                                <SelectOption
                                  key={opt.value}
                                  value={opt.value}
                                  isDisabled={opt.isDisabled && !opt.tooltip}
                                  isAriaDisabled={opt.isDisabled && !!opt.tooltip}
                                  {...(opt.tooltip
                                    ? { tooltipProps: { content: opt.tooltip } }
                                    : {})}
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
                        {filterValue
                          ? `No volume found for "${filterValue}"`
                          : 'No volumes available'}
                      </SelectOption>
                    </SelectList>
                  )}
                </Select>
              </ThemeAwareFormGroupWrapper>
              <MountPathField
                variant="input"
                value={mountPath}
                onChange={(val) => {
                  setMountPath(val);
                  setFormError('');
                }}
                isEditing={isMountPathEditing}
                onStartEdit={handleStartMountPathEdit}
                onConfirm={handleConfirmMountPathEdit}
                onCancel={handleCancelMountPathEdit}
                error={mountPathError}
                isFixed={!!fixedMountPath}
                fieldId="pvc-mount-path"
              />
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
          isDisabled={
            !selectedPvcName || !mountPath.trim() || !!mountPathError || isMountPathEditing
          }
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
