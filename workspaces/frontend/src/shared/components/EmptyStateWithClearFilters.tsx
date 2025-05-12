import * as React from 'react';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
  Button,
  Bullseye,
} from '@patternfly/react-core';
import { SearchIcon } from '@patternfly/react-icons';

interface EmptyStateWithClearFiltersProps {
  title: string;
  body: string;
  onClearFilters: () => void;
  colSpan?: number;
}

const EmptyStateWithClearFilters: React.FC<EmptyStateWithClearFiltersProps> = ({
  title,
  body,
  onClearFilters,
  colSpan,
}) => (
   colSpan !== undefined ? (

     <Bullseye>
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
     </Bullseye>
   ) : (
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
   )
);

export default EmptyStateWithClearFilters;