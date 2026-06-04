import React from 'react';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';
import { NotFound } from '~/app/pages/notFound/NotFound';
import { DEV_MODE } from '~/shared/utilities/const';
import { DebugAuthSection } from './DebugAuthSection';

const Debug: React.FunctionComponent = () =>
  DEV_MODE ? (
    <>
      <PageSection data-testid="debug-page">
        <Title headingLevel="h1">Debug Settings</Title>
      </PageSection>
      <PageSection>
        <DebugAuthSection />
      </PageSection>
    </>
  ) : (
    <NotFound />
  );

export { Debug };
