import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import {
  BrowserStorageContextProvider,
  ModularArchConfig,
  ModularArchContextProvider,
  NotificationContextProvider,
} from 'mod-arch-core';
import { ThemeProvider } from 'mod-arch-kubeflow';
import App from './app/App';
import {
  DEPLOYMENT_MODE,
  URL_PREFIX,
  BFF_API_VERSION,
  STYLE_THEME,
  MANDATORY_NAMESPACE,
} from './shared/utilities/const';

const root = ReactDOM.createRoot(document.getElementById('root')!);

const modularArchConfig: ModularArchConfig = {
  deploymentMode: DEPLOYMENT_MODE,
  URL_PREFIX,
  BFF_API_VERSION,
  mandatoryNamespace: MANDATORY_NAMESPACE,
};

root.render(
  <React.StrictMode>
    <Router basename={URL_PREFIX}>
      <ModularArchContextProvider config={modularArchConfig}>
        <ThemeProvider theme={STYLE_THEME}>
          <BrowserStorageContextProvider>
            <NotificationContextProvider>
              <App />
            </NotificationContextProvider>
          </BrowserStorageContextProvider>
        </ThemeProvider>
      </ModularArchContextProvider>
    </Router>
  </React.StrictMode>,
);
