import React from 'react';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { useTypedNavigate } from '~/app/routerHelper';

// TODO: replace with mod-arch-shared NotFound component
// Currently, not possible because mod-arch-shared version assumes home route is '/'
const NotFound: React.FunctionComponent = () => {
  function GoHomeBtn() {
    const navigate = useTypedNavigate();

    function handleClick() {
      navigate('root');
    }

    return <Button onClick={handleClick}>Take me home</Button>;
  }

  return (
    <PageSection>
      <EmptyState titleText="404 Page not found" variant="full" icon={ExclamationTriangleIcon}>
        <EmptyStateBody>
          We did not find a page that matches the address you navigated to.
        </EmptyStateBody>
        <EmptyStateFooter>
          <GoHomeBtn />
        </EmptyStateFooter>
      </EmptyState>
    </PageSection>
  );
};

export { NotFound };
