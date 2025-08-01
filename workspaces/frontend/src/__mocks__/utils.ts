interface Envelope<T> {
  data: T;
}

export const mockBFFResponse = <T>(data: T): Envelope<T> => ({
  data,
});
