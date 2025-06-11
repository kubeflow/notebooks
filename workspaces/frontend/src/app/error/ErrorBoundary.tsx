import React from 'react';
import { Link } from 'react-router-dom';
import { Button, Split, SplitItem, Title } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';
import { AppRoutePaths } from '~/app/routes';
import ErrorDetails from '~/app/error/ErrorDetails';
import UpdateState from '~/app/error/UpdateState';

type ErrorBoundaryProps = {
  children?: React.ReactNode;
};

type ErrorBoundaryState =
  | { hasError: false }
  | {
      hasError: true;
      error: Error;
      errorInfo: React.ErrorInfo;
      isUpdateState: boolean;
    };

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({
      hasError: true,
      error,
      errorInfo,
      isUpdateState: error.name === 'ChunkLoadError',
    });
    // eslint-disable-next-line no-console
    console.error('Caught error:', error, errorInfo);
  }

  render(): React.ReactNode {
    const { children } = this.props;
    const { hasError } = this.state;

    if (hasError) {
      const { error, errorInfo, isUpdateState } = this.state;
      if (isUpdateState) {
        return (
          <UpdateState
            onClose={() => this.setState((prevState) => ({ ...prevState, isUpdateState: false }))}
          />
        );
      }
      return (
        <div className="pf-v6-u-p-lg" data-testid="error-boundary">
          <Split>
            <SplitItem isFilled>
              <Title headingLevel="h1" className="pf-v6-u-mb-sm">
                An error occurred
              </Title>
              <p className="pf-v6-u-mb-md">
                Try going back to the{' '}
                <Link reloadDocument to={AppRoutePaths.root}>
                  HOME PAGE
                </Link>{' '}
                or{' '}
                <Button
                  data-testid="reload-link"
                  variant="link"
                  isInline
                  onClick={() => window.location.reload()}
                >
                  reloading
                </Button>{' '}
                this page if there was a recent update.
              </p>
            </SplitItem>
            <SplitItem>
              <Button
                icon={<TimesIcon />}
                data-testid="close-error-button"
                variant="plain"
                aria-label="Close"
                onClick={() => {
                  this.setState({ hasError: false });
                }}
              />
            </SplitItem>
          </Split>
          <ErrorDetails
            title={error.name}
            errorMessage={error.message}
            componentStack={errorInfo.componentStack || ''}
            stack={error.stack}
          />
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
