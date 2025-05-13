import { ResponseBody } from '~/shared/api/types';

export const mockBFFResponse = <T>(data: T): ResponseBody<T> => ({
  data,
});
