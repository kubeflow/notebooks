import { useEffect } from 'react';

export const useRedirectEditRequest = ({
  index,
  onEdit,
  onHandled,
  expand,
}: {
  index?: number;
  onEdit: (index: number) => void;
  onHandled?: () => void;
  expand: (expanded: boolean) => void;
}): void => {
  useEffect(() => {
    if (index !== undefined) {
      expand(true);
      onEdit(index);
      onHandled?.();
    }
  }, [index, onEdit, onHandled, expand]);
};
