import { FetchState, FetchStateCallbackPromise, useFetchState } from 'mod-arch-core';
import { useCallback } from 'react';
import { useNotebookAPI } from '~/app/hooks/useNotebookAPI';
import { OptionsPodTemplateOptions } from '~/generated/data-contracts';

const usePodTemplateOptionsListValues = (args: {
  kindName: string | undefined;
  namespace: string | undefined;
  imageId: string | undefined;
}): FetchState<OptionsPodTemplateOptions | null> => {
  const { kindName, namespace, imageId } = args;
  const { api, apiAvailable } = useNotebookAPI();

  const call = useCallback<
    FetchStateCallbackPromise<OptionsPodTemplateOptions | null>
  >(async () => {
    if (!apiAvailable || !kindName) {
      return Promise.reject(new Error('API not yet available'));
    }
    const envelope = await api.workspaceKinds.podTemplateOptionsListValues(kindName, {
      data: {
        context: {
          namespace: namespace ? { name: namespace } : undefined,
          imageConfig: imageId ? { id: imageId } : undefined,
        },
      },
    });
    return envelope.data;
  }, [api, apiAvailable, kindName, namespace, imageId]);

  return useFetchState(call, null, { initialPromisePurity: true });
};

export default usePodTemplateOptionsListValues;
