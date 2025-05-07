import * as React from 'react';
import '@patternfly/react-core/dist/styles/base.css';
import './app.css';
import {
  Brand,
  Flex,
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  Page,
  PageToggleButton,
  Title,
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import NamespaceSelector from '~/shared/components/NamespaceSelector';
import logoDarkTheme from '~/images/logo-dark-theme.svg';
import { NamespaceContextProvider } from './context/NamespaceContextProvider';
import AppRoutes from './AppRoutes';
import NavSidebar from './NavSidebar';
import { NotebookContextProvider } from './context/NotebookContext';
import { isMUITheme, Theme } from './const';

const App: React.FC = () => {
  React.useEffect(() => {
    // Apply the theme based on the value of STYLE_THEME
    if (isMUITheme()) {
      document.documentElement.classList.add(Theme.MUI);
    } else {
      document.documentElement.classList.remove(Theme.MUI);
    }
  }, []);

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton id="page-nav-toggle" variant="plain" aria-label="Dashboard navigation">
            <BarsIcon />
          </PageToggleButton>
        </MastheadToggle>
        {!isMUITheme() ? (
          <MastheadBrand>
            <MastheadLogo component="a">
              <Brand src={logoDarkTheme} alt="Kubeflow" heights={{ default: '36px' }} />
            </MastheadLogo>
          </MastheadBrand>
        ) : (
          ''
        )}
      </MastheadMain>
      <MastheadContent>
        <Flex>
          <Title headingLevel="h2" size="3xl">
            Kubeflow Notebooks 2.0
          </Title>
          <NamespaceSelector />
        </Flex>
      </MastheadContent>
    </Masthead>
  );

  return (
    <NotebookContextProvider>
      <NamespaceContextProvider>
        <Page
          mainContainerId="primary-app-container"
          masthead={masthead}
          isContentFilled
          isManagedSidebar
          sidebar={<NavSidebar />}
        >
          <AppRoutes />
        </Page>
      </NamespaceContextProvider>
    </NotebookContextProvider>
  );
};

export default App;
