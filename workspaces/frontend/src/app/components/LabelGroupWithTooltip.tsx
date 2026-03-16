import React from 'react';
import { Label, LabelProps } from '@patternfly/react-core/dist/esm/components/Label';
import { Tooltip } from '@patternfly/react-core/dist/esm/components/Tooltip';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';

export interface LabelGroupWithTooltipProps {
  labels: string[];
  limit: number;
  isCompact?: boolean;
  variant?: LabelProps['variant'];
  icon?: React.ReactNode;
  status?: LabelProps['status'];
  color?: LabelProps['color'];
}

export const LabelGroupWithTooltip: React.FC<LabelGroupWithTooltipProps> = ({
  labels,
  limit,
  isCompact = false,
  variant = 'filled',
  icon,
  status,
  color,
}) => {
  if (labels.length === 0) {
    return null;
  }

  const visibleLabels = labels.slice(0, limit);
  const remainingLabels = labels.slice(limit);
  const hasMore = remainingLabels.length > 0;

  return (
    <Flex gap={{ default: 'gapXs' }}>
      {visibleLabels.map((label, index) => (
        <FlexItem key={`${label}-${index}`}>
          <Label isCompact={isCompact} variant={variant} icon={icon} status={status} color={color}>
            {label}
          </Label>
        </FlexItem>
      ))}
      {hasMore && (
        <FlexItem>
          <Tooltip content={`${remainingLabels.join(', ')}`}>
            <Label isCompact={isCompact} variant={variant} color={color}>
              +{remainingLabels.length} more
            </Label>
          </Tooltip>
        </FlexItem>
      )}
    </Flex>
  );
};
