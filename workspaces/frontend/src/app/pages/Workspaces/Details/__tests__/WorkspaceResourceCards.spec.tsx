import React from 'react';

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import { WorkspaceResourceCards } from '~/app/pages/Workspaces/Details/WorkspaceResourceCards';
import { ResourceQuantity, ResourcesContainerResourceUsage } from '~/generated/data-contracts';

const quantity = (value: string): ResourceQuantity => value as unknown as ResourceQuantity;

const buildContainer = (cpuUsage = '2308487n'): ResourcesContainerResourceUsage => ({
  resources: {
    requests: {
      cpu: quantity('100m'),
      memory: quantity('128Mi'),
    },
    limits: {
      cpu: quantity('2'),
      memory: quantity('1Gi'),
    },
  },
  metricsFromMetricsServer: {
    timestamp: '2026-09-25T12:13:04Z',
    usage: {
      cpu: cpuUsage,
      memory: '83536Ki',
    },
  },
});

const renderResourceCards = (container: ResourcesContainerResourceUsage = buildContainer()) =>
  render(
    <WorkspaceResourceCards
      containerNames={['main']}
      containers={{ main: container }}
      loaded
      isPaused={false}
    />,
  );

describe('WorkspaceResourceCards', () => {
  it('renders configured CPU and memory resources and memory usage', () => {
    renderResourceCards();

    expect(screen.getByTestId('resource-request-cpu')).toHaveTextContent('100 Millicores');
    expect(screen.getByTestId('resource-limit-cpu')).toHaveTextContent('2 Cores');

    expect(screen.getByTestId('resource-request-memory')).toHaveTextContent('128 MiB');
    expect(screen.getByTestId('resource-limit-memory')).toHaveTextContent('1 GiB');

    expect(screen.getByTestId('resource-usage-memory')).toHaveTextContent('83536 KiB');
  });

  it('formats sub-core nanocore CPU usage as millicores', () => {
    renderResourceCards(buildContainer('2308487n'));

    expect(screen.getByTestId('resource-usage-cpu')).toHaveTextContent('2.308487 Millicores');
  });

  it('formats nanocore CPU usage above one core as cores', () => {
    renderResourceCards(buildContainer('1499177218n'));

    expect(screen.getByTestId('resource-usage-cpu')).toHaveTextContent('1.499177218 Cores');
  });

  it('preserves zero CPU usage', () => {
    renderResourceCards(buildContainer('0'));

    expect(screen.getByTestId('resource-usage-cpu')).toHaveTextContent('0 Cores');
  });

  it('preserves millicore CPU usage formatting', () => {
    renderResourceCards(buildContainer('250m'));

    expect(screen.getByTestId('resource-usage-cpu')).toHaveTextContent('250 Millicores');
  });

  it('preserves core CPU usage formatting', () => {
    renderResourceCards(buildContainer('2'));

    expect(screen.getByTestId('resource-usage-cpu')).toHaveTextContent('2 Cores');
  });
});
