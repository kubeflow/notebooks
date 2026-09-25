import React, { useMemo, useState } from 'react';
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
import { MenuToggleProps } from '@patternfly/react-core/dist/esm/components/MenuToggle';
import { DetailsLoadingState } from '~/app/components/DetailsLoadingState';
import { ResourcesContainerResourceUsage, ResourceQuantity } from '~/generated/data-contracts';
import {
  formatResourceValue,
  RESOURCE_DISPLAY_NAMES,
  ResourceType,
} from '~/shared/utilities/WorkspaceUtils';

interface WorkspaceResourceCardsProps {
  containerNames: string[];
  containers: Record<string, ResourcesContainerResourceUsage>;
  loaded: boolean;
  error?: Error;
  isPaused: boolean;
}

const asString = (value: ResourceQuantity | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return value as unknown as string;
};

const isKnownResourceType = (key: string): key is ResourceType => key === 'cpu' || key === 'memory';

const NANOCORES_PER_MILLICORE = 1_000_000;
const NANOCORES_PER_CORE = 1_000_000_000;

const formatCpuUsage = (value: string): string => {
  if (!value.endsWith('n')) {
    return formatResourceValue(value, 'cpu');
  }

  const nanocores = Number(value.slice(0, -1));

  if (!Number.isFinite(nanocores)) {
    return formatResourceValue(value, 'cpu');
  }

  return nanocores >= NANOCORES_PER_CORE
    ? `${nanocores / NANOCORES_PER_CORE} Cores`
    : `${nanocores / NANOCORES_PER_MILLICORE} Millicores`;
};

const formatValue = (key: string, value: ResourceQuantity | undefined): string => {
  const str = asString(value);
  return formatResourceValue(str, isKnownResourceType(key) ? key : undefined);
};

const formatUsageValue = (key: string, value: string | undefined): string => {
  if (value === undefined) {
    return '-';
  }

  if (key === 'cpu') {
    return formatCpuUsage(value);
  }

  return formatResourceValue(value, isKnownResourceType(key) ? key : undefined);
};

const getResourceKeys = (container: ResourcesContainerResourceUsage): string[] => {
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

const getDisplayName = (key: string): string =>
  (RESOURCE_DISPLAY_NAMES as Record<string, string>)[key] ?? key;

interface ResourceCardProps {
  resourceKey: string;
  container: ResourcesContainerResourceUsage;
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
                formatUsageValue(resourceKey, usageValue)
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
  containerNames,
  containers,
  loaded,
  error,
  isPaused,
}) => {
  const [selectedContainer, setSelectedContainer] = useState<string | undefined>(undefined);

  const activeContainer = selectedContainer ?? containerNames[0];

  const containerData = activeContainer ? containers[activeContainer] : undefined;

  const resourceKeys = useMemo(
    () => (containerData ? getResourceKeys(containerData) : []),
    [containerData],
  );

  if (error && isPaused) {
    return (
      <Content component="small" data-testid="resource-usage-paused">
        This workspace is paused, so resource usage is unavailable.
      </Content>
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
              <span
                id="resource-container-label"
                className="pf-v6-u-font-size-sm pf-v6-u-text-color-subtle"
              >
                Container
              </span>
              <SimpleSelect
                initialOptions={[
                  {
                    content: 'Select a container',
                    value: '',
                    isDisabled: true,
                    selected: !activeContainer,
                  },
                  ...containerNames.map((name) => ({
                    content: name,
                    value: name,
                    selected: name === activeContainer,
                  })),
                ]}
                onSelect={(_ev, selection) => setSelectedContainer(String(selection))}
                // MenuToggleProps doesn't type `data-testid`, but MenuToggle spreads unknown
                // props onto the underlying <button>, so it renders correctly.
                toggleProps={
                  {
                    'aria-labelledby': 'resource-container-label',
                    id: 'resource-container-select',
                    'data-testid': 'resource-container-select',
                  } as MenuToggleProps
                }
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
                <ResourceCard key={key} resourceKey={key} container={containerData} />
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
