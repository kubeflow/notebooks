import React, { useState } from 'react';
import { useBrowserStorage, useNotification } from 'mod-arch-core';
import { Alert, AlertVariant } from '@patternfly/react-core/dist/esm/components/Alert';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Form, ActionGroup } from '@patternfly/react-core/dist/esm/components/Form';
import { HelperText } from '@patternfly/react-core/dist/esm/components/HelperText';
import { TextInput } from '@patternfly/react-core/dist/esm/components/TextInput';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { DEV_AUTH_USER_KEY, DEV_AUTH_GROUPS_KEY } from '~/shared/utilities/devAuth';

export const DebugAuthSection: React.FC = () => {
  const notification = useNotification();

  const [user, setUser] = useBrowserStorage(DEV_AUTH_USER_KEY, 'admin', false);
  const [groups, setGroups] = useBrowserStorage(DEV_AUTH_GROUPS_KEY, '', false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const trimmedUser = user.trim();
    const trimmedGroups = groups.trim();

    if (!trimmedUser) {
      setError('User is required.');
      return;
    }

    setError(null);
    setUser(trimmedUser);
    setGroups(trimmedGroups);
    notification.success('Auth headers saved.');
  };

  return (
    <Card data-testid="debug-auth-section">
      <CardTitle>Auth Headers</CardTitle>
      <CardBody>
        <Content component="p">
          Configure the <code>kubeflow-userid</code> and <code>kubeflow-groups</code> headers sent
          with API requests during local development.
        </Content>
        {error && (
          <Alert
            variant={AlertVariant.warning}
            isInline
            title={error}
            data-testid="debug-auth-error"
          />
        )}
        <Form>
          <ThemeAwareFormGroupWrapper label="User" fieldId="debug-auth-user" isRequired>
            <TextInput
              id="debug-auth-user"
              data-testid="debug-auth-user-input"
              value={user}
              onChange={(_event, value) => {
                setUser(value);
                setError(null);
              }}
              aria-label="User ID"
            />
          </ThemeAwareFormGroupWrapper>
          <ThemeAwareFormGroupWrapper
            label="Groups"
            fieldId="debug-auth-groups"
            helperTextNode={<HelperText>Comma-separated list of group IDs.</HelperText>}
          >
            <TextInput
              id="debug-auth-groups"
              data-testid="debug-auth-groups-input"
              value={groups}
              onChange={(_event, value) => {
                setGroups(value);
              }}
              aria-label="Groups"
            />
          </ThemeAwareFormGroupWrapper>
          <ActionGroup>
            <Button variant="primary" onClick={handleSave} data-testid="debug-auth-save-button">
              Save
            </Button>
          </ActionGroup>
        </Form>
      </CardBody>
    </Card>
  );
};
