/* eslint-disable camelcase */
import React, { useContext } from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, UNSAFE_NavigationContext } from 'react-router-dom';
import { useUnsavedChangesPrompt } from '~/app/hooks/useUnsavedChangesPrompt';

interface TestComponentProps {
  hasUnsavedChanges?: boolean;
  onNavigate?: () => void;
}

const TestComponent: React.FC<TestComponentProps> = ({ hasUnsavedChanges = false, onNavigate }) => {
  const { isConfirmModalOpen, confirmDiscard, cancelDiscard, confirmNavigation, bypassNavigation } =
    useUnsavedChangesPrompt({ hasUnsavedChanges });

  return (
    <div>
      <div data-testid="modal-state">{isConfirmModalOpen ? 'open' : 'closed'}</div>
      <button
        type="button"
        data-testid="cancel-action-button"
        onClick={() => confirmNavigation(() => onNavigate?.())}
      >
        Cancel Form
      </button>
      <button
        type="button"
        data-testid="bypass-action-button"
        onClick={() => bypassNavigation(() => onNavigate?.())}
      >
        Save and Leave
      </button>
      {isConfirmModalOpen && (
        <div data-testid="discard-changes-modal">
          <button type="button" data-testid="confirm-discard" onClick={confirmDiscard}>
            Discard changes
          </button>
          <button type="button" data-testid="cancel-discard" onClick={cancelDiscard}>
            Keep editing
          </button>
        </div>
      )}
    </div>
  );
};

describe('useUnsavedChangesPrompt hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs navigation immediately on Cancel when clean', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(
      <MemoryRouter>
        <TestComponent onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('cancel-action-button'));

    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('opens confirmation modal and prevents navigation on Cancel when dirty', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(
      <MemoryRouter>
        <TestComponent hasUnsavedChanges onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('cancel-action-button'));

    expect(screen.getByTestId('modal-state')).toHaveTextContent('open');
    expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('closes modal and stays when "Keep editing" is clicked', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(
      <MemoryRouter>
        <TestComponent hasUnsavedChanges onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('cancel-action-button'));
    expect(screen.getByTestId('modal-state')).toHaveTextContent('open');

    await user.click(screen.getByTestId('cancel-discard'));

    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('executes pending navigation when "Discard changes" is confirmed', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(
      <MemoryRouter>
        <TestComponent hasUnsavedChanges onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('cancel-action-button'));
    await user.click(screen.getByTestId('confirm-discard'));

    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('intercepts router navigator.push and completes navigation on discard', async () => {
    const user = userEvent.setup();
    let capturedNavigator:
      | { push: (to: string) => void; replace: (to: string) => void }
      | undefined;

    const RouterConsumer: React.FC<{ hasUnsavedChanges?: boolean }> = ({ hasUnsavedChanges }) => {
      const navContext = useContext(UNSAFE_NavigationContext);
      capturedNavigator = navContext.navigator as unknown as {
        push: (to: string) => void;
        replace: (to: string) => void;
      };
      return <TestComponent hasUnsavedChanges={hasUnsavedChanges} />;
    };

    render(
      <MemoryRouter initialEntries={['/current']}>
        <RouterConsumer hasUnsavedChanges />
      </MemoryRouter>,
    );

    // Call navigator.push while dirty
    act(() => {
      capturedNavigator?.push('/target');
    });

    expect(screen.getByTestId('modal-state')).toHaveTextContent('open');

    // Confirm discard
    await user.click(screen.getByTestId('confirm-discard'));
    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
  });

  it('intercepts history popstate navigation and prompts for confirmation', () => {
    render(
      <MemoryRouter initialEntries={['/page1', '/page2']}>
        <TestComponent hasUnsavedChanges />
      </MemoryRouter>,
    );

    const popEvent = new PopStateEvent('popstate', { bubbles: true, cancelable: true });
    act(() => {
      window.dispatchEvent(popEvent);
    });

    expect(screen.getByTestId('modal-state')).toHaveTextContent('open');
    expect(screen.getByTestId('discard-changes-modal')).toBeInTheDocument();
  });

  it('allows bypassing prompt via bypassNavigation when dirty', async () => {
    const user = userEvent.setup();
    const onNavigate = jest.fn();

    render(
      <MemoryRouter>
        <TestComponent hasUnsavedChanges onNavigate={onNavigate} />
      </MemoryRouter>,
    );

    await user.click(screen.getByTestId('bypass-action-button'));

    expect(screen.getByTestId('modal-state')).toHaveTextContent('closed');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('registers beforeunload handler when dirty and prevents default', () => {
    const { rerender } = render(
      <MemoryRouter>
        <TestComponent />
      </MemoryRouter>,
    );

    const cleanEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);

    rerender(
      <MemoryRouter>
        <TestComponent hasUnsavedChanges />
      </MemoryRouter>,
    );

    const dirtyEvent = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });
});
