/* eslint-disable camelcase */
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';

export interface UseUnsavedChangesPromptOptions {
  hasUnsavedChanges: boolean;
}

export interface UseUnsavedChangesPromptResult {
  isConfirmModalOpen: boolean;
  confirmDiscard: () => void;
  cancelDiscard: () => void;
  confirmNavigation: (onProceed: () => void) => void;
  bypassNavigation: (action: () => void) => void;
}

export const useUnsavedChangesPrompt = ({
  hasUnsavedChanges,
}: UseUnsavedChangesPromptOptions): UseUnsavedChangesPromptResult => {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const isPerformingNavigationRef = useRef(false);
  const isRevertingRef = useRef(false);
  const currentHistoryIdxRef = useRef<number>(
    typeof window.history.state?.idx === 'number' ? window.history.state.idx : 0,
  );

  const rawContext = useContext(UNSAFE_NavigationContext);
  const navigationContext = rawContext as typeof rawContext | null;
  const navigator = navigationContext?.navigator;

  useEffect(() => {
    if (!isPerformingNavigationRef.current && !isRevertingRef.current) {
      if (typeof window.history.state?.idx === 'number') {
        currentHistoryIdxRef.current = window.history.state.idx;
      }
    }
  });

  const confirmNavigation = useCallback(
    (onProceed: () => void) => {
      if (!hasUnsavedChanges) {
        onProceed();
        return;
      }
      pendingNavigationRef.current = onProceed;
      setIsConfirmModalOpen(true);
    },
    [hasUnsavedChanges],
  );

  const bypassNavigation = useCallback((action: () => void) => {
    isPerformingNavigationRef.current = true;
    action();
  }, []);

  const confirmDiscard = useCallback(() => {
    isPerformingNavigationRef.current = true;
    setIsConfirmModalOpen(false);
    if (pendingNavigationRef.current) {
      const action = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      action();
    }
  }, []);

  const cancelDiscard = useCallback(() => {
    setIsConfirmModalOpen(false);
    pendingNavigationRef.current = null;
    isPerformingNavigationRef.current = false;
  }, []);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      return undefined;
    }

    const origPush = navigator?.push;
    const origReplace = navigator?.replace;

    if (navigator && origPush && origReplace) {
      navigator.push = (...args: Parameters<typeof origPush>) => {
        if (isPerformingNavigationRef.current) {
          origPush.apply(navigator, args);
          return;
        }
        pendingNavigationRef.current = () => origPush.apply(navigator, args);
        setIsConfirmModalOpen(true);
      };

      navigator.replace = (...args: Parameters<typeof origReplace>) => {
        if (isPerformingNavigationRef.current) {
          origReplace.apply(navigator, args);
          return;
        }
        pendingNavigationRef.current = () => origReplace.apply(navigator, args);
        setIsConfirmModalOpen(true);
      };
    }

    const handlePopState = (event: PopStateEvent) => {
      if (isPerformingNavigationRef.current) {
        return;
      }
      if (isRevertingRef.current) {
        isRevertingRef.current = false;
        event.stopImmediatePropagation();
        return;
      }

      event.stopImmediatePropagation();

      const nextIdx =
        typeof window.history.state?.idx === 'number' ? window.history.state.idx : null;
      const delta =
        nextIdx !== null && nextIdx !== currentHistoryIdxRef.current
          ? nextIdx - currentHistoryIdxRef.current
          : -1;

      isRevertingRef.current = true;
      window.history.go(-delta);

      pendingNavigationRef.current = () => {
        isPerformingNavigationRef.current = true;
        window.history.go(delta);
      };
      setIsConfirmModalOpen(true);
    };

    window.addEventListener('popstate', handlePopState, true);

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isPerformingNavigationRef.current) {
        return;
      }
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (navigator && origPush && origReplace) {
        navigator.push = origPush;
        navigator.replace = origReplace;
      }
      window.removeEventListener('popstate', handlePopState, true);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges, navigator]);

  return {
    isConfirmModalOpen,
    confirmDiscard,
    cancelDiscard,
    confirmNavigation,
    bypassNavigation,
  };
};
