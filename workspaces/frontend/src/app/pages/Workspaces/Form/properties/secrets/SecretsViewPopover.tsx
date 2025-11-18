import React, { useEffect, useState } from 'react';
import { Popover } from '@patternfly/react-core/dist/esm/components/Popover';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { useNamespaceContext } from '~/app/context/NamespaceContextProvider';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { SecretsSecretUpdate } from '~/generated/data-contracts';

export interface SecretsViewPopoverProps {
  secretName: string;
}
export const SecretsViewPopover: React.FC<SecretsViewPopoverProps> = ({ secretName }) => {
  const { api } = useNotebookAPI();
  const { selectedNamespace } = useNamespaceContext();
  const [secret, setSecret] = useState<SecretsSecretUpdate | null>(null);
  useEffect(() => {
    const fetchSecret = async () => {
      const response = await api.secrets.getSecret(selectedNamespace, secretName);
      setSecret(response.data);
    };
    fetchSecret();
  }, [secretName, api.secrets, selectedNamespace]);
  const secretContentsKeys = secret ? Object.keys(secret.contents) : [];
  return (
    <Popover
      aria-label="Basic popover"
      headerContent={<div>{secretName}</div>}
      bodyContent={
        <div>
          {secretContentsKeys.map((key) => (
            <div key={key}>{key}: *********</div>
          ))}
        </div>
      }
    >
      <Button hasNoPadding isInline variant="plain" aria-label={`View ${secretName} details`}>
        <InfoCircleIcon />
      </Button>
    </Popover>
  );
};
