import React from 'react';
import '@patternfly/patternfly/patternfly-addons.css';
import '@patternfly/react-core/dist/styles/base.css';
import '~/app/app.css';
import '~/app/theme-overrides.css';
import { Page, PageSidebar } from '@patternfly/react-core/dist/esm/components/Page';
import { DeploymentMode, logout, useModularArchContext } from 'mod-arch-core';
import ErrorBoundary from '~/app/error/ErrorBoundary';
import AppRoutes from '~/app/AppRoutes';
import { AppContext, AppContextProvider } from '~/app/context/AppContext';
import { NamespaceContextProvider } from '~/app/context/NamespaceContextProvider';
import { NotebookContextProvider } from '~/app/context/NotebookContext';
import ToastNotifications from '~/app/standalone/ToastNotifications';
import NavBar from '~/app/standalone/NavBar';
import NavSidebar from '~/app/standalone/NavSidebar';

const App: React.FC = () => {
  const { config } = useModularArchContext();
  const { deploymentMode } = config;
  const isStandalone = deploymentMode === DeploymentMode.Standalone;

  return (
    <ErrorBoundary>
      <AppContextProvider>
        <AppContext.Consumer>
          {(context) => (
            <NotebookContextProvider>
              <NamespaceContextProvider>
                <Page
                  mainContainerId="primary-app-container"
                  masthead={
                    isStandalone ? (
                      <NavBar
                        username={context?.user?.userId}
                        onLogout={() => {
                          logout().then(() => window.location.reload());
                        }}
                      />
                    ) : (
                      ''
                    )
                  }
                  isManagedSidebar={isStandalone}
                  sidebar={isStandalone ? <NavSidebar /> : <PageSidebar isSidebarOpen={false} />}
                >
                  <AppRoutes />
                  <ToastNotifications />
                </Page>
              </NamespaceContextProvider>
            </NotebookContextProvider>
          )}
        </AppContext.Consumer>
      </AppContextProvider>
    </ErrorBoundary>
  );
};

export default App;
