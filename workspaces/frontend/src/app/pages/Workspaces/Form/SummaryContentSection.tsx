import React, { FC } from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { SummaryLabels } from './SummaryLabels';

interface SummaryContentSectionProps {
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  redirectIcon?: React.ReactNode;
}

export const SummaryContentSection: FC<SummaryContentSectionProps> = ({
  displayName,
  description,
  labels,
  redirectIcon,
}) => (
  <>
    <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
      {displayName && (
        <FlexItem>
          <Content component={ContentVariants.p}>{displayName}</Content>
        </FlexItem>
      )}
      {redirectIcon && <FlexItem>{redirectIcon}</FlexItem>}
    </Flex>
    {description && <Content component={ContentVariants.small}>{description}</Content>}
    {labels && <SummaryLabels labels={labels} />}
  </>
);
