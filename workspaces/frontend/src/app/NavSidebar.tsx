import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Brand } from '@patternfly/react-core/dist/esm/components/Brand';
import {
  Nav,
  NavExpandable,
  NavItem,
  NavList,
} from '@patternfly/react-core/dist/esm/components/Nav';
import { PageSidebar, PageSidebarBody } from '@patternfly/react-core/dist/esm/components/Page';
import { useTypedLocation } from '~/app/routerHelper';
import { useNavData, isNavDataGroup, NavDataHref, NavDataGroup } from './AppRoutes';
import { APP_PREFIX, isMUITheme, LOGO_LIGHT } from './const';

const NavHref: React.FC<{ item: NavDataHref }> = ({ item }) => {
  const location = useTypedLocation();

  // With the redirect in place, we can now use a simple path comparison.
  const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

  return (
    <NavItem isActive={isActive} key={item.label} data-id={item.label} itemId={item.label}>
      <NavLink to={item.path} data-testid={`nav-link-${item.path}`}>
        {item.label}
      </NavLink>
    </NavItem>
  );
};

const NavGroup: React.FC<{ item: NavDataGroup }> = ({ item }) => {
  const { children } = item;
  const [expanded, setExpanded] = useState(false);

  return (
    <NavExpandable
      data-id={item.label}
      key={item.label}
      id={item.label}
      title={item.label}
      groupId={item.label}
      isExpanded={expanded}
      onExpand={(e, val) => setExpanded(val)}
      aria-label={item.label}
    >
      {children.map((childItem) => (
        <NavHref key={childItem.label} data-id={childItem.label} item={childItem} />
      ))}
    </NavExpandable>
  );
};

const NavSidebar: React.FC = () => {
  const navData = useNavData();

  return (
    <PageSidebar>
      <PageSidebarBody>
        <Nav id="nav-primary-simple">
          <NavList id="nav-list-simple">
            {isMUITheme() ? (
              <NavItem>
                <Brand
                  className="kubeflow_brand"
                  src={`${window.location.origin}${APP_PREFIX}/images/${LOGO_LIGHT}`}
                  alt="Kubeflow Logo"
                />
              </NavItem>
            ) : (
              ''
            )}
            {navData.map((item) =>
              isNavDataGroup(item) ? (
                <NavGroup key={item.label} item={item} />
              ) : (
                <NavHref key={item.label} item={item} />
              ),
            )}
          </NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );
};

export default NavSidebar;
