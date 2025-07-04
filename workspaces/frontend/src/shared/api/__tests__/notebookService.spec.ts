import { BFF_API_VERSION } from '~/app/const';
import { restGET, wrapRequest } from '~/shared/api/apiUtils';
import { listNamespaces } from '~/shared/api/notebookService';

const mockRestResponse = { data: {} };
const mockRestPromise = Promise.resolve(mockRestResponse);

jest.mock('~/shared/api/apiUtils', () => ({
  restCREATE: jest.fn(() => mockRestPromise),
  restGET: jest.fn(() => mockRestPromise),
  restPATCH: jest.fn(() => mockRestPromise),
  isNotebookResponse: jest.fn(() => true),
  extractNotebookResponse: jest.fn(() => mockRestResponse),
  wrapRequest: jest.fn(() => mockRestPromise),
}));

const wrapRequestMock = jest.mocked(wrapRequest);
const restGETMock = jest.mocked(restGET);
const APIOptionsMock = {};

describe('getNamespaces', () => {
  it('should call restGET and handleRestFailures to fetch namespaces', async () => {
    const response = await listNamespaces(`/api/${BFF_API_VERSION}/namespaces`)(APIOptionsMock);
    expect(response).toEqual(mockRestResponse);
    expect(restGETMock).toHaveBeenCalledTimes(1);
    expect(restGETMock).toHaveBeenCalledWith(
      `/api/${BFF_API_VERSION}/namespaces`,
      `/namespaces`,
      {},
      APIOptionsMock,
    );
    expect(wrapRequestMock).toHaveBeenCalledTimes(1);
    expect(wrapRequestMock).toHaveBeenCalledWith(mockRestPromise);
  });
});
