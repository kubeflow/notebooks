import React from 'react';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
} from '@patternfly/react-core/dist/esm/components/EmptyState';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { SearchIcon } from '@patternfly/react-icons/dist/esm/icons/search-icon';

interface CustomEmptyStateProps {
  onClearFilters: () => void;
}

const CustomEmptyState: React.FC<CustomEmptyStateProps> = ({ onClearFilters }) => {
  const title = 'No results found';
  const body = 'No results match the filter criteria. Clear all filters and try again.';
  return (
    <EmptyState headingLevel="h4" titleText={title} icon={SearchIcon}>
      <EmptyStateBody>{body}</EmptyStateBody>
      <EmptyStateFooter>
        <EmptyStateActions>
          <Button variant="link" onClick={onClearFilters}>
            Clear all filters
          </Button>
        </EmptyStateActions>
      </EmptyStateFooter>
    </EmptyState>
  );
};

export default CustomEmptyState;
