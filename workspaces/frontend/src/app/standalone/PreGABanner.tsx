import React from 'react';
import { Banner } from '@patternfly/react-core/dist/esm/components/Banner';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { ExclamationTriangleIcon } from '@patternfly/react-icons/dist/esm/icons/exclamation-triangle-icon';
import { HIDE_PRE_GA_BANNER, PRE_GA_LEARN_MORE_LINK } from '~/shared/utilities/const';

const PreGABanner: React.FC = () => {
  if (HIDE_PRE_GA_BANNER) {
    return null;
  }

  return (
    <Banner
      status="warning"
      isSticky
      screenReaderText="Warning: This is a pre-GA product."
      data-testid="pre-ga-warning-banner"
    >
      <Flex spaceItems={{ default: 'spaceItemsSm' }}>
        <FlexItem>
          <ExclamationTriangleIcon />
        </FlexItem>
        <FlexItem>
          This is a pre-GA product.{' '}
          <a href={PRE_GA_LEARN_MORE_LINK} target="_blank" rel="noopener noreferrer">
            Learn more
          </a>
        </FlexItem>
      </Flex>
    </Banner>
  );
};

export default PreGABanner;
