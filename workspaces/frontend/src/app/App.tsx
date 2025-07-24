import React, { useEffect } from 'react';
import '@patternfly/patternfly/patternfly-addons.css';
import '@patternfly/react-core/dist/styles/base.css';
import './app.css';
import { Brand } from '@patternfly/react-core/dist/esm/components/Brand';
import { Flex } from '@patternfly/react-core/dist/esm/layouts/Flex';
import {
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
} from '@patternfly/react-core/dist/esm/components/Masthead';
import { Page, PageToggleButton } from '@patternfly/react-core/dist/esm/components/Page';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import { BarsIcon } from '@patternfly/react-icons/dist/esm/icons/bars-icon';
import ErrorBoundary from '~/app/error/ErrorBoundary';
import NamespaceSelector from '~/shared/components/NamespaceSelector';
import logoDarkTheme from '~/images/logo-dark-theme.svg';
import { NamespaceContextProvider } from './context/NamespaceContextProvider';
import AppRoutes from './AppRoutes';
import NavSidebar from './NavSidebar';
import { NotebookContextProvider } from './context/NotebookContext';
import { isMUITheme, Theme } from './const';
import { BrowserStorageContextProvider } from './context/BrowserStorageContext';

const App: React.FC = () => {
  useEffect(() => {
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
    <ErrorBoundary>
      <NotebookContextProvider>
        <BrowserStorageContextProvider>
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
        </BrowserStorageContextProvider>
      </NotebookContextProvider>
    </ErrorBoundary>
  );
};

export default App;
