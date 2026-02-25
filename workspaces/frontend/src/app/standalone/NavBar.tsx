import React, { useState } from 'react';
import { Brand } from '@patternfly/react-core/dist/esm/components/Brand';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
} from '@patternfly/react-core/dist/esm/components/Dropdown';
import {
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
} from '@patternfly/react-core/dist/esm/components/Masthead';
import {
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { PageToggleButton } from '@patternfly/react-core/dist/esm/components/Page';
import {
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core/dist/esm/components/Toolbar';
import { SimpleSelect } from '@patternfly/react-templates';
import { BarsIcon } from '@patternfly/react-icons/dist/esm/icons/bars-icon';
import { MoonIcon } from '@patternfly/react-icons/dist/esm/icons/moon-icon';
import { SunIcon } from '@patternfly/react-icons/dist/esm/icons/sun-icon';
import { useNamespaceSelector, useModularArchContext } from 'mod-arch-core';
import { images as sharedImages } from 'mod-arch-shared';
import { useThemeContext } from '~/app/hooks/useThemeContext';

interface NavBarProps {
  username?: string;
  onLogout: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ username, onLogout }) => {
  const { namespaces, preferredNamespace, updatePreferredNamespace } = useNamespaceSelector();
  const { config } = useModularArchContext();
  const { isMUITheme, isDarkMode, toggleDarkMode } = useThemeContext();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Check if mandatory namespace is configured
  const isMandatoryNamespace = Boolean(config.mandatoryNamespace);

  const options = namespaces.map((namespace) => ({
    content: namespace.name,
    value: namespace.name,
    selected: namespace.name === preferredNamespace?.name,
  }));

  const handleLogout = () => {
    setUserMenuOpen(false);
    onLogout();
  };

  const userMenuItems = [
    <DropdownItem key="logout" onClick={handleLogout}>
      Log out
    </DropdownItem>,
  ];

  return (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton id="page-nav-toggle" variant="plain" aria-label="Dashboard navigation">
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        {!isMUITheme ? (
          <MastheadBrand>
            <MastheadLogo component="a">
              <Brand
                src={sharedImages.logoLightThemePath}
                alt="Kubeflow"
                heights={{ default: '36px' }}
              />
            </MastheadLogo>
          </MastheadBrand>
        ) : null}
      </MastheadMain>
      <MastheadContent>
        <Toolbar>
          <ToolbarContent>
            <ToolbarGroup variant="action-group-plain" align={{ default: 'alignStart' }}>
              <ToolbarItem className="kubeflow-u-namespace-select">
                <SimpleSelect
                  initialOptions={options}
                  isDisabled={isMandatoryNamespace} // Disable selection when mandatory namespace is set
                  onSelect={(_ev, selection) => {
                    // Only allow selection if not mandatory namespace
                    if (!isMandatoryNamespace) {
                      updatePreferredNamespace({ name: String(selection) });
                    }
                  }}
                />
              </ToolbarItem>
            </ToolbarGroup>
            <ToolbarGroup variant="action-group-plain" align={{ default: 'alignEnd' }}>
              {isMUITheme && (
                <ToolbarItem>
                  <Button
                    variant="plain"
                    aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                    onClick={toggleDarkMode}
                    icon={isDarkMode ? <SunIcon /> : <MoonIcon />}
                  />
                </ToolbarItem>
              )}
              {username && (
                <ToolbarItem>
                  <Dropdown
                    popperProps={{ position: 'right' }}
                    onOpenChange={(isOpen) => setUserMenuOpen(isOpen)}
                    toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
                      <MenuToggle
                        aria-label="User menu"
                        id="user-menu-toggle"
                        data-testid="user-menu-toggle-button"
                        ref={toggleRef}
                        onClick={() => setUserMenuOpen(!userMenuOpen)}
                        isExpanded={userMenuOpen}
                      >
                        {username}
                      </MenuToggle>
                    )}
                    isOpen={userMenuOpen}
                  >
                    <DropdownList>{userMenuItems}</DropdownList>
                  </Dropdown>
                </ToolbarItem>
              )}
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );
};

export default NavBar;
