import React, { useMemo, useState } from 'react';
import { Alert } from '@patternfly/react-core/dist/esm/components/Alert';
import { Card, CardBody, CardTitle } from '@patternfly/react-core/dist/esm/components/Card';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import {
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from '@patternfly/react-core/dist/esm/components/DescriptionList';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Gallery } from '@patternfly/react-core/dist/esm/layouts/Gallery';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import { SimpleSelect } from '@patternfly/react-templates';
import { DetailsLoadingState } from '~/app/components/DetailsLoadingState';
import {
  MetricsContainerResourceUsage,
  MetricsErrorCode,
  MetricsWorkspaceResourceUsage,
  ResourceQuantity,
} from '~/generated/data-contracts';
import {
  formatResourceValue,
  RESOURCE_DISPLAY_NAMES,
  ResourceType,
} from '~/shared/utilities/WorkspaceUtils';

interface WorkspaceResourceCardsProps {
  resourceUsage: MetricsWorkspaceResourceUsage | null;
  containerNames: string[];
  containers: Record<string, MetricsContainerResourceUsage>;
  loaded: boolean;
  error?: Error;
}

const asString = (value: ResourceQuantity | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return value as unknown as string;
};

const isKnownResourceType = (key: string): key is ResourceType => key === 'cpu' || key === 'memory';

const formatValue = (key: string, value: ResourceQuantity | undefined): string => {
  const str = asString(value);
  return formatResourceValue(str, isKnownResourceType(key) ? key : undefined);
};

const getResourceKeys = (container: MetricsContainerResourceUsage): string[] => {
  const keys = new Set<string>();
  const { requests, limits } = container.resources;
  if (requests) {
    Object.keys(requests).forEach((k) => keys.add(k));
  }
  if (limits) {
    Object.keys(limits).forEach((k) => keys.add(k));
  }
  return Array.from(keys);
};

const getDisplayName = (key: ResourceType): string => RESOURCE_DISPLAY_NAMES[key];

interface ResourceCardProps {
  resourceKey: ResourceType;
  container: MetricsContainerResourceUsage;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resourceKey, container }) => {
  const requestValue = container.resources.requests?.[resourceKey];
  const limitValue = container.resources.limits?.[resourceKey];
  const metrics = container.metricsFromMetricsServer;
  const usageValue = metrics?.usage[resourceKey as keyof typeof metrics.usage] ?? undefined;

  return (
    <Card isCompact data-testid={`resource-card-${resourceKey}`}>
      <CardTitle>
        <Content component={ContentVariants.h3}>{getDisplayName(resourceKey)}</Content>
      </CardTitle>
      <CardBody>
        <DescriptionList isHorizontal isCompact>
          <DescriptionListGroup>
            <DescriptionListTerm>Request</DescriptionListTerm>
            <DescriptionListDescription data-testid={`resource-request-${resourceKey}`}>
              {formatValue(resourceKey, requestValue)}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Limit</DescriptionListTerm>
            <DescriptionListDescription data-testid={`resource-limit-${resourceKey}`}>
              {formatValue(resourceKey, limitValue)}
            </DescriptionListDescription>
          </DescriptionListGroup>
          <DescriptionListGroup>
            <DescriptionListTerm>Usage</DescriptionListTerm>
            <DescriptionListDescription data-testid={`resource-usage-${resourceKey}`}>
              {metrics ? (
                formatValue(resourceKey, usageValue as unknown as ResourceQuantity)
              ) : (
                <Content component="small">
                  <i>Pending</i>
                </Content>
              )}
            </DescriptionListDescription>
          </DescriptionListGroup>
        </DescriptionList>
      </CardBody>
    </Card>
  );
};

export const WorkspaceResourceCards: React.FC<WorkspaceResourceCardsProps> = ({
  resourceUsage,
  containerNames,
  containers,
  loaded,
  error,
}) => {
  const [selectedContainer, setSelectedContainer] = useState<string | undefined>(undefined);

  const activeContainer = selectedContainer ?? containerNames[0];

  const containerData = activeContainer ? containers[activeContainer] : undefined;

  const resourceKeys = useMemo(
    () => (containerData ? getResourceKeys(containerData) : []),
    [containerData],
  );

  if (resourceUsage?.error === MetricsErrorCode.ErrorCodeWorkspaceNotRunning) {
    return (
      <Alert
        variant="info"
        isInline
        title="Workspace is not running"
        data-testid="resource-error-not-running"
      >
        Resource metrics are available only while the workspace is running.
      </Alert>
    );
  }

  if (resourceUsage?.error === MetricsErrorCode.ErrorCodeMetricsAPINotAvailable) {
    return (
      <Alert
        variant="warning"
        isInline
        title="Metrics API not available"
        data-testid="resource-error-no-metrics-api"
      >
        Metrics API is not available on this cluster. Contact your administrator to install
        metrics-server.
      </Alert>
    );
  }

  return (
    <DetailsLoadingState error={error} loaded={loaded}>
      <Stack hasGutter>
        <StackItem>
          <Flex
            direction={{ default: 'row' }}
            justifyContent={{ default: 'justifyContentSpaceBetween' }}
          >
            <FlexItem>
              <span className="pf-v6-c-description-list__term">Resource Utilization</span>
            </FlexItem>
            <FlexItem>
              <SimpleSelect
                initialOptions={[
                  {
                    content: 'Select a container',
                    value: '',
                    isDisabled: true,
                    selected: !selectedContainer,
                  },
                  ...containerNames.map((name) => ({
                    content: name,
                    value: name,
                    selected: name === activeContainer,
                  })),
                ]}
                onSelect={(_ev, selection) => setSelectedContainer(String(selection))}
                toggleProps={{
                  'aria-labelledby': 'resource-container-label',
                  id: 'resource-container-select',
                }}
              />
            </FlexItem>
          </Flex>
        </StackItem>
        {containerData ? (
          <StackItem>
            <Gallery
              hasGutter
              minWidths={{ default: '200px' }}
              data-testid="resource-cards-gallery"
            >
              {resourceKeys.map((key) => (
                <ResourceCard
                  key={key}
                  resourceKey={key as ResourceType}
                  container={containerData}
                />
              ))}
            </Gallery>
          </StackItem>
        ) : (
          <StackItem>
            <Content data-testid="resource-no-containers">
              No container resource data available
            </Content>
          </StackItem>
        )}
      </Stack>
    </DetailsLoadingState>
  );
};
