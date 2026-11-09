import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { WorkspaceKindFormImagePort } from '~/app/pages/WorkspaceKinds/Form/image/WorkspaceKindFormImagePort';
import { WorkspaceKindImagePort } from '~/app/types';
import { V1Beta1WorkspaceKindPort, V1Beta1ImagePortProtocol } from '~/generated/data-contracts';

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

const makeDeclaredPort = (id: string, displayName: string): V1Beta1WorkspaceKindPort => ({
  id,
  defaultDisplayName: displayName,
  protocol: V1Beta1ImagePortProtocol.ImagePortProtocolHTTP,
});

const threePortConfig = (): WorkspaceKindImagePort[] => [
  makePort({ id: 'http', displayName: 'HTTP', port: 8888 }),
  makePort({ id: 'jupyter', displayName: 'JupyterLab', port: 8889 }),
  makePort({ id: 'tf', displayName: 'TensorBoard', port: 6006 }),
];

const declaredPorts: V1Beta1WorkspaceKindPort[] = [
  makeDeclaredPort('http', 'HTTP'),
  makeDeclaredPort('jupyter', 'JupyterLab'),
  makeDeclaredPort('tf', 'TensorBoard'),
];

describe('WorkspaceKindFormImagePort', () => {
  const setPorts = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  // 1. Renders an existing configuration containing three ports.
  it('renders all three ports from an existing configuration', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={threePortConfig()}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.getByTestId('port-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('port-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('port-row-2')).toBeInTheDocument();
    expect(screen.getByTestId('port-id-select-0')).toHaveValue('http');
    expect(screen.getByTestId('port-id-select-1')).toHaveValue('jupyter');
    expect(screen.getByTestId('port-id-select-2')).toHaveValue('tf');
    expect(screen.getByTestId('port-number-input-1')).toHaveValue(8889);
    expect(screen.getByTestId('port-number-input-2')).toHaveValue(6006);
  });

  // 2. Protocol column always shows HTTP (static text, no input).
  it('renders HTTP in the protocol column', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort()]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.getByTestId('port-protocol-cell-0')).toHaveTextContent('HTTP');
  });

  // 3. Display name falls back to empty string when unset.
  it('renders empty display name when port has no display name', () => {
    const ports = [makePort({ id: 'http', displayName: '' })];
    render(
      <WorkspaceKindFormImagePort
        ports={ports}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.getByTestId('port-display-name-input-0')).toHaveValue('');
  });

  // 4. No ports: table is hidden, Add Port button is present.
  it('renders the Add Port button even when ports array is empty', () => {
    render(
      <WorkspaceKindFormImagePort ports={[]} setPorts={setPorts} declaredPorts={declaredPorts} />,
    );
    expect(screen.queryByTestId('ports-table')).not.toBeInTheDocument();
    expect(screen.getByTestId('add-port-button')).toBeInTheDocument();
  });

  // 5. Without declaredPorts falls back to a text input for the ID field.
  it('renders a text input for ID when no declaredPorts are provided', () => {
    render(<WorkspaceKindFormImagePort ports={[makePort()]} setPorts={setPorts} />);
    expect(screen.getByTestId('port-id-input-0')).toBeInTheDocument();
    expect(screen.queryByTestId('port-id-select-0')).not.toBeInTheDocument();
  });

  // ── Add / remove ──────────────────────────────────────────────────────────

  // 6. Clicking Add Port adds a new inline row.
  it('adds a new inline row when Add Port is clicked', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.click(screen.getByTestId('add-port-button'));

    expect(setPorts).toHaveBeenCalledWith([
      makePort({ id: 'http', port: 8888 }),
      { id: '', displayName: '', port: 8888, protocol: 'HTTP' },
    ]);
  });

  // 7. Removing the middle port from a three-port configuration.
  it('removes only the middle port from a three-port configuration', async () => {
    const user = userEvent.setup();
    const ports = threePortConfig();
    render(
      <WorkspaceKindFormImagePort
        ports={ports}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.click(screen.getByTestId('port-remove-1'));

    expect(setPorts).toHaveBeenCalledWith([
      makePort({ id: 'http', displayName: 'HTTP', port: 8888 }),
      makePort({ id: 'tf', displayName: 'TensorBoard', port: 6006 }),
    ]);
  });

  // 8. Remove button is disabled when only one port exists.
  it('disables the remove button when only one port exists', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort()]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.getByTestId('port-remove-0')).toBeDisabled();
  });

  // 9. Remove button is enabled when more than one port exists.
  it('enables the remove button when more than one port exists', () => {
    const ports = [makePort({ id: 'http' }), makePort({ id: 'jupyter' })];
    render(
      <WorkspaceKindFormImagePort
        ports={ports}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.getByTestId('port-remove-0')).not.toBeDisabled();
    expect(screen.getByTestId('port-remove-1')).not.toBeDisabled();
  });

  // 10. Remove first port in a two-port config.
  it('removes the first port and keeps the second', async () => {
    const user = userEvent.setup();
    const ports = [makePort({ id: 'http', port: 8888 }), makePort({ id: 'jupyter', port: 8889 })];
    render(
      <WorkspaceKindFormImagePort
        ports={ports}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.click(screen.getByTestId('port-remove-0'));

    expect(setPorts).toHaveBeenCalledWith([makePort({ id: 'jupyter', port: 8889 })]);
  });

  // ── Inline editing ────────────────────────────────────────────────────────

  // 11. Changing the ID Select calls setPorts with updated id.
  it('calls setPorts with updated id when ID select changes', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.selectOptions(screen.getByTestId('port-id-select-0'), 'jupyter');

    expect(setPorts).toHaveBeenCalledWith([makePort({ id: 'jupyter', port: 8888 })]);
  });

  // 12. Changing display name calls setPorts with updated displayName.
  it('calls setPorts with updated displayName when display name input changes', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', displayName: 'HTTP', port: 8888 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    fireEvent.change(screen.getByTestId('port-display-name-input-0'), {
      target: { value: 'HTTP Main' },
    });

    expect(setPorts).toHaveBeenLastCalledWith([
      makePort({ id: 'http', displayName: 'HTTP Main', port: 8888 }),
    ]);
  });

  // 13. Changing port number calls setPorts with updated port.
  it('calls setPorts with updated port when port number input changes', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.clear(screen.getByTestId('port-number-input-0'));
    await user.type(screen.getByTestId('port-number-input-0'), '9000');

    expect(setPorts).toHaveBeenLastCalledWith([makePort({ id: 'http', port: 9000 })]);
  });

  // ── Validation — inline errors show after interaction ─────────────────────

  // 14. No errors visible for newly added untouched row.
  it('shows no validation errors for a newly added row before interaction', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.click(screen.getByTestId('add-port-button'));
    // setPorts was called with an empty row; rerender (not a fresh render) so
    // the component's internal touchedRows state is preserved — only row 0 is
    // touched, the new row 1 starts untouched.
    const newPorts = setPorts.mock.calls[0][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();
    rerender(
      <WorkspaceKindFormImagePort
        ports={newPorts}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    // Row 1 is newly added — it should not show errors yet
    expect(screen.queryByText('Port ID is required')).not.toBeInTheDocument();
  });

  // 15. Duplicate ID error appears inline after selecting duplicate.
  it('shows inline duplicate-ID error when the same ID is selected twice', async () => {
    const user = userEvent.setup();
    const ports = [makePort({ id: 'http', port: 8888 }), makePort({ id: 'jupyter', port: 8889 })];
    const { rerender } = render(
      <WorkspaceKindFormImagePort
        ports={ports}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    // Both rows are pre-existing (touched). Change row 1 to duplicate row 0's id.
    await user.selectOptions(screen.getByTestId('port-id-select-1'), 'http');

    // The updated ports that setPorts was called with
    const updated = setPorts.mock.calls[0][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();

    // rerender preserves touchedRows; both rows are touched so both show the error
    rerender(
      <WorkspaceKindFormImagePort
        ports={updated}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    // Both duplicate rows show the error — use queryAllByText to handle multiple matches
    expect(screen.queryAllByText('ID must be unique').length).toBeGreaterThan(0);
  });

  // 16. Duplicate port number error appears inline.
  it('shows inline duplicate-port error when the same port number is used twice', async () => {
    const user = userEvent.setup();
    const ports = [makePort({ id: 'http', port: 8888 }), makePort({ id: 'jupyter', port: 8889 })];
    const { rerender } = render(
      <WorkspaceKindFormImagePort
        ports={ports}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.clear(screen.getByTestId('port-number-input-1'));
    await user.type(screen.getByTestId('port-number-input-1'), '8888');

    const updated = setPorts.mock.calls[
      setPorts.mock.calls.length - 1
    ][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();

    // rerender preserves touchedRows; both rows are touched so both show the error
    rerender(
      <WorkspaceKindFormImagePort
        ports={updated}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    // Both duplicate rows show the error — use queryAllByText to handle multiple matches
    expect(screen.queryAllByText('Port number is already in use').length).toBeGreaterThan(0);
  });

  // 17. Out-of-range port number shows error.
  it('shows inline port-range error when port number is out of range', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.clear(screen.getByTestId('port-number-input-0'));
    await user.type(screen.getByTestId('port-number-input-0'), '0');

    const updated = setPorts.mock.calls[
      setPorts.mock.calls.length - 1
    ][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();

    render(
      <WorkspaceKindFormImagePort
        ports={updated}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    expect(screen.getByText('Port must be between 1 and 65535')).toBeInTheDocument();
  });

  // 18. Display name shorter than 2 Unicode code points shows error.
  it('shows inline error when display name is 1 character', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888, displayName: '' })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.type(screen.getByTestId('port-display-name-input-0'), 'X');

    const updated = setPorts.mock.calls[0][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();

    render(
      <WorkspaceKindFormImagePort
        ports={updated}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    expect(screen.getByText('Display name must be at least 2 characters')).toBeInTheDocument();
  });

  // 19. Display name with exactly 2 characters is valid (no error shown).
  it('shows no error when display name is exactly 2 characters', () => {
    // fireEvent.change is used so the controlled value is set atomically
    // (userEvent.type would reset the controlled value between keystrokes)
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888, displayName: '' })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    fireEvent.change(screen.getByTestId('port-display-name-input-0'), {
      target: { value: 'JL' },
    });

    const updated = setPorts.mock.calls[0][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();

    render(
      <WorkspaceKindFormImagePort
        ports={updated}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    expect(
      screen.queryByText('Display name must be at least 2 characters'),
    ).not.toBeInTheDocument();
  });

  // 20. Empty display name is valid (optional field).
  it('shows no error when display name is empty', async () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888, displayName: '' })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    expect(
      screen.queryByText('Display name must be at least 2 characters'),
    ).not.toBeInTheDocument();
  });

  // 21. Unicode emoji counts as 1 code point — single emoji display name rejected.
  it('shows error when display name is a single emoji (1 code point)', async () => {
    const user = userEvent.setup();
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888, displayName: '' })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    await user.type(screen.getByTestId('port-display-name-input-0'), '😀');

    const updated = setPorts.mock.calls[0][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();

    render(
      <WorkspaceKindFormImagePort
        ports={updated}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    expect(screen.getByText('Display name must be at least 2 characters')).toBeInTheDocument();
  });

  // 22. Display name exceeding 64 Unicode code points shows error.
  it('shows error when display name exceeds 64 Unicode code points', async () => {
    const longName = 'a'.repeat(65);
    const portsWithLong = [makePort({ id: 'http', port: 8888, displayName: longName })];
    render(
      <WorkspaceKindFormImagePort
        ports={portsWithLong}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    expect(screen.getByText('Display name cannot exceed 64 characters')).toBeInTheDocument();
  });

  // ── Validation — port boundaries ──────────────────────────────────────────

  // 23. Port 1 is accepted (lower boundary).
  it('shows no port-range error when port is 1 (lower boundary)', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 1 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.queryByText('Port must be between 1 and 65535')).not.toBeInTheDocument();
  });

  // 24. Port 65535 is accepted (upper boundary).
  it('shows no port-range error when port is 65535 (upper boundary)', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 65535 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.queryByText('Port must be between 1 and 65535')).not.toBeInTheDocument();
  });

  // 25. Port 65536 is rejected (out of range).
  it('shows port-range error for port 65536', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 65536 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );
    expect(screen.getByText('Port must be between 1 and 65535')).toBeInTheDocument();
  });

  // 26. Single-port backward compatibility with text-input ID (no declaredPorts).
  it('renders and validates correctly with a text ID input when no declaredPorts are given', () => {
    const ports = [makePort({ id: 'http', port: 8888 })];
    render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    // The table shows the text-input variant
    const idInput = screen.getByTestId('port-id-input-0');
    expect(idInput).toBeInTheDocument();

    // fireEvent.change is used so the controlled value is set atomically
    fireEvent.change(idInput, { target: { value: 'newid' } });

    expect(setPorts).toHaveBeenLastCalledWith([makePort({ id: 'newid', port: 8888 })]);
  });

  // 27. Text-input ID shows "ID must be unique" error on duplicate.
  it('shows inline duplicate-ID error in text-input mode', () => {
    const ports = [makePort({ id: 'http', port: 8888 }), makePort({ id: 'jupyter', port: 8889 })];
    const { rerender } = render(<WorkspaceKindFormImagePort ports={ports} setPorts={setPorts} />);

    // fireEvent.change sets the value atomically; controlled reset between
    // keystrokes (from user.type) would produce wrong intermediate values
    fireEvent.change(screen.getByTestId('port-id-input-1'), { target: { value: 'http' } });

    const updated = setPorts.mock.calls[0][0] as WorkspaceKindImagePort[];
    jest.clearAllMocks();

    // rerender preserves touchedRows; both rows are touched so both show the error
    rerender(<WorkspaceKindFormImagePort ports={updated} setPorts={setPorts} />);

    // Both duplicate rows show the error — use queryAllByText to handle multiple matches
    expect(screen.queryAllByText('ID must be unique').length).toBeGreaterThan(0);
  });

  // ── Rows show pre-existing data ────────────────────────────────────────────

  // 28. Single-port config renders correctly.
  it('renders a single-port configuration correctly', () => {
    const ports = [makePort({ id: 'http', port: 8888 })];
    render(
      <WorkspaceKindFormImagePort
        ports={ports}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    expect(screen.getByTestId('port-row-0')).toBeInTheDocument();
    expect(screen.getByTestId('port-id-select-0')).toHaveValue('http');
    expect(screen.getByTestId('port-number-input-0')).toHaveValue(8888);
    expect(screen.getByTestId('port-remove-0')).toBeDisabled();
  });

  // 29. The ID Select includes all declared ports as options.
  it('includes all declared port IDs as select options', () => {
    render(
      <WorkspaceKindFormImagePort
        ports={[makePort({ id: 'http', port: 8888 })]}
        setPorts={setPorts}
        declaredPorts={declaredPorts}
      />,
    );

    const select = screen.getByTestId('port-id-select-0');
    within(select as HTMLElement).getByRole('option', { name: 'http' });
    within(select as HTMLElement).getByRole('option', { name: 'jupyter' });
    within(select as HTMLElement).getByRole('option', { name: 'tf' });
  });
});
