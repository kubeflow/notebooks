import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormImagePort } from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImagePort';
import { WorkspaceKindImagePort } from '~/app/types';

jest.mock('mod-arch-kubeflow', () => ({
  useThemeContext: () => ({ isMUITheme: false }),
}));

const makePort = (overrides: Partial<WorkspaceKindImagePort> = {}): WorkspaceKindImagePort => ({
  id: 'http',
  displayName: 'HTTP',
  port: 8888,
  protocol: 'HTTP',
  ...overrides,
});

const threePortConfig = (): WorkspaceKindImagePort[] => [
  makePort({ id: 'http', displayName: 'HTTP', port: 8888 }),
  makePort({ id: 'jupyter', displayName: 'JupyterLab', port: 8889 }),
  makePort({ id: 'tensorboard', displayName: 'TensorBoard', port: 6006 }),
];

describe('WorkspaceKindFormImagePort', () => {
  const setPorts = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 1. Renders an existing configuration containing three ports.
  it('renders all three ports from an existing configuration', () => {
    render(<WorkspaceKindFormImagePort ports={threePortConfig()} setPorts={setPorts} />);
    expect(screen.getByTestId('port-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('port-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('port-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('port-id-cell-0')).toHaveTextContent('http');
    expect(screen.getByTestId('port-id-cell-1')).toHaveTextContent('jupyter');
    expect(screen.getByTestId('port-id-cell-2')).toHaveTextContent('tensorboard');
    expect(screen.getByTestId('port-number-cell-1')).toHaveTextContent('8889');
    expect(screen.getByTestId('port-number-cell-2')).toHaveTextContent('6006');
  });

  // 2. Adding a second port to a configuration containing one port.
  it('adds a second port without replacing the first', async () => {
    const user = userEvent.setup();
    const ports = [makePort({ id: 'http', port: 8888 })];
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.clear(screen.getByTestId('port-modal-id-input'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'jupyter');
    await user.clear(screen.getByTestId('port-modal-port-input'));
    await user.type(screen.getByTestId('port-modal-port-input'), '8889');
    await user.type(screen.getByTestId('port-modal-display-name-input'), 'JupyterLab');
    await user.click(screen.getByTestId('port-modal-submit-button'));

    expect(setPorts).toHaveBeenCalledWith([
      makePort({ id: 'http', port: 8888 }),
      { id: 'jupyter', displayName: 'JupyterLab', port: 8889, protocol: 'HTTP' },
    ]);
  });

  // 3. Editing the second port without changing the first.
  it('edits the second port and leaves the first unchanged', async () => {
    const user = userEvent.setup();
    const ports = [
      makePort({ id: 'http', port: 8888 }),
      makePort({ id: 'jupyter', displayName: 'Old Name', port: 8889 }),
    ];
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    await user.click(screen.getByTestId('port-edit-1'));
    // id field is disabled when editing, so we only change displayName
    await user.clear(screen.getByTestId('port-modal-display-name-input'));
    await user.type(screen.getByTestId('port-modal-display-name-input'), 'JupyterLab');
    await user.click(screen.getByTestId('port-modal-submit-button'));

    expect(setPorts).toHaveBeenCalledWith([
      makePort({ id: 'http', port: 8888 }),
      { id: 'jupyter', displayName: 'JupyterLab', port: 8889, protocol: 'HTTP' },
    ]);
  });

  // 4. Removing the middle port from a three-port configuration.
  it('removes only the middle port from a three-port configuration', async () => {
    const user = userEvent.setup();
    const ports = threePortConfig();
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    await user.click(screen.getByTestId('port-remove-1'));

    expect(setPorts).toHaveBeenCalledWith([
      makePort({ id: 'http', displayName: 'HTTP', port: 8888 }),
      makePort({ id: 'tensorboard', displayName: 'TensorBoard', port: 6006 }),
    ]);
  });

  // 5. The Remove button is disabled when only one port exists (MinItems:=1).
  it('disables the remove button when only one port exists', () => {
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);
    expect(screen.getByTestId('port-remove-0')).toBeDisabled();
  });

  // 6. Remove button is enabled when more than one port exists.
  it('enables the remove button when more than one port exists', () => {
    const ports = [makePort({ id: 'a' }), makePort({ id: 'b' })];
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);
    expect(screen.getByTestId('port-remove-0')).not.toBeDisabled();
    expect(screen.getByTestId('port-remove-1')).not.toBeDisabled();
  });

  // 7. Duplicate ID is rejected in the add modal.
  it('disables submit when a duplicate ID is entered in the add modal', async () => {
    const user = userEvent.setup();
    const ports = [makePort({ id: 'http' })];
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'http');

    expect(screen.getByTestId('port-modal-submit-button')).toBeDisabled();
    expect(screen.getByText('ID must be unique')).toBeInTheDocument();
  });

  // 8. Invalid port number is rejected.
  it('disables submit when an out-of-range port number is entered', async () => {
    const user = userEvent.setup();
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'newport');
    await user.clear(screen.getByTestId('port-modal-port-input'));
    await user.type(screen.getByTestId('port-modal-port-input'), '0');

    expect(screen.getByTestId('port-modal-submit-button')).toBeDisabled();
    expect(screen.getByText('Port must be between 1 and 65535')).toBeInTheDocument();
  });

  // 8b. Decimal port number is rejected.
  it('disables submit when a decimal port number is entered', async () => {
    const user = userEvent.setup();
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'newport');
    await user.clear(screen.getByTestId('port-modal-port-input'));
    await user.type(screen.getByTestId('port-modal-port-input'), '8888.5');

    expect(screen.getByTestId('port-modal-submit-button')).toBeDisabled();
    expect(screen.getByText('Port must be between 1 and 65535')).toBeInTheDocument();
  });

  // 8c. Duplicate port number is rejected.
  it('disables submit when a duplicate port number is entered', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888 })]}
        setPorts={setPorts}
      />,
    );

    await user.click(screen.getByTestId('add-port-button'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'jupyter');
    // clear and retype the default port to touch the field — 8888 is already taken
    await user.clear(screen.getByTestId('port-modal-port-input'));
    await user.type(screen.getByTestId('port-modal-port-input'), '8888');
    expect(screen.getByTestId('port-modal-submit-button')).toBeDisabled();
    expect(screen.getByText('Port number is already in use')).toBeInTheDocument();
  });

  // 8d. Display name shorter than 2 characters is rejected.
  it('disables submit when display name is 1 character', async () => {
    const user = userEvent.setup();
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'jupyter');
    await user.clear(screen.getByTestId('port-modal-port-input'));
    await user.type(screen.getByTestId('port-modal-port-input'), '8889');
    await user.type(screen.getByTestId('port-modal-display-name-input'), 'X');

    expect(screen.getByTestId('port-modal-submit-button')).toBeDisabled();
    expect(screen.getByText('Display name must be at least 2 characters')).toBeInTheDocument();
  });

  // 8e. Empty display name is accepted (displayName is optional per CRD).
  it('enables submit when display name is empty', async () => {
    const user = userEvent.setup();
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'jupyter');
    await user.clear(screen.getByTestId('port-modal-port-input'));
    await user.type(screen.getByTestId('port-modal-port-input'), '8889');
    // displayName left empty — valid per CRD (+Optional), serializes to undefined

    expect(screen.getByTestId('port-modal-submit-button')).not.toBeDisabled();
  });

  // 8f. Display name with exactly 2 characters is accepted.
  it('enables submit when display name is exactly 2 characters', async () => {
    const user = userEvent.setup();
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.type(screen.getByTestId('port-modal-id-input'), 'jupyter');
    await user.clear(screen.getByTestId('port-modal-port-input'));
    await user.type(screen.getByTestId('port-modal-port-input'), '8889');
    await user.type(screen.getByTestId('port-modal-display-name-input'), 'JL');

    expect(screen.getByTestId('port-modal-submit-button')).not.toBeDisabled();
  });

  // 9. Opening and cancelling the modal does not call setPorts.
  it('cancelling the add modal does not call setPorts', async () => {
    const user = userEvent.setup();
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    await user.click(screen.getByTestId('port-modal-cancel-button'));

    expect(setPorts).not.toHaveBeenCalled();
  });

  // 10. Single-port backward compatibility: existing single-port config still works.
  it('renders a single-port configuration correctly', () => {
    const ports = [makePort({ id: 'default', port: 8888 })];
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    expect(screen.getByTestId('port-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('port-id-cell-0')).toHaveTextContent('default');
    expect(screen.getByTestId('port-number-cell-0')).toHaveTextContent('8888');
    expect(screen.getByTestId('port-remove-0')).toBeDisabled();
  });

  // 11. Display name falls back to '-' when empty.
  it('displays a dash for ports with no display name', () => {
    const ports = [makePort({ id: 'http', displayName: '' })];
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    const row = screen.getByTestId('port-row-0');
    expect(within(row).getByTestId('port-display-name-cell-0')).toHaveTextContent('-');
  });

  // 12. Protocol column always shows HTTP.
  it('renders HTTP in the protocol column', () => {
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);
    expect(screen.getByTestId('port-protocol-cell-0')).toHaveTextContent('HTTP');
  });

  // 13. ID field is disabled when editing an existing port.
  it('disables the ID field when editing an existing port', async () => {
    const user = userEvent.setup();
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);

    await user.click(screen.getByTestId('port-edit-0'));

    expect(screen.getByTestId('port-modal-id-input')).toBeDisabled();
  });

  // 14. Modal title changes between add and edit modes.
  it('shows "Add Port" submit button when adding and "Save" when editing', async () => {
    const user = userEvent.setup();
    const ports = [makePort()];
    const { rerender } = render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    await user.click(screen.getByTestId('add-port-button'));
    expect(screen.getByTestId('port-modal-submit-button')).toHaveTextContent('Add');
    await user.click(screen.getByTestId('port-modal-cancel-button'));

    rerender(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);
    await user.click(screen.getByTestId('port-edit-0'));
    expect(screen.getByTestId('port-modal-submit-button')).toHaveTextContent('Save');
  });

  // 15. Empty ports array: table is not rendered but Add Port button is present.
  it('renders the Add Port button even when ports array is empty', () => {
    render(<WorkspaceKindFormImagePort ports={[]} setPorts={setPorts} />);
    expect(screen.queryByTestId('ports-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-port-button')).toBeInTheDocument();
  });
});
