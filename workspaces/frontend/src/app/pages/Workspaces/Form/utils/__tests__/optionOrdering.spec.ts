import { moveDefaultToFront } from '~/app/pages/Workspaces/Form/utils/optionOrdering';

describe('moveDefaultToFront', () => {
  it('should return unchanged array when defaultId is undefined', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = moveDefaultToFront(options);

    expect(result).toEqual(options);
    expect(result).toBe(options); // Should return the same reference
  });

  it('should return unchanged array when defaultId not found', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = moveDefaultToFront(options, 'nonexistent');

    expect(result).toEqual(options);
    expect(result).toBe(options); // Should return the same reference
  });

  it('should move default from middle to front', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = moveDefaultToFront(options, 'b');

    expect(result).toEqual([{ id: 'b' }, { id: 'a' }, { id: 'c' }]);
  });

  it('should move default from end to front', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = moveDefaultToFront(options, 'c');

    expect(result).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }]);
  });

  it('should return array unchanged when default is already at front', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = moveDefaultToFront(options, 'a');

    expect(result).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
  });

  it('should preserve relative order of non-default items', () => {
    const options = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'c', value: 3 },
      { id: 'd', value: 4 },
    ];

    const result = moveDefaultToFront(options, 'c');

    expect(result).toEqual([
      { id: 'c', value: 3 },
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
      { id: 'd', value: 4 },
    ]);
  });

  it('should not mutate original array', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const original = [...options];

    moveDefaultToFront(options, 'b');

    expect(options).toEqual(original);
  });

  it('should return new array reference when reordering', () => {
    const options = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    const result = moveDefaultToFront(options, 'b');

    expect(result).not.toBe(options);
  });

  it('should handle empty array', () => {
    const options: { id: string }[] = [];

    const result = moveDefaultToFront(options, 'any');

    expect(result).toEqual([]);
    expect(result).toBe(options); // Should return the same reference for empty array
  });

  it('should handle single option array', () => {
    const options = [{ id: 'a' }];

    const result = moveDefaultToFront(options, 'a');

    expect(result).toEqual([{ id: 'a' }]);
  });

  it('should handle single option array when defaultId does not match', () => {
    const options = [{ id: 'a' }];

    const result = moveDefaultToFront(options, 'b');

    expect(result).toEqual([{ id: 'a' }]);
    expect(result).toBe(options);
  });

  it('should be case-sensitive when matching IDs', () => {
    const options = [{ id: 'a' }, { id: 'B' }, { id: 'c' }];

    const result = moveDefaultToFront(options, 'b');

    // Should not find 'b' (lowercase) when 'B' (uppercase) exists
    expect(result).toEqual([{ id: 'a' }, { id: 'B' }, { id: 'c' }]);
    expect(result).toBe(options);
  });

  it('should preserve all properties of objects', () => {
    const options = [
      { id: 'a', displayName: 'Option A', hidden: false },
      { id: 'b', displayName: 'Option B', hidden: true },
      { id: 'c', displayName: 'Option C', hidden: false },
    ];

    const result = moveDefaultToFront(options, 'b');

    expect(result).toEqual([
      { id: 'b', displayName: 'Option B', hidden: true },
      { id: 'a', displayName: 'Option A', hidden: false },
      { id: 'c', displayName: 'Option C', hidden: false },
    ]);
  });

  it('should handle options with duplicate non-id properties', () => {
    const options = [
      { id: 'a', name: 'same' },
      { id: 'b', name: 'same' },
      { id: 'c', name: 'same' },
    ];

    const result = moveDefaultToFront(options, 'c');

    expect(result).toEqual([
      { id: 'c', name: 'same' },
      { id: 'a', name: 'same' },
      { id: 'b', name: 'same' },
    ]);
  });
});
