import { mockModArchResponse } from 'mod-arch-core';
import { editWorkspaceKind } from '~/__tests__/cypress/cypress/pages/workspaceKinds/editWorkspaceKind';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import {
  buildMockNamespace,
  buildMockWorkspaceKind,
  buildMockWorkspaceKindUpdate,
} from '~/shared/mock/mockBuilder';
import type { WorkspacekindsWorkspaceKindUpdate, V1ResourceList } from '~/generated/data-contracts';

const setup = (limits: Record<string, string> = {}, requests: Record<string, string> = {}) => {
  const kind = buildMockWorkspaceKind({ name: 'resource-kind' });
  const update = buildMockWorkspaceKindUpdate(kind);
  const configs = update.podTemplate.options.podConfig.values;
  configs[0].spec.resources = {
    requests: requests as unknown as V1ResourceList,
    limits: limits as unknown as V1ResourceList,
  };
  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([buildMockNamespace({ name: 'default' })]),
  ).as('namespaces');
  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds/:kind',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: kind.name } },
    mockModArchResponse(update),
  ).as('kind');
  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([kind]),
  ).as('kinds');
  cy.interceptApi(
    'GET /api/:apiVersion/workspaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([]),
  ).as('workspaces');
  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: 'default' } },
    mockModArchResponse([]),
  ).as('namespaceWorkspaces');
  cy.interceptApi(
    'PUT /api/:apiVersion/workspacekinds/:kind',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, kind: kind.name } },
    mockModArchResponse(update),
  ).as('saveKind');
  editWorkspaceKind.visit(kind.name);
  cy.wait('@kind');
  editWorkspaceKind.expandPodConfigSection();
  return configs;
};

const editFirstConfig = () => {
  editWorkspaceKind.clickPodConfigTableRowKebab(0);
  editWorkspaceKind.clickEditPodConfig();
  editWorkspaceKind.expandResources();
};

const assertSavedLimits = (
  expected: Record<string, string>,
  requests: Record<string, string> = {},
) => {
  editWorkspaceKind.clickSubmit();
  cy.wait('@saveKind').then(({ request }) => {
    const { data: body } = request.body as { data: WorkspacekindsWorkspaceKindUpdate };
    const config = body.podTemplate.options.podConfig.values.find((value) =>
      Object.keys(expected).every((key) => value.spec.resources?.limits?.[key] === expected[key]),
    );
    expect(config, 'saved configuration').not.to.equal(undefined);
    expect(config?.spec.resources?.requests ?? {}).to.deep.equal(requests);
  });
};

