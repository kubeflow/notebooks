import React from 'react';
import {
  ClipboardCopy,
  ClipboardCopyVariant,
} from '@patternfly/react-core/dist/esm/components/ClipboardCopy';
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Title } from '@patternfly/react-core/dist/esm/components/Title';

type ErrorDetailsProps = {
  title: string;
  errorMessage?: string;
  componentStack: string;
  stack?: string;
};

const ErrorDetails: React.FC<ErrorDetailsProps> = ({
  title,
  errorMessage,
  componentStack,
  stack,
}) => (
  <>
    <Title headingLevel="h2" className="pf-v6-u-mb-md">
      {title}
    </Title>
    <DescriptionList>
      {errorMessage ? (
        <DescriptionListGroup>
          <DescriptionListTerm>Description:</DescriptionListTerm>
          <DescriptionListDescription>{errorMessage}</DescriptionListDescription>
        </DescriptionListGroup>
      ) : null}

      <DescriptionListGroup>
        <DescriptionListTerm>Component trace:</DescriptionListTerm>
        <DescriptionListDescription>
          <ClipboardCopy
            isExpanded
            isCode
            hoverTip="Copy"
            clickTip="Copied"
            variant={ClipboardCopyVariant.expansion}
          >
            {componentStack.trim()}
          </ClipboardCopy>
        </DescriptionListDescription>
      </DescriptionListGroup>

      {stack ? (
        <DescriptionListGroup>
          <DescriptionListTerm>Stack trace:</DescriptionListTerm>
          <DescriptionListDescription>
            <ClipboardCopy
              isExpanded
              isCode
              hoverTip="Copy"
              clickTip="Copied"
              variant={ClipboardCopyVariant.expansion}
            >
              {stack.trim()}
            </ClipboardCopy>
          </DescriptionListDescription>
        </DescriptionListGroup>
      ) : null}
    </DescriptionList>
  </>
);

export default ErrorDetails;
