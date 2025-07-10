import React, { useMemo, useState } from 'react';
import { Table, Thead, Tr, Td, Tbody, Th } from '@patternfly/react-table';
import {
  Dropdown,
  DropdownItem,
  getUniqueId,
  Label,
  MenuToggle,
  PageSection,
  Pagination,
  PaginationVariant,
  Radio,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';

import { WorkspaceKindImageConfigValue } from '~/app/types';
import { WorkspacePodConfigValue } from '~/shared/api/backendApiTypes';

interface PaginatedTableProps {
  rows: WorkspaceKindImageConfigValue[] | WorkspacePodConfigValue[];
  defaultId: string;
  setDefaultId: (id: string) => void;
  handleEdit: (index: number) => void;
  openDeleteModal: (index: number) => void;
  ariaLabel: string;
}

export const WorkspaceKindFormPaginatedTable: React.FC<PaginatedTableProps> = ({
  rows,
  defaultId,
  setDefaultId,
  handleEdit,
  openDeleteModal,
  ariaLabel,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState<number | null>(null);
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
  return (
    <PageSection>
      <Table aria-label={ariaLabel}>
        <Thead>
          <Tr>
            <Th>Display Name</Th>
            <Th>ID</Th>
            <Th screenReaderText="Row select">Default</Th>
            <Th>Labels</Th>
            <Th aria-label="Actions" />
          </Tr>
        </Thead>
        <Tbody>
          {rowPages[page - 1].map((row, index) => (
            <Tr key={row.id}>
              <Td>{row.displayName}</Td>
              <Td>{row.id}</Td>
              <Td>
                <Radio
                  className="workspace-kind-form-radio"
                  id={`default-${ariaLabel}-${index}`}
                  name={`default-${ariaLabel}-${index}-radio`}
                  isChecked={defaultId === row.id}
                  onChange={() => {
                    console.log(row.id);
                    setDefaultId(row.id);
                  }}
                  aria-label={`Select ${row.id} as default`}
                />
              </Td>
              <Td>
                {row.labels.length > 0 &&
                  row.labels.map((label) => (
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
                      isExpanded={dropdownOpen === index}
                      onClick={() => setDropdownOpen(dropdownOpen === index ? null : index)}
                      variant="plain"
                      aria-label="plain kebab"
                    >
                      <EllipsisVIcon />
                    </MenuToggle>
                  )}
                  isOpen={dropdownOpen === index}
                  onSelect={() => setDropdownOpen(null)}
                  popperProps={{ position: 'right' }}
                >
                  <DropdownItem onClick={() => handleEdit(perPage * (page - 1) + index)}>
                    Edit
                  </DropdownItem>
                  <DropdownItem onClick={() => openDeleteModal(perPage * (page - 1) + index)}>
                    Remove
                  </DropdownItem>
                </Dropdown>
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
    </PageSection>
  );
};
