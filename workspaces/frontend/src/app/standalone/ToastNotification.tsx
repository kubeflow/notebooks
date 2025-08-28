import React, { useEffect, useState } from 'react';
import {
  Alert,
  AlertActionCloseButton,
  AlertVariant,
} from '@patternfly/react-core/dist/esm/components/Alert';
import { Notification, asEnumMember, useNotification } from 'mod-arch-core';

const TOAST_NOTIFICATION_TIMEOUT = 8 * 1000;

interface ToastNotificationProps {
  notification: Notification;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ notification }) => {
  const notifications = useNotification();
  const [timedOut, setTimedOut] = useState(false);
  const [mouseOver, setMouseOver] = useState(false);

  useEffect(() => {
    const handle = setTimeout(() => {
      setTimedOut(true);
    }, TOAST_NOTIFICATION_TIMEOUT);
    return () => {
      clearTimeout(handle);
    };
  }, [setTimedOut]);

  useEffect(() => {
    if (!notification.hidden && timedOut && !mouseOver) {
      notifications.remove(notification.id);
    }
  }, [mouseOver, notification, timedOut, notifications]);

  if (notification.hidden) {
    return null;
  }

  return (
    <Alert
      variant={asEnumMember(notification.status, AlertVariant) ?? undefined}
      title={notification.title}
      actionClose={<AlertActionCloseButton onClose={() => notifications.remove(notification.id)} />}
      onMouseEnter={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
    >
      {notification.message}
    </Alert>
  );
};

export default ToastNotification;
