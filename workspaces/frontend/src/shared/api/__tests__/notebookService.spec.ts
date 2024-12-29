import { restGET } from '~/shared/api/apiUtils';
import { handleRestFailures } from '~/shared/api/errorUtils';
import { getNamespaces } from '~/shared/api/notebookService';
import { BFF_API_VERSION } from '~/app/const';

const mockRestPromise = Promise.resolve({ data: {} });
const mockRestResponse = {};

jest.mock('~/shared/api/apiUtils', () => ({
  restCREATE: jest.fn(() => mockRestPromise),
  restGET: jest.fn(() => mockRestPromise),
  restPATCH: jest.fn(() => mockRestPromise),
  isNotebookResponse: jest.fn(() => true),
}));

jest.mock('~/shared/api/errorUtils', () => ({
  handleRestFailures: jest.fn(() => mockRestPromise),
}));

const handleRestFailuresMock = jest.mocked(handleRestFailures);
const restGETMock = jest.mocked(restGET);
const APIOptionsMock = {};

describe('getNamespaces', () => {
  it('should call restGET and handleRestFailures to fetch namespaces', async () => {
    const response = await getNamespaces(`/api/${BFF_API_VERSION}/namespaces`)(APIOptionsMock);
    expect(response).toEqual(mockRestResponse);
    expect(restGETMock).toHaveBeenCalledTimes(1);
    expect(restGETMock).toHaveBeenCalledWith(
      `/api/${BFF_API_VERSION}/namespaces`,
      `/namespaces`,
      {},
      APIOptionsMock,
    );
    expect(handleRestFailuresMock).toHaveBeenCalledTimes(1);
    expect(handleRestFailuresMock).toHaveBeenCalledWith(mockRestPromise);
  });
});
