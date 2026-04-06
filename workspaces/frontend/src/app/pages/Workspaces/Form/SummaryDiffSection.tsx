import React, { FC } from 'react';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Split, SplitItem } from '@patternfly/react-core/dist/esm/layouts/Split';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { LabelGroupWithTooltip } from '~/app/components/LabelGroupWithTooltip';

interface DiffColumnProps {
  heading: string;
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  labelColor?: 'blue';
  labelLimit?: number;
  redirectIcon?: React.ReactNode;
  'data-testid': string;
}

const DiffColumn: FC<DiffColumnProps> = ({
  heading,
  displayName,
  description,
  labels,
  labelColor,
  labelLimit = 20,
  redirectIcon,
  'data-testid': testId,
}) => (
  <SplitItem isFilled style={{ flexBasis: '50%' }} data-testid={testId}>
    <Stack hasGutter>
      <StackItem>
        <Content component={ContentVariants.p}>
          <strong>{heading}</strong>
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
      </StackItem>
      {labels && Object.keys(labels).length > 0 && (
        <StackItem>
          <LabelGroupWithTooltip
            labels={Object.entries(labels).map(([key, value]) => `${key}: ${value}`)}
            limit={labelLimit}
            isCompact
            color={labelColor}
          />
        </StackItem>
      )}
    </Stack>
  </SplitItem>
);

interface SummaryDiffSectionProps {
  displayName?: string;
  description?: string;
  labels?: Record<string, string>;
  originalDisplayName?: string;
  originalDescription?: string;
  originalLabels?: Record<string, string>;
  redirectIcon?: React.ReactNode;
  labelLimit?: number;
}

export const SummaryDiffSection: FC<SummaryDiffSectionProps> = ({
  displayName,
  description,
  labels,
  originalDisplayName,
  originalDescription,
  originalLabels,
  redirectIcon,
  labelLimit,
}) => (
  <Split hasGutter>
    <DiffColumn
      heading="Current:"
      displayName={originalDisplayName}
      description={originalDescription}
      labels={originalLabels}
      labelLimit={labelLimit}
      data-testid="summary-diff-current"
    />
    <DiffColumn
      heading="New:"
      displayName={displayName}
      description={description}
      labels={labels}
      labelColor="blue"
      labelLimit={labelLimit}
      redirectIcon={redirectIcon}
      data-testid="summary-diff-new"
    />
  </Split>
);
