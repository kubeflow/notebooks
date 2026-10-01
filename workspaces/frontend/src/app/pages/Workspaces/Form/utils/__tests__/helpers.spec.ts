import { generate } from 'random-words';
import {
  validateName,
  MAX_WORKSPACE_NAME_LENGTH,
  validateDisplayName,
  MAX_DISPLAY_NAME_LENGTH,
  slugifyDisplayName,
  generateResourceNameBase,
  generateResourceName,
  getResourceNameCriteria,
} from '~/app/pages/Workspaces/Form/helpers';

jest.mock('random-words', () => ({
  generate: jest.fn(),
}));

const mockGenerate = generate as jest.Mock;

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

  it.each(['foo..bar', 'foo.-bar', 'foo-.bar'])(
    'should reject "%s" as an invalid DNS subdomain even though it passes the overall start/end check',
    (name) => {
      const result = validateName(name);

      expect(result).toEqual(
        'Each "."-separated segment must start and end with an alphanumeric character',
      );
    },
  );

  it('should accept multiple valid dot-separated segments', () => {
    expect(validateName('foo.bar.baz-1')).toEqual(null);
  });
});

describe('Validate Display Name', () => {
  it('should not be empty', () => {
    expect(validateDisplayName('')).toEqual('Value is required');
    expect(validateDisplayName('   ')).toEqual('Value is required');
  });

  it(`should be less than ${MAX_DISPLAY_NAME_LENGTH} characters`, () => {
    const name = 'a'.repeat(MAX_DISPLAY_NAME_LENGTH + 1);

    expect(validateDisplayName(name)).toEqual(
      `Must be no more than ${MAX_DISPLAY_NAME_LENGTH} characters`,
    );
  });

  const DISALLOWED_CHARS_MESSAGE =
    'Only letters (any language), numbers, spaces, and the characters - _ . , \' " : ? ! @ # % ^ * ( ) ~ + / are allowed';

  it('should allow every character in the allowlist in a single pass', () => {
    expect(validateDisplayName('abcXYZ019-_.,\'":?!@#%^*()~+/ ')).toEqual(null);
  });

  it('should allow a realistic international display name', () => {
    // cspell:disable-next-line
    expect(validateDisplayName("José's Café (北京)")).toEqual(null);
  });

  it.each([
    ['hyphen', '-'],
    ['underscore', '_'],
    ['dot', '.'],
    ['comma', ','],
    ['single quote', "'"],
    ['double quote', '"'],
    ['colon', ':'],
    ['question mark', '?'],
    ['exclamation mark', '!'],
    ['at sign', '@'],
    ['hash', '#'],
    ['percent', '%'],
    ['caret', '^'],
    ['asterisk', '*'],
    ['open parenthesis', '('],
    ['close parenthesis', ')'],
    ['tilde', '~'],
    ['plus', '+'],
    ['forward slash', '/'],
    ['accented Latin letter', 'é'],
    ['CJK letter', '北'],
    ['Cyrillic letter', 'Б'],
    ['fullwidth digit', '１'],
  ])('should accept the allowed %s character', (_label, char) => {
    expect(validateDisplayName(`a${char}b`)).toEqual(null);
  });

  it.each([
    ['control character', '\u0000'],
    ['semicolon', ';'],
    ['ampersand', '&'],
    ['dollar sign', '$'],
    ['equals sign', '='],
    ['open square bracket', '['],
    ['close square bracket', ']'],
    ['open curly brace', '{'],
    ['close curly brace', '}'],
    ['less than', '<'],
    ['greater than', '>'],
    ['backtick', '`'],
    ['backslash', '\\'],
    ['pipe', '|'],
    ['non-breaking space', '\u00A0'],
    ['tab', '\t'],
    ['newline', '\n'],
    ['emoji', '😀'],
    ['copyright symbol', '©'],
  ])('should reject the disallowed %s character', (_label, char) => {
    expect(validateDisplayName(`a${char}b`)).toEqual(DISALLOWED_CHARS_MESSAGE);
  });
});

describe('slugifyDisplayName', () => {
  it('should lowercase and hyphenate spaces', () => {
    expect(slugifyDisplayName('My Workspace')).toEqual('my-workspace');
  });

  it('should transliterate accented Latin letters instead of dropping them', () => {
    expect(slugifyDisplayName('café naïve')).toEqual('cafe-naive');
  });

  it('should drop non-Latin scripts rather than romanizing them', () => {
    expect(slugifyDisplayName('北京')).toEqual('');
  });

  it('should drop underscores by converting them to dashes, and drop other punctuation', () => {
    expect(slugifyDisplayName('My_Workspace')).toEqual('my-workspace');
    expect(slugifyDisplayName('Hello, World!!')).toEqual('hello-world');
  });

  it('should preserve dots and not collapse repeated separators', () => {
    expect(slugifyDisplayName('foo.bar')).toEqual('foo.bar');
    expect(slugifyDisplayName('  --Foo--Bar--  ')).toEqual('foo--bar');
  });

  it('should trim leading and trailing dashes and dots but keep them in the middle', () => {
    expect(slugifyDisplayName('--.foo.bar.--')).toEqual('foo.bar');
  });

  it('should return an empty string when nothing allowed remains', () => {
    expect(slugifyDisplayName('😀😀')).toEqual('');
    expect(slugifyDisplayName('...')).toEqual('');
  });
});

