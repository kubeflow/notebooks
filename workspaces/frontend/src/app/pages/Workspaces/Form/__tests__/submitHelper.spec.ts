import { EMPTY_FORM_DATA } from '~/app/hooks/useWorkspaceFormData';
import { submitFormData } from '~/app/pages/Workspaces/Form/submitHelper';
import { WorkspaceFormData, WorkspaceFormMode } from '~/app/types';
import { NotebookApis } from '~/shared/api/notebookApi';
import { buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';

const buildFormData = () => ({
  ...EMPTY_FORM_DATA,
  revision: 'opaque/revision:17',
  originalDisplayName: 'Research notebook',
  kind: buildMockWorkspaceKind({ name: 'jupyterlab' }),
  imageConfig: 'image-1',
  podConfig: 'pod-1',
  podMetadata: {
    labels: { team: 'research' },
    annotations: { 'example.org/owner': 'notebooks' },
    expanded: true,
  },
  selected: true,
  properties: {
    name: 'research-notebook',
    displayName: 'Research notebook',
    homeVolume: {
      pvcName: 'home-pvc',
      mountPath: '/home/jovyan',
      readOnly: false,
      isAttached: true,
    },
    volumes: [
      {
        pvcName: 'data-pvc',
        mountPath: '/data',
        readOnly: false,
        isAttached: true,
        selected: true,
      },
      { pvcName: 'readonly-pvc', mountPath: '/readonly', readOnly: true, isAttached: false },
    ],
    secrets: [
      {
        secretName: 'credentials',
        mountPath: '/secrets',
        defaultMode: 0,
        isAttached: true,
        editing: true,
      },
    ],
  },
});

const expectedPodTemplate = {
  podMetadata: {
    labels: { team: 'research' },
    annotations: { 'example.org/owner': 'notebooks' },
  },
  options: { imageConfig: 'image-1', podConfig: 'pod-1' },
  volumes: {
    home: 'home-pvc',
    data: [
      { pvcName: 'data-pvc', mountPath: '/data', readOnly: false },
      { pvcName: 'readonly-pvc', mountPath: '/readonly', readOnly: true },
    ],
    secrets: [{ secretName: 'credentials', mountPath: '/secrets', defaultMode: 0 }],
  },
};

describe('submitFormData', () => {
  const createWorkspace = jest.fn();
  const updateWorkspace = jest.fn();
  const api = { workspaces: { createWorkspace, updateWorkspace } } as unknown as NotebookApis;

  beforeEach(() => {
    jest.clearAllMocks();
    createWorkspace.mockResolvedValue({ data: {} });
    updateWorkspace.mockResolvedValue({ data: {} });
  });

  it.each<WorkspaceFormMode>(['create', 'update'])(
    'constructs only API fields for %s without mutating form data',
    async (mode) => {
      const data = buildFormData();
      const before = JSON.stringify(data);

      await submitFormData({ mode, data, api, namespace: 'team-a' });

      const payload = {
        displayName: 'Research notebook',
        paused: false,
        podTemplate: expectedPodTemplate,
      };
      if (mode === 'create') {
        expect(createWorkspace).toHaveBeenCalledWith('team-a', {
          data: { ...payload, name: 'research-notebook', kind: 'jupyterlab' },
        });
        expect(updateWorkspace).not.toHaveBeenCalled();
      } else {
        expect(updateWorkspace).toHaveBeenCalledWith('team-a', 'research-notebook', {
          data: { ...payload, revision: 'opaque/revision:17' },
        });
        expect(createWorkspace).not.toHaveBeenCalled();
      }
      expect(JSON.stringify(data)).toBe(before);
    },
  );

  it.each([undefined, '', 'Research notebook'])(
    'preserves an untouched display name of %s on update',
    async (originalDisplayName) => {
      const data = buildFormData();
      await submitFormData({
        mode: 'update',
        data: {
          ...data,
          originalDisplayName,
          properties: {
            ...data.properties,
            displayName: originalDisplayName || data.properties.name,
          },
        },
        api,
        namespace: 'team-a',
      });
      expect(updateWorkspace.mock.calls[0][2].data.displayName).toBe(originalDisplayName);
    },
  );

  it('submits an edited display name and the original revision', async () => {
    const data = buildFormData();
    data.properties.displayName = 'Renamed notebook';
    await submitFormData({ mode: 'update', data, api, namespace: 'team-a' });
    expect(updateWorkspace.mock.calls[0][2].data).toEqual({
      displayName: 'Renamed notebook',
      paused: false,
      podTemplate: expectedPodTemplate,
      revision: 'opaque/revision:17',
    });
  });

  it.each<WorkspaceFormMode>(['create', 'update'])(
    'keeps optional attachment fields absent for %s',
    async (mode) => {
      const data: WorkspaceFormData = {
        ...buildFormData(),
        properties: {
          ...EMPTY_FORM_DATA.properties,
          name: 'notebook',
          volumes: [{ pvcName: 'data', mountPath: '/data', isAttached: true }],
          secrets: [{ secretName: 'secret', mountPath: '/secret', isAttached: true }],
        },
      };
      await submitFormData({ mode, data, api, namespace: 'team-a' });
      const payload =
        mode === 'create' ? createWorkspace.mock.calls[0][1] : updateWorkspace.mock.calls[0][2];
      expect(JSON.parse(JSON.stringify(payload.data.podTemplate.volumes))).toEqual({
        data: [{ pvcName: 'data', mountPath: '/data' }],
        secrets: [{ secretName: 'secret', mountPath: '/secret' }],
      });
    },
  );

  it('uses empty metadata and omits an empty display name when creating', async () => {
    const data = {
      ...EMPTY_FORM_DATA,
      kind: buildMockWorkspaceKind({}),
      imageConfig: 'image-1',
      podConfig: 'pod-1',
    };
    await submitFormData({ mode: 'create', data, api, namespace: 'team-a' });
    const payload = createWorkspace.mock.calls[0][1].data;
    expect(payload.podTemplate.podMetadata).toEqual({ labels: {}, annotations: {} });
    expect(payload.displayName).toBeUndefined();
    expect(payload).not.toHaveProperty('revision');
  });

  it.each(['kind', 'imageConfig', 'podConfig'] as const)(
    'rejects missing %s before calling the API',
    (field) => {
      const data = { ...buildFormData(), [field]: undefined };
      expect(() => submitFormData({ mode: 'update', data, api, namespace: 'team-a' })).toThrow(
        'Invalid form data',
      );
      expect(createWorkspace).not.toHaveBeenCalled();
      expect(updateWorkspace).not.toHaveBeenCalled();
    },
  );

  it.each<WorkspaceFormMode>(['create', 'update'])(
    'propagates %s failures without retrying',
    async (mode) => {
      const error = new Error('Request rejected');
      createWorkspace.mockRejectedValue(error);
      updateWorkspace.mockRejectedValue(error);
      await expect(
        submitFormData({ mode, data: buildFormData(), api, namespace: 'team-a' }),
      ).rejects.toBe(error);
      expect(mode === 'create' ? createWorkspace : updateWorkspace).toHaveBeenCalledTimes(1);
    },
  );
});
