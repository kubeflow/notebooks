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
}

export const useUnsavedChangesPrompt = ({
  hasUnsavedChanges,
}: UseUnsavedChangesPromptOptions): UseUnsavedChangesPromptResult => {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const isPerformingNavigationRef = useRef(false);
  const currentUrlRef = useRef<string>('');

  const rawContext = useContext(UNSAFE_NavigationContext);
  const navigationContext = rawContext as typeof rawContext | null;
  const navigator = navigationContext?.navigator;

  useEffect(() => {
    currentUrlRef.current =
      window.location.pathname + window.location.search + window.location.hash;
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
      event.stopImmediatePropagation();
      const targetPath = window.location.pathname + window.location.search + window.location.hash;
      const fallbackUrl = currentUrlRef.current || targetPath;

      window.history.pushState(null, '', fallbackUrl);

      pendingNavigationRef.current = () => {
        isPerformingNavigationRef.current = true;
        if (navigator) {
          navigator.push(targetPath);
        } else {
          window.location.assign(targetPath);
        }
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
  };
};
