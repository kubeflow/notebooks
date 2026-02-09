import React, { useCallback, useState } from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Spinner } from '@patternfly/react-core/dist/esm/components/Spinner';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { useNamespaceSelectorWrapper } from '~/app/hooks/useNamespaceSelectorWrapper';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { SecretsSecretUpdate } from '~/generated/data-contracts';

export interface SecretsViewPopoverProps {
  secretName: string;
}

export const SecretsViewPopover: React.FC<SecretsViewPopoverProps> = ({ secretName }) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceSelectorWrapper();
  const [secret, setSecret] = useState<SecretsSecretUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  // Fetch secret data when popover is shown (lazy loading)
  const handlePopoverShow = useCallback(async () => {
    // Only fetch once per mount
    if (hasFetched) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.secrets.getSecret(selectedNamespace, secretName);
      setSecret(response.data);
      setHasFetched(true);
    } catch {
      setError('Failed to load secret');
    } finally {
      setIsLoading(false);
    }
  }, [api.secrets, selectedNamespace, secretName, hasFetched]);

  const secretContentsKeys = secret ? Object.keys(secret.contents) : [];

  const renderBodyContent = () => {
    if (isLoading) {
      return <Spinner size="md" aria-label="Loading secret data" />;
    }
    if (error) {
      return <div>{error}</div>;
    }
    if (secretContentsKeys.length === 0) {
      return <div>No keys found</div>;
    }
    return (
      <div>
        {secretContentsKeys.map((key) => (
          <div key={key}>{key}: *********</div>
        ))}
      </div>
    );
  };

  return (
    <Popover
      aria-label="Secret details popover"
      headerContent={<div>{secretName}</div>}
      bodyContent={renderBodyContent()}
      onShow={handlePopoverShow}
    >
      <Button hasNoPadding isInline variant="plain" aria-label={`View ${secretName} details`}>
        <InfoCircleIcon />
      </Button>
    </Popover>
  );
};
