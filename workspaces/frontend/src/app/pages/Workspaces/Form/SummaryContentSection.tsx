import React, { FC } from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';

interface SummaryContentSectionProps {
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  redirectIcon?: React.ReactNode;
  labelLimit?: number;
}

export const SummaryContentSection: FC<SummaryContentSectionProps> = ({
  displayName,
  description,
  labels,
  redirectIcon,
  labelLimit = 20,
}) => (
  <>
    <StackItem>
      <Flex alignItems={{ default: 'alignItemsCenter' }} spaceItems={{ default: 'spaceItemsSm' }}>
        {displayName && (
          <FlexItem>
            <Content component={ContentVariants.p}>{displayName}</Content>
          </FlexItem>
        )}
        {redirectIcon && <FlexItem>{redirectIcon}</FlexItem>}
      </Flex>
      {description && <Content component={ContentVariants.small}>{description}</Content>}
    </StackItem>
    {labels && Object.keys(labels).length > 0 && (
      <StackItem>
        <LabelGroupWithTooltip
          labels={Object.entries(labels).map(([key, value]) => `${key}: ${value}`)}
          limit={labelLimit}
          isCompact
        />
      </StackItem>
    )}
  </>
);
