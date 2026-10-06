import { renderHook } from '~/__tests__/unit/testUtils/hooks';
import { useStableSortedRows } from '~/app/hooks/useStableSortedRows';

interface Item {
  id: string;
  value: number;
}

const getId = (item: Item) => item.id;
const byValueAsc = (a: Item, b: Item) => a.value - b.value;

interface Props {
  items: Item[];
  instantResortKey: string;
  pendingResortTrigger: number;
}

const render = (initialProps: Props) =>
  renderHook(
    (props: Props) =>
      useStableSortedRows(
        props.items,
        getId,
        byValueAsc,
        props.instantResortKey,
        props.pendingResortTrigger,
      ),
    { initialProps },
  );

const baseProps = (overrides: Partial<Props> = {}): Props => ({
  items: [
    { id: 'b', value: 2 },
    { id: 'a', value: 1 },
  ],
  instantResortKey: 'key-1',
  pendingResortTrigger: 0,
  ...overrides,
});

describe('useStableSortedRows', () => {
  it('sorts items on initial render', () => {
    const { result } = render(baseProps());

    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('preserves row order across a background refresh (new items, same keys)', () => {
    const { result, rerender } = render(
      baseProps({
        items: [
          { id: 'a', value: 1 },
          { id: 'b', value: 2 },
        ],
      }),
    );
    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);

    rerender(
      baseProps({
        items: [
          { id: 'a', value: 10 },
          { id: 'b', value: 2 },
        ],
      }),
    );

    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('appends newly-added items to the end instead of inserting them in sorted position', () => {
    const { result, rerender } = render(
      baseProps({
        items: [
          { id: 'a', value: 1 },
          { id: 'b', value: 5 },
        ],
      }),
    );

    rerender(
      baseProps({
        items: [
          { id: 'a', value: 1 },
          { id: 'b', value: 5 },
          { id: 'c', value: 2 },
        ],
      }),
    );

    expect(result.current.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('drops items that are no longer present', () => {
    const { result, rerender } = render(
      baseProps({
        items: [
          { id: 'a', value: 1 },
          { id: 'b', value: 2 },
          { id: 'c', value: 3 },
        ],
      }),
    );

    rerender(
      baseProps({
        items: [
          { id: 'a', value: 1 },
          { id: 'c', value: 3 },
        ],
      }),
    );

    expect(result.current.map((item) => item.id)).toEqual(['a', 'c']);
  });

  it('re-sorts immediately when instantResortKey changes, even if items stayed the same', () => {
    const items = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];
    const { result, rerender } = render(baseProps({ items, instantResortKey: 'key-1' }));
    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);

    // Simulate the data having drifted while frozen (no background refresh happened here, but
    // proves the hook doesn't require an items change to honor an explicit sort/filter/page
    // action) by swapping values alongside the key change.
    rerender(
      baseProps({
        items: [
          { id: 'a', value: 10 },
          { id: 'b', value: 2 },
        ],
        instantResortKey: 'key-2',
      }),
    );

    expect(result.current.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('does not resort immediately when pendingResortTrigger changes with no new data yet', () => {
    // Same array reference across renders simulates "no new data has arrived" — a real fetch
    // always produces a brand-new array/object references, so reference equality is how the
    // hook (and this test) distinguishes "no new data" from "new data".
    const items = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];

    const { result, rerender } = render(baseProps({ items, pendingResortTrigger: 0 }));
    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);

    // "Refresh" clicked: trigger bumps, but items haven't changed yet (fetch still in flight).
    rerender(baseProps({ items, pendingResortTrigger: 1 }));

    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('resorts once the pending trigger is consumed by the next items update', () => {
    const initialItems = [
      { id: 'a', value: 1 },
      { id: 'b', value: 2 },
    ];
    const { result, rerender } = render(
      baseProps({ items: initialItems, pendingResortTrigger: 0 }),
    );

    // Click "Refresh" — no new data yet (same item references), so order stays put.
    rerender(baseProps({ items: initialItems, pendingResortTrigger: 1 }));
    expect(result.current.map((item) => item.id)).toEqual(['a', 'b']);

    // The fetch triggered by that click lands as a genuinely new array, values swapped.
    const fetchedItems = [
      { id: 'a', value: 10 },
      { id: 'b', value: 2 },
    ];
    rerender(baseProps({ items: fetchedItems, pendingResortTrigger: 1 }));

    expect(result.current.map((item) => item.id)).toEqual(['b', 'a']);

    // A later ordinary background poll (new array, same values, no new trigger) freezes again.
    rerender(
      baseProps({
        items: [
          { id: 'a', value: 1 },
          { id: 'b', value: 2 },
        ],
        pendingResortTrigger: 1,
      }),
    );

    expect(result.current.map((item) => item.id)).toEqual(['b', 'a']);
  });
});
