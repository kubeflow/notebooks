import React, { FC } from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { SummaryLabels } from './SummaryLabels';

interface SummaryDiffSectionProps {
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  originalDisplayName?: string;
  originalDescription?: string;
  originalLabels?: Record<string, string>;
  redirectIcon?: React.ReactNode;
}

export const SummaryDiffSection: FC<SummaryDiffSectionProps> = ({
  displayName,
  description,
  labels,
  originalDisplayName,
  originalDescription,
  originalLabels,
  redirectIcon,
}) => (
  <>
    <StackItem>
      <Content component={ContentVariants.p}>
        <strong>NEW:</strong>
      </Content>
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        {displayName && (
          <FlexItem>
            <Content component={ContentVariants.p}>{displayName}</Content>
          </FlexItem>
        )}
        {redirectIcon && <FlexItem>{redirectIcon}</FlexItem>}
      </Flex>
      {description && <Content component={ContentVariants.small}>{description}</Content>}
      {labels && <SummaryLabels labels={labels} color="blue" />}
    </StackItem>
    <Divider />
    <StackItem>
      <Content component={ContentVariants.p}>
        <strong>CURRENT:</strong>
      </Content>
      {originalDisplayName && (
        <Content component={ContentVariants.p}>{originalDisplayName}</Content>
      )}
      {originalDescription && (
        <Content component={ContentVariants.small}>{originalDescription}</Content>
      )}
      {originalLabels && <SummaryLabels labels={originalLabels} />}
    </StackItem>
  </>
);
