import { useMemo, useRef } from 'react';

/**
 * Sorts `items`, preserving row order across background data refreshes and only re-sorting on
 * an explicit user action:
 *  - `instantResortKey` changing (e.g. picking a different sort column/direction, changing a
 *    filter, or changing page) re-sorts immediately, using whatever `items` are already present.
 *  - `pendingResortTrigger` changing (e.g. clicking "Refresh") doesn't resort immediately — the
 *    refetch it kicks off hasn't landed yet — but marks the *next* actual `items` update as one
 *    that should fully re-sort rather than just merge into the existing frozen order.
 *
 * On every other render — including an ordinary background poll tick — the previously committed
 * row order is preserved: removed ids drop out, brand-new ids are appended at the end. Cell
 * content for preserved rows still reflects the latest data; only position stays put.
 */
export function useStableSortedRows<T>(
  items: T[],
  getId: (item: T) => string,
  compare: (a: T, b: T) => number,
  instantResortKey: string,
  pendingResortTrigger: number,
): T[] {
  const lastOrderedIdsRef = useRef<string[] | null>(null);
  const lastInstantKeyRef = useRef<string | null>(null);
  const lastItemsRef = useRef<T[] | null>(null);
  const lastConsumedTriggerRef = useRef(pendingResortTrigger);

  return useMemo(() => {
    const isFirstRun = lastOrderedIdsRef.current === null;
    const itemsChanged = lastItemsRef.current !== items;
    const instantKeyChanged = lastInstantKeyRef.current !== instantResortKey;
    const hasUnconsumedPendingTrigger = lastConsumedTriggerRef.current !== pendingResortTrigger;

    lastItemsRef.current = items;
    lastInstantKeyRef.current = instantResortKey;

    const shouldResort =
      isFirstRun || instantKeyChanged || (hasUnconsumedPendingTrigger && itemsChanged);

    const freshlySorted = [...items].sort(compare);

    if (shouldResort) {
      lastConsumedTriggerRef.current = pendingResortTrigger;
      lastOrderedIdsRef.current = freshlySorted.map(getId);
      return freshlySorted;
    }

    const orderedIds = lastOrderedIdsRef.current ?? [];
    const itemsById = new Map(items.map((item) => [getId(item), item]));
    const knownIds = new Set(orderedIds);

    const preservedOrder = orderedIds
      .filter((id) => itemsById.has(id))
      .map((id) => itemsById.get(id) as T);
    const newItems = freshlySorted.filter((item) => !knownIds.has(getId(item)));

    const stableResult = [...preservedOrder, ...newItems];
    lastOrderedIdsRef.current = stableResult.map(getId);
    return stableResult;
  }, [items, compare, instantResortKey, pendingResortTrigger, getId]);
}
