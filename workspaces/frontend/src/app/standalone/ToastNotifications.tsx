import React, { useContext } from 'react';
import { NotificationContext } from 'mod-arch-core';
import { AlertGroup } from '@patternfly/react-core/dist/esm/components/Alert';
import ToastNotification from '~/app/standalone/ToastNotification';

const ToastNotifications: React.FC = () => {
  const { notifications } = useContext(NotificationContext);

  return (
    <AlertGroup isToast isLiveRegion>
      {notifications.map((notification) => (
        <ToastNotification notification={notification} key={notification.id} />
      ))}
    </AlertGroup>
  );
};

export default ToastNotifications;
