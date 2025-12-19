import React, { useMemo, useState } from 'react';
import { Table, Thead, Tr, Td, Tbody, Th } from '@patternfly/react-table/dist/esm/components/Table';
import {
  Pagination,
  PaginationVariant,
} from '@patternfly/react-core/dist/esm/components/Pagination';
import { Content } from '@patternfly/react-core/dist/esm/components/Content';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import { EmptyState, EmptyStateBody } from '@patternfly/react-core/dist/esm/components/EmptyState';
import { CubesIcon } from '@patternfly/react-icons/dist/esm/icons/cubes-icon';
import { useTypedNavigate } from '~/app/routerHelper';
import { ErrorPopover } from '~/shared/components/ErrorPopover';
import { RouteStateMap } from '~/app/routes';
import { ApiErrorEnvelope } from '~/generated/data-contracts';

export interface WorkspaceKindDetailsTableRow {
  id: string;
  displayName: string;
  kindName: string;
  workspaceCount: number;
  workspaceCountRouteState: RouteStateMap['workspaceKindSummary'];
}

interface WorkspaceKindDetailsTableProps {
  rows: WorkspaceKindDetailsTableRow[];
  tableKind: 'image' | 'podConfig' | 'namespace';
  workspaceCountError: string | ApiErrorEnvelope | null;
}

export const WorkspaceKindDetailsTable: React.FC<WorkspaceKindDetailsTableProps> = ({
  rows,
  tableKind,
  workspaceCountError,
}) => {
  const navigate = useTypedNavigate();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const rowPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < rows.length; i += perPage) {
      pages.push(rows.slice(i, i + perPage));
    }
    return pages;
  }, [perPage, rows]);

  const onSetPage = (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    newPage: number,
  ) => {
    setPage(newPage);
  };

  const onPerPageSelect = (
    _event: React.MouseEvent | React.KeyboardEvent | MouseEvent,
    newPerPage: number,
    newPage: number,
  ) => {
    setPerPage(newPerPage);
    setPage(newPage);
  };

  if (rows.length === 0) {
    return (
      <EmptyState headingLevel="h4" titleText="No results found" icon={CubesIcon}>
        <EmptyStateBody>No items are available for this workspace kind.</EmptyStateBody>
      </EmptyState>
    );
  }

  return (
    <Content>
      <Table aria-label={`workspace-kind-details-${tableKind}`}>
        <Thead>
          <Tr>
            <Th>Name</Th>
            <Th>Workspaces</Th>
          </Tr>
        </Thead>
        <Tbody>
          {rowPages[page - 1]?.map((row) => (
            <Tr key={row.id}>
              <Td>{row.displayName}</Td>
              <Td>
                {workspaceCountError ? (
                  <ErrorPopover
                    title="Failed to load workspace counts"
                    content={workspaceCountError}
                  />
                ) : (
                  <Button
                    variant="link"
                    isInline
                    className="workspace-kind-summary-button"
                    onClick={() =>
                      navigate('workspaceKindSummary', {
                        params: { kind: row.kindName },
                        state: row.workspaceCountRouteState,
                      })
                    }
                  >
                    {row.workspaceCount} Workspaces
                  </Button>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
      <Pagination
        itemCount={rows.length}
        widgetId="pagination-bottom"
        perPage={perPage}
        page={page}
        variant={PaginationVariant.bottom}
        isCompact
        onSetPage={onSetPage}
        onPerPageSelect={onPerPageSelect}
      />
    </Content>
  );
};
