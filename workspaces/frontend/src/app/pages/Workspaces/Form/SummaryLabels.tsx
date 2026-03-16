import React, { FC } from 'react';
import { Label, LabelGroup } from '@patternfly/react-core/dist/esm/components/Label';

interface SummaryLabelsProps {
  labels: Record<string, string>;
  color?: 'blue' | 'teal' | 'green' | 'orange' | 'purple' | 'red' | 'orangered' | 'grey' | 'yellow';
}

export const SummaryLabels: FC<SummaryLabelsProps> = ({ labels, color }) => {
  if (Object.keys(labels).length === 0) {
    return null;
  }

  return (
    <LabelGroup numLabels={5}>
      {Object.entries(labels).map(([key, value]) => (
        <Label key={key} isCompact color={color}>
          {key}: {value}
        </Label>
      ))}
    </LabelGroup>
  );
};
