import { ResponseBody } from '~/app/types';

export const mockBFFResponse = <T>(data: T): ResponseBody<T> => ({
  data,
});
