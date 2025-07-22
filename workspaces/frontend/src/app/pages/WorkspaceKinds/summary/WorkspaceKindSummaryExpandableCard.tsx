import React, { useMemo } from 'react';
import { Bullseye } from '@patternfly/react-core/dist/esm/layouts/Bullseye';
import { Button } from '@patternfly/react-core/dist/esm/components/Button';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardExpandableContent,
} from '@patternfly/react-core/dist/esm/components/Card';
import { Content, ContentVariants } from '@patternfly/react-core/dist/esm/components/Content';
import { Divider } from '@patternfly/react-core/dist/esm/components/Divider';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Stack, StackItem } from '@patternfly/react-core/dist/esm/layouts/Stack';
import {
  t_global_spacer_md as MediumPadding,
  t_global_font_size_4xl as LargeFontSize,
  t_global_font_weight_heading_bold as BoldFontWeight,
} from '@patternfly/react-tokens';
import { Workspace } from '~/shared/api/backendApiTypes';
import {
  countGpusFromWorkspaces,
  filterIdleWorkspacesWithGpu,
  filterRunningWorkspaces,
  groupWorkspacesByNamespaceAndGpu,
  YesNoValue,
} from '~/shared/utilities/WorkspaceUtils';
import { WorkspaceTableFilteredColumn } from '~/app/components/WorkspaceTable';

const TOP_GPU_CONSUMERS_LIMIT = 2;

interface WorkspaceKindSummaryExpandableCardProps {
  workspaces: Workspace[];
  isExpanded: boolean;
  onExpandToggle: () => void;
  onAddFilter: (filter: WorkspaceTableFilteredColumn) => void;
}

const WorkspaceKindSummaryExpandableCard: React.FC<WorkspaceKindSummaryExpandableCardProps> = ({
  workspaces,
  isExpanded,
  onExpandToggle,
  onAddFilter,
}) => {
  const topGpuConsumersByNamespace = useMemo(
    () =>
      Object.entries(groupWorkspacesByNamespaceAndGpu(workspaces, 'DESC'))
        .filter(([, record]) => record.gpuCount > 0)
        .slice(0, TOP_GPU_CONSUMERS_LIMIT),
    [workspaces],
  );

  return (
    <Card isExpanded={isExpanded}>
      <CardHeader onExpand={onExpandToggle}>
        <CardTitle>
          <Content component={ContentVariants.h2}>Workspaces summary</Content>
        </CardTitle>
      </CardHeader>
      <CardExpandableContent>
        <CardBody>
          <Flex wrap="wrap">
            <SectionFlex title="Total GPUs in use">
              <FlexItem>
                <Content>
                  {countGpusFromWorkspaces(filterRunningWorkspaces(workspaces))} GPUs
                </Content>
              </FlexItem>
              <FlexItem>
                <Content>{`Requested of ${countGpusFromWorkspaces(workspaces)} GPUs`}</Content>
              </FlexItem>
            </SectionFlex>
            <SectionDivider />
            <SectionFlex title="Idle GPU workspaces">
              <FlexItem>
                <Bullseye>
                  <Button
                    variant="link"
                    isInline
                    style={{ fontSize: LargeFontSize.value, fontWeight: BoldFontWeight.value }}
                    onClick={() => {
                      onAddFilter({ columnKey: 'idleGpu', value: YesNoValue.Yes });
                    }}
                  >
                    {filterIdleWorkspacesWithGpu(workspaces).length}
                  </Button>
                </Bullseye>
              </FlexItem>
              <FlexItem>
                <Bullseye>
                  <Content>Idle GPU workspaces</Content>
                </Bullseye>
              </FlexItem>
            </SectionFlex>
            <SectionDivider />
            <SectionFlex title="Top GPU consumer namespaces">
              <FlexItem>
                <Stack hasGutter>
                  {topGpuConsumersByNamespace.length > 0 ? (
                    topGpuConsumersByNamespace.map(([ns, record]) => (
                      <StackItem key={ns}>
                        <NamespaceGpuConsumer
                          namespace={ns}
                          gpuCount={record.gpuCount}
                          onAddFilter={onAddFilter}
                        />
                      </StackItem>
                    ))
                  ) : (
                    <StackItem>
                      <Content>None</Content>
                    </StackItem>
                  )}
                </Stack>
              </FlexItem>
            </SectionFlex>
          </Flex>
        </CardBody>
      </CardExpandableContent>
    </Card>
  );
};

interface SectionFlexProps {
  children: React.ReactNode;
  title: string;
}

const SectionFlex: React.FC<SectionFlexProps> = ({ children, title }) => (
  <FlexItem
    grow={{ default: 'grow' }}
    style={{ padding: MediumPadding.value, alignSelf: 'stretch' }}
  >
    <Flex
      direction={{ default: 'column' }}
      justifyContent={{ default: 'justifyContentSpaceBetween' }}
      style={{ height: '100%' }}
    >
      <FlexItem>
        <Content component={ContentVariants.h3}>{title}</Content>
      </FlexItem>
      {children}
    </Flex>
  </FlexItem>
);

const SectionDivider: React.FC = () => (
  <Divider orientation={{ default: 'vertical' }} inset={{ default: 'insetMd' }} />
);

interface NamespaceConsumerProps {
  namespace: string;
  gpuCount: number;
  onAddFilter: (filter: WorkspaceTableFilteredColumn) => void;
}

const NamespaceGpuConsumer: React.FC<NamespaceConsumerProps> = ({
  namespace,
  gpuCount,
  onAddFilter,
}) => (
  <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
    <Button
      variant="link"
      isInline
      onClick={() => {
        onAddFilter({ columnKey: 'namespace', value: namespace });
      }}
    >
      {namespace}
    </Button>
    <Content>{gpuCount} GPUs</Content>
  </Flex>
);

export default WorkspaceKindSummaryExpandableCard;
