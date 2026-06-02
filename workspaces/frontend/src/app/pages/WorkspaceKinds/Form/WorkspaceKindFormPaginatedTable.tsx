import React, { useCallback, useMemo, useState } from 'react';
import {
  Table,
  Thead,
  Tr,
  Td,
  Tbody,
  Th,
  ExpandableRowContent,
} from '@patternfly/react-table/dist/esm/components/Table';
import { getUniqueId } from '@patternfly/react-core/helpers';
import { Label } from '@patternfly/react-core/dist/esm/components/Label';
import { MenuToggle } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { PageSection } from '@patternfly/react-core/dist/esm/components/Page';
import {
  Pagination,
  PaginationVariant,
} from '@patternfly/react-core/dist/esm/components/Pagination';
import { Radio } from '@patternfly/react-core/dist/esm/components/Radio';
import { Dropdown, DropdownItem } from '@patternfly/react-core/dist/esm/components/Dropdown';
import { EllipsisVIcon } from '@patternfly/react-icons/dist/esm/icons/ellipsis-v-icon';
import { WorkspaceKindImageConfigValue } from '~/app/types';
import { OptionsOptionLabel, OptionsPodConfigValue } from '~/generated/data-contracts';

interface PaginatedTableProps {
  rows: WorkspaceKindImageConfigValue[] | OptionsPodConfigValue[];
  defaultId: string;
  setDefaultId: (id: string) => void;
  handleEdit: (index: number) => void;
  openDeleteModal: (index: number) => void;
  ariaLabel: string;
  paginated?: boolean;
  dataTestId?: string;
  expandedContent?: (
    row: WorkspaceKindImageConfigValue | OptionsPodConfigValue,
    globalIndex: number,
  ) => React.ReactNode;
}

const NUM_BASE_COLUMNS = 5;

export const WorkspaceKindFormPaginatedTable: React.FC<PaginatedTableProps> = ({
  rows,
  defaultId,
  setDefaultId,
  handleEdit,
  openDeleteModal,
  ariaLabel,
  dataTestId,
  expandedContent,
  paginated = true,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const effectivePerPage = paginated ? perPage : rows.length || 1;
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isExpandable = !!expandedContent;

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);
  const rowPages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < rows.length; i += effectivePerPage) {
      pages.push(rows.slice(i, i + effectivePerPage));
    }
    return pages;
  }, [effectivePerPage, rows]);

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
  return (
    <PageSection>
      <Table aria-label={ariaLabel} data-testid={dataTestId}>
        <Thead>
          <Tr>
            {isExpandable && <Th screenReaderText="Expand" />}
            <Th>Display Name</Th>
            <Th>ID</Th>
            <Th screenReaderText="Row select">Default</Th>
            <Th>Labels</Th>
            <Th aria-label="Actions" />
          </Tr>
        </Thead>
        {rowPages[page - 1].map((row, pageIndex) => {
          const globalIndex = effectivePerPage * (page - 1) + pageIndex;
          const isExpanded = expandedRows.has(row.id);
          const rowContent = (
            <Tr key={row.id}>
              {isExpandable && (
                <Td
                  data-testid={`${dataTestId}-row-${pageIndex}-expand`}
                  expand={{
                    rowIndex: globalIndex,
                    isExpanded,
                    onToggle: () => handleToggleExpand(row.id),
                  }}
                />
              )}
              <Td>{row.displayName}</Td>
              <Td>{row.id}</Td>
              <Td>
                <Radio
                  className="workspace-kind-form-radio"
                  id={`default-${ariaLabel}-${pageIndex}`}
                  name={`default-${ariaLabel}-${pageIndex}-radio`}
                  label="Default"
                  isChecked={defaultId === row.id}
                  onChange={() => {
                    setDefaultId(row.id);
                  }}
                  aria-label={`Select ${row.id} as default`}
                />
              </Td>
              <Td>
                {(row.labels ?? []).length > 0 &&
                  (row.labels ?? []).map((label: OptionsOptionLabel) => (
                    <Label
                      style={{ marginRight: '4px', marginTop: '4px' }}
                      key={getUniqueId()}
                    >{`${label.key}: ${label.value}`}</Label>
                  ))}
              </Td>
              <Td isActionCell>
                <Dropdown
                  toggle={(toggleRef) => (
                    <MenuToggle
                      ref={toggleRef}
                      isExpanded={dropdownOpen === globalIndex}
                      onClick={() =>
                        setDropdownOpen(dropdownOpen === globalIndex ? null : globalIndex)
                      }
                      variant="plain"
                      aria-label="plain kebab"
                      data-testid={`${dataTestId}-row-${pageIndex}-kebab`}
                    >
                      <EllipsisVIcon />
                    </MenuToggle>
                  )}
                  isOpen={dropdownOpen === globalIndex}
                  onSelect={() => setDropdownOpen(null)}
                  popperProps={{ position: 'right' }}
                >
                  <DropdownItem onClick={() => handleEdit(globalIndex)}>Edit</DropdownItem>
                  <DropdownItem onClick={() => openDeleteModal(globalIndex)}>Remove</DropdownItem>
                </Dropdown>
              </Td>
            </Tr>
          );

          if (isExpandable) {
            return (
              <Tbody key={row.id} isExpanded={isExpanded}>
                {rowContent}
                <Tr isExpanded={isExpanded}>
                  <Td colSpan={NUM_BASE_COLUMNS + 1}>
                    <ExpandableRowContent>
                      {expandedContent!(row, globalIndex)}
                    </ExpandableRowContent>
                  </Td>
                </Tr>
              </Tbody>
            );
          }

          return <Tbody key={row.id}>{rowContent}</Tbody>;
        })}
      </Table>
      {paginated && (
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
      )}
    </PageSection>
  );
};
