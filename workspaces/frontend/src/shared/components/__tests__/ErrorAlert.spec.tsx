import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ApiErrorEnvelope, FieldErrorType } from '~/generated/data-contracts';
import { ErrorAlert } from '~/shared/components/ErrorAlert';

describe('ErrorAlert', () => {
  it('renders a plain string error message', () => {
    render(
      <ErrorAlert title="Failed operation" content="Something went wrong" testId="test-error" />,
    );

    expect(screen.getByText('Failed operation')).toBeInTheDocument();
    expect(screen.getByText('Error: Something went wrong')).toBeInTheDocument();
  });

  it('formats 422 validation errors into distinct list items', () => {
    const errorEnvelope: ApiErrorEnvelope = {
      error: {
        code: '422',
        message: 'request body was invalid',
        cause: {
          // eslint-disable-next-line camelcase
          validation_errors: [
            {
              type: FieldErrorType.ErrorTypeInvalid,
              field: 'spec.podTemplate.containerSecurityContext',
              message:
                'Invalid value: null: unknown field "spec.podTemplate.containerSecurityContext"',
            },
            {
              type: FieldErrorType.ErrorTypeInvalid,
              field: 'spec.podTemplate.extraEnv',
              message: 'Invalid value: null: unknown field "spec.podTemplate.extraEnv"',
            },
          ],
        },
      },
    };

    render(
      <ErrorAlert
        title="Failed to create workspace kind"
        content={errorEnvelope}
        testId="workspace-kind-error"
      />,
    );

    expect(screen.getByText('Failed to create workspace kind')).toBeInTheDocument();

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(2);
    expect(listItems[0]).toHaveTextContent('spec.podTemplate.containerSecurityContext');
    expect(listItems[1]).toHaveTextContent('spec.podTemplate.extraEnv');
  });
});
