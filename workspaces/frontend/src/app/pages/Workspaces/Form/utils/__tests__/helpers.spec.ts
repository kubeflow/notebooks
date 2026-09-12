import {
  validateName,
  MAX_WORKSPACE_NAME_LENGTH,
  validateDisplayName,
  MAX_DISPLAY_NAME_LENGTH,
} from '~/app/pages/Workspaces/Form/helpers';

describe('Validate Workspace Name', () => {
  it('should be less than 63 characters', () => {
    const name = 'a'.repeat(64);

    const result = validateName(name);

    expect(result).toEqual(`Must be no more than ${MAX_WORKSPACE_NAME_LENGTH} characters`);
  });

  it('should be alphanumeric characters, "-" or "."', () => {
    const name = 'a-b.c@';

    const result = validateName(name);

    expect(result).toEqual('Only lowercase alphanumeric characters, "-" or "." are allowed');
  });

  it('should start with an alphanumeric character', () => {
    const name = '-a';

    const result = validateName(name);

    expect(result).toEqual('Must start with an alphanumeric character');
  });

  it('should end with an alphanumeric character', () => {
    const name = 'a-';

    const result = validateName(name);

    expect(result).toEqual('Must end with an alphanumeric character');
  });

  it('should not be empty', () => {
    const name = '';

    const result = validateName(name);

    expect(result).toEqual('Value is required');
  });

  it('should be valid', () => {
    const name = 'a-b.c';

    const result = validateName(name);

    expect(result).toEqual(null);
  });
});

describe('Validate Display Name', () => {
  it('should return null when empty or undefined', () => {
    expect(validateDisplayName()).toBeNull();
    expect(validateDisplayName('')).toBeNull();
  });

  it('should allow letters, numbers, spaces, and sensible special characters', () => {
    const valid = 'My Workspace (GPU) - 1_2.3! @#$%^&*;~<>+/\\';
    expect(validateDisplayName(valid)).toBeNull();
  });

  it('should return error when length exceeds 253 characters', () => {
    const longName = 'a'.repeat(254);
    expect(validateDisplayName(longName)).toEqual(
      `Must be no more than ${MAX_DISPLAY_NAME_LENGTH} characters`,
    );
  });

  it('should return error when containing invalid characters', () => {
    expect(validateDisplayName('Workspace 🚀')).toEqual(
      'Only letters, numbers, spaces, and allowed characters (- _ . ! @ # $ % ^ & * ( ) ; ~ < > + / \\) are allowed',
    );
    expect(validateDisplayName('Workspace{curly}')).toEqual(
      'Only letters, numbers, spaces, and allowed characters (- _ . ! @ # $ % ^ & * ( ) ; ~ < > + / \\) are allowed',
    );
  });
});
