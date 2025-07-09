import React, { useCallback, useState } from 'react';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';

type ActionButtonProps = {
  action: string;
  titleOnLoading: string;
  onClick: () => Promise<void>;
} & Omit<React.ComponentProps<typeof Button>, 'onClick'>;

export const ActionButton: React.FC<ActionButtonProps> = ({
  action,
  titleOnLoading,
  onClick,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setIsLoading(true);
    try {
      await onClick();
    } finally {
      setIsLoading(false);
    }
  }, [onClick]);

  return (
    <Button
      {...props}
      spinnerAriaLabel={`Executing action '${action}'`}
      spinnerAriaValueText={action}
      onClick={handleClick}
      isLoading={isLoading}
      isDisabled={isLoading || props.isDisabled}
    >
      {isLoading ? titleOnLoading : props.children}
    </Button>
  );
};
