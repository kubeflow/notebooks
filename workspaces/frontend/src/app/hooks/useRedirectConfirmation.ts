import { useCallback, useMemo, useState } from 'react';
import {
  OptionsImageConfigValue,
  OptionsPodConfigValue,
  WorkspacesRedirectStep,
} from '~/generated/data-contracts';
import {
  OptionValue,
  resolveRedirectChain,
} from '~/app/pages/Workspaces/Form/utils/resolveRedirectChain';

interface StepRedirectInfoNone {
  needsConfirmation: false;
}

interface StepRedirectInfoConfirm {
  needsConfirmation: true;
  optionType: 'image' | 'podConfig';
  selectedOption: OptionValue;
  redirectChain: WorkspacesRedirectStep[] | undefined;
  finalTarget: OptionValue | undefined;
  cycleDetected: boolean;
}

type StepRedirectInfo = StepRedirectInfoNone | StepRedirectInfoConfirm;

interface UseRedirectConfirmationParams {
  currentStep: number;
  imageStep: number;
  podConfigStep: number;
  selectedImage: OptionsImageConfigValue | undefined;
  selectedPodConfig: OptionsPodConfigValue | undefined;
  allImageOptions: OptionsImageConfigValue[];
  allPodConfigOptions: OptionsPodConfigValue[];
  onImageSelect: (image: OptionsImageConfigValue | undefined) => void;
  onPodConfigSelect: (podConfig: OptionsPodConfigValue | undefined) => void;
  onAdvanceStep: () => void;
}

interface UseRedirectConfirmationResult {
  redirectInfo: StepRedirectInfo;
  isModalOpen: boolean;
  openModal: () => void;
  handleApplyRedirect: () => void;
  handleContinueWithWarning: () => void;
  closeModal: () => void;
}

const buildRedirectInfo = (
  optionType: StepRedirectInfoConfirm['optionType'],
  selectedOption: OptionValue,
  allOptions: OptionValue[],
): StepRedirectInfoConfirm | undefined => {
  if (selectedOption.redirect) {
    const { chain, finalTarget, cycleDetected } = resolveRedirectChain(selectedOption, allOptions);
    return {
      needsConfirmation: true,
      optionType,
      selectedOption,
      redirectChain: chain,
      finalTarget,
      cycleDetected,
    };
  }
  if (selectedOption.hidden) {
    return {
      needsConfirmation: true,
      optionType,
      selectedOption,
      redirectChain: undefined,
      finalTarget: undefined,
      cycleDetected: false,
    };
  }
  return undefined;
};

const useRedirectConfirmation = ({
  currentStep,
  imageStep,
  podConfigStep,
  selectedImage,
  selectedPodConfig,
  allImageOptions,
  allPodConfigOptions,
  onImageSelect,
  onPodConfigSelect,
  onAdvanceStep,
}: UseRedirectConfirmationParams): UseRedirectConfirmationResult => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const redirectInfo = useMemo<StepRedirectInfo>(() => {
    if (currentStep === imageStep && selectedImage) {
      const result = buildRedirectInfo('image', selectedImage, allImageOptions);
      if (result) {
        return result;
      }
    }

    if (currentStep === podConfigStep && selectedPodConfig) {
      const result = buildRedirectInfo('podConfig', selectedPodConfig, allPodConfigOptions);
      if (result) {
        return result;
      }
    }

    return { needsConfirmation: false };
  }, [
    currentStep,
    imageStep,
    podConfigStep,
    selectedImage,
    selectedPodConfig,
    allImageOptions,
    allPodConfigOptions,
  ]);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const handleApplyRedirect = useCallback(() => {
    if (!redirectInfo.needsConfirmation || !redirectInfo.finalTarget) {
      return;
    }

    if (redirectInfo.optionType === 'image') {
      onImageSelect(redirectInfo.finalTarget as OptionsImageConfigValue);
    } else {
      onPodConfigSelect(redirectInfo.finalTarget as OptionsPodConfigValue);
    }

    setIsModalOpen(false);
    onAdvanceStep();
  }, [redirectInfo, onImageSelect, onPodConfigSelect, onAdvanceStep]);

  const handleContinueWithWarning = useCallback(() => {
    setIsModalOpen(false);
    onAdvanceStep();
  }, [onAdvanceStep]);

  return {
    redirectInfo,
    isModalOpen,
    openModal,
    handleApplyRedirect,
    handleContinueWithWarning,
    closeModal,
  };
};

export { useRedirectConfirmation };
export type { StepRedirectInfo, StepRedirectInfoConfirm, StepRedirectInfoNone };