describe('WorkspaceKind pod resource requests and limits', () => {
  it('creates and edits independent CPU and memory limits without adding requests', () => {
    const configs = setup();
    editWorkspaceKind.clickAddConfigButton();
    editWorkspaceKind.typePodConfigId('limits-only');
    editWorkspaceKind.typePodConfigDisplayName('Limits only');
    editWorkspaceKind.expandResources();
    editWorkspaceKind.toggleResource('cpu-limit');
    editWorkspaceKind.toggleResource('memory-limit');
    editWorkspaceKind.setResourceValue('CPU limit', '2');
    editWorkspaceKind.setResourceValue('Memory limit', '512');
    editWorkspaceKind.assertResourceToggle('cpu-request', false);
    editWorkspaceKind.assertResourceToggle('memory-request', false);
    editWorkspaceKind.submitPodConfigModal();
    editWorkspaceKind.clickPodConfigTableRowKebab(configs.length);
    editWorkspaceKind.clickEditPodConfig();
    editWorkspaceKind.expandResources();
    editWorkspaceKind.assertResourceValue('CPU limit', '2');
    editWorkspaceKind.assertResourceValue('Memory limit', '512');
    editWorkspaceKind.toggleResource('cpu-request');
    editWorkspaceKind.toggleResource('cpu-request');
    editWorkspaceKind.assertResourceValue('CPU limit', '2');
    editWorkspaceKind.submitPodConfigModal();
    assertSavedLimits({ cpu: '2', memory: '512Mi' });
  });

  it('preserves existing CPU, memory and GPU limits on edit and save', () => {
    const limits = { cpu: '500m', memory: '1Gi', 'nvidia.com/gpu': '2' };
    setup(limits);
    editFirstConfig();
    editWorkspaceKind.assertResourceToggle('cpu-limit', true);
    editWorkspaceKind.assertResourceToggle('memory-limit', true);
    editWorkspaceKind.assertResourceToggle('cpu-request', false);
    editWorkspaceKind.assertResourceToggle('memory-request', false);
    editWorkspaceKind.assertResourceValue('nvidia.com/gpu limit', '2');
    editWorkspaceKind.submitPodConfigModal();
    assertSavedLimits(limits);
  });

  it('classifies extended resources as the name changes and flags unknown names', () => {
    setup();
    editFirstConfig();
    editWorkspaceKind.addCustomResource();
    editWorkspaceKind.assertCustomRequestVisible();
    editWorkspaceKind.setCustomResourceName('device');
    editWorkspaceKind.assertResourceError('valid domain prefix');
    editWorkspaceKind.assertPodConfigSaveEnabled(false);
    editWorkspaceKind.setCustomResourceName('google.com/tpu');
    editWorkspaceKind.assertCustomLimitOnly();
    editWorkspaceKind.setResourceValue('google.com/tpu limit', '0.5');
    editWorkspaceKind.assertResourceError('whole number');
    editWorkspaceKind.assertPodConfigSaveEnabled(false);
    editWorkspaceKind.setResourceValue('google.com/tpu limit', '2');
    editWorkspaceKind.setCustomResourceName('');
    editWorkspaceKind.assertCustomRequestVisible();
    editWorkspaceKind.setCustomResourceName('google.com/tpu');
    editWorkspaceKind.submitPodConfigModal();
    assertSavedLimits({ 'google.com/tpu': '2' });
  });

  [true, false].forEach((hasLimit) => {
    it(`preserves ephemeral storage requests with${hasLimit ? '' : 'out'} a limit`, () => {
      const limits: Record<string, string> = hasLimit ? { 'ephemeral-storage': '4Gi' } : {};
      const requests = { 'ephemeral-storage': '1Gi' };
      setup(limits, requests);
      editFirstConfig();
      editWorkspaceKind.assertCustomRequestVisible();
      editWorkspaceKind.assertResourceValue('Custom resource request', '1');
      if (hasLimit) {
        editWorkspaceKind.setResourceValue('Custom resource request', '5');
        editWorkspaceKind.assertResourceError('request must not exceed');
        editWorkspaceKind.assertPodConfigSaveEnabled(false);
        editWorkspaceKind.setResourceValue('Custom resource request', '1');
      }
      editWorkspaceKind.submitPodConfigModal();
      assertSavedLimits(limits, requests);
    });
  });

  // cspell:ignore hugepages
  it('edits huge pages as byte quantities and saves a limit only', () => {
    setup({ 'hugepages-2Mi': '80Mi' });
    editFirstConfig();
    editWorkspaceKind.assertCustomLimitOnly();
    editWorkspaceKind.assertResourceValue('hugepages-2Mi limit', '80');
    editWorkspaceKind.submitPodConfigModal();
    assertSavedLimits({ 'hugepages-2Mi': '80Mi' });
  });

  it('edits only the GPU limit and rejects invalid counts', () => {
    setup();
    editFirstConfig();
    editWorkspaceKind.addGpuResource();
    editWorkspaceKind.assertGpuLimitOnly();
    editWorkspaceKind.assertResourceValue('nvidia.com/gpu limit', '1');
    editWorkspaceKind.assertPodConfigSaveEnabled(true);
    editWorkspaceKind.setResourceValue('nvidia.com/gpu limit', '2');
    editWorkspaceKind.assertPodConfigSaveEnabled(true);
    editWorkspaceKind.setResourceValue('nvidia.com/gpu limit', '0.5');
    editWorkspaceKind.assertResourceError('non-negative whole number');
    editWorkspaceKind.assertPodConfigSaveEnabled(false);
    editWorkspaceKind.setResourceValue('nvidia.com/gpu limit', '-1');
    editWorkspaceKind.assertPodConfigSaveEnabled(false);
    editWorkspaceKind.setResourceValue('nvidia.com/gpu limit', '1');
    editWorkspaceKind.assertGpuLimitOnly();
    editWorkspaceKind.assertPodConfigSaveEnabled(true);
    editWorkspaceKind.submitPodConfigModal();
    assertSavedLimits({ 'nvidia.com/gpu': '1' });
  });
});