describe('generateResourceNameBase', () => {
  it('should derive a slug from an alphanumeric display name', () => {
    expect(generateResourceNameBase('My Workspace')).toEqual('my-workspace');
  });

  it('should fall back to random words when the display name has no alphanumeric characters', () => {
    mockGenerate.mockReturnValue(['apple', 'mango']);

    const result = generateResourceNameBase('😀😀');

    expect(result).toEqual('apple-mango');
    expect(mockGenerate).toHaveBeenCalledWith({ exactly: 2, minLength: 5, maxLength: 7 });
  });

  it('should fall back to random words when the slug would be an invalid DNS subdomain', () => {
    mockGenerate.mockReturnValue(['apple', 'mango']);

    // "foo..bar" converts to itself (dots are preserved) but is not a valid DNS
    // subdomain, so it must not be accepted as-is.
    const result = generateResourceNameBase('foo..bar');

    expect(result).toEqual('apple-mango');
  });
});

describe('generateResourceName', () => {
  it('should append a 4-character hash to the derived base and be a valid resource name', () => {
    const result = generateResourceName('My Workspace');

    expect(result).toMatch(/^my-workspace-[a-z0-9]{4}$/);
    expect(validateName(result)).toEqual(null);
  });

  it('should truncate long display names so the result stays within the max length', () => {
    const result = generateResourceName('a'.repeat(100));

    expect(result.length).toBeLessThanOrEqual(MAX_WORKSPACE_NAME_LENGTH);
    expect(validateName(result)).toEqual(null);
  });

  it('should use a random word fallback name that is still a valid resource name', () => {
    mockGenerate.mockReturnValue(['apple', 'mango']);

    const result = generateResourceName('😀😀');

    expect(result).toMatch(/^apple-mango-[a-z0-9]{4}$/);
    expect(validateName(result)).toEqual(null);
  });
});

describe('getResourceNameCriteria', () => {
  const isValid = (name: string, key: string) =>
    getResourceNameCriteria(name).find((c) => c.key === key)?.isValid;

  it('should mark all criteria invalid for an empty name', () => {
    expect(getResourceNameCriteria('')).toEqual([
      { key: 'length', label: expect.any(String), isValid: false },
      { key: 'chars', label: expect.any(String), isValid: false },
      { key: 'start', label: expect.any(String), isValid: false },
      { key: 'end', label: expect.any(String), isValid: false },
      { key: 'segments', label: expect.any(String), isValid: false },
    ]);
  });

  it('should mark all criteria valid for a fully valid name', () => {
    const criteria = getResourceNameCriteria('my-workspace.v1');
    expect(criteria.every((c) => c.isValid)).toBe(true);
  });

  it('should flag length only when over the max', () => {
    const name = 'a'.repeat(MAX_WORKSPACE_NAME_LENGTH + 1);
    expect(isValid(name, 'length')).toBe(false);
    expect(isValid(name, 'chars')).toBe(true);
  });

  it('should flag chars for uppercase or disallowed characters', () => {
    expect(isValid('MyWorkspace', 'chars')).toBe(false);
    expect(isValid('my_workspace!', 'chars')).toBe(false);
  });

  it('should flag start when the name begins with a hyphen', () => {
    expect(isValid('-my-workspace', 'start')).toBe(false);
    expect(isValid('-my-workspace', 'end')).toBe(true);
  });

  it('should flag end when the name ends with a hyphen', () => {
    expect(isValid('my-workspace-', 'end')).toBe(false);
    expect(isValid('my-workspace-', 'start')).toBe(true);
  });

  it('should flag segments for an invalid dot-separated label even when start/end/chars are fine', () => {
    expect(isValid('foo..bar', 'segments')).toBe(false);
    expect(isValid('foo..bar', 'start')).toBe(true);
    expect(isValid('foo..bar', 'end')).toBe(true);
    expect(isValid('foo..bar', 'chars')).toBe(true);
  });

  it('should match validateName overall pass/fail for arbitrary inputs', () => {
    const names = [
      'my-workspace',
      'Invalid',
      '-bad',
      'bad-',
      'a'.repeat(64),
      '',
      'foo..bar',
      'foo.-bar',
      'foo-.bar',
      'foo.bar.baz',
    ];
    names.forEach((name) => {
      const allValid = getResourceNameCriteria(name).every((c) => c.isValid);
      expect(allValid).toBe(validateName(name) === null);
    });
  });
});
