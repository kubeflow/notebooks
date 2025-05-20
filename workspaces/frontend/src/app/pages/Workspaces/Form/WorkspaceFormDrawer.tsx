import React, { Ref } from 'react';
import {
  Drawer,
  DrawerPanelContent,
  DrawerContent,
  DrawerContentBody,
  DrawerHead,
  DrawerActions,
  DrawerCloseButton,
  Title,
} from '@patternfly/react-core';

interface WorkspaceFormDrawerProps {
  children: React.ReactNode;
  title: string;
  info: React.ReactNode;
  isExpanded: boolean;
  drawerRef?: Ref<HTMLSpanElement>;
  onCloseClick: () => void;
  onExpand: () => void;
}

export const WorkspaceFormDrawer: React.FC<WorkspaceFormDrawerProps> = ({
  children,
  isExpanded,
  drawerRef,
  title,
  info,
  onCloseClick,
  onExpand,
}) => {
  const panelContent = (
    <DrawerPanelContent>
      <DrawerHead>
        <span role="button" tabIndex={isExpanded ? 0 : -1} ref={drawerRef as Ref<HTMLSpanElement>}>
          <Title headingLevel="h6">{title}</Title>
        </span>
        <DrawerActions>
          <DrawerCloseButton onClick={onCloseClick} />
        </DrawerActions>
      </DrawerHead>
      {info}
    </DrawerPanelContent>
  );

  return (
    <>
      <Drawer isExpanded={isExpanded} isInline onExpand={onExpand}>
        <DrawerContent panelContent={panelContent}>
          <DrawerContentBody>{children}</DrawerContentBody>
        </DrawerContent>
      </Drawer>
    </>
  );
};
