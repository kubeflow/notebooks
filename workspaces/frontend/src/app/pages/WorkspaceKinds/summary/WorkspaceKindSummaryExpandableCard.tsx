import * as React from 'react';
import {
  Bullseye,
  Button,
  Card,
  CardBody,
  CardExpandableContent,
  CardHeader,
  CardTitle,
  Content,
  ContentVariants,
  Divider,
  Flex,
  FlexItem,
  Stack,
  StackItem,
} from '@patternfly/react-core';
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
} from '~/shared/utilities/WorkspaceUtils';
import { useTypedLocation, useTypedNavigate, useTypedParams } from '~/app/routerHelper';

const TOP_GPU_CONSUMERS_LIMIT = 2;

interface WorkspaceKindSummaryExpandableCardProps {
  workspaces: Workspace[];
  isExpanded: boolean;
  onExpandToggle: () => void;
}

const WorkspaceKindSummaryExpandableCard: React.FC<WorkspaceKindSummaryExpandableCardProps> = ({
  workspaces,
  isExpanded,
  onExpandToggle,
}) => {
  const navigate = useTypedNavigate();
  const { kind } = useTypedParams<'workspaceKindSummary'>();
  const { state } = useTypedLocation<'workspaceKindSummary'>();
  const { namespace, imageId, podConfigId, withGpu, isIdle } = state || {};

  const topGpuConsumersByNamespace = React.useMemo(
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
          <Content component={ContentVariants.h2}>Workspaces Summary</Content>
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
            <SectionFlex title="Idle GPU Workspaces">
              <FlexItem>
                <Bullseye>
                  <Button
                    variant="link"
                    isInline
                    style={{ fontSize: LargeFontSize.value, fontWeight: BoldFontWeight.value }}
                    onClick={() => {
                      navigate('workspaceKindSummary', {
                        params: { kind },
                        state: {
                          withGpu: true,
                          isIdle: true,
                          namespace,
                          imageId,
                          podConfigId,
                        },
                      });
                    }}
                  >
                    {filterIdleWorkspacesWithGpu(workspaces).length}
                  </Button>
                </Bullseye>
              </FlexItem>
              <FlexItem>
                <Bullseye>
                  <Content>Idle GPU Workspaces</Content>
                </Bullseye>
              </FlexItem>
            </SectionFlex>
            <SectionDivider />
            <SectionFlex title="Top GPU Consumer Namespaces">
              <FlexItem>
                <Stack hasGutter>
                  {topGpuConsumersByNamespace.length > 0 ? (
                    topGpuConsumersByNamespace.map(([ns, record]) => (
                      <StackItem key={ns}>
                        <NamespaceGpuConsumer
                          namespace={ns}
                          gpuCount={record.gpuCount}
                          imageId={imageId}
                          podConfigId={podConfigId}
                          withGpu={withGpu}
                          isIdle={isIdle}
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
  imageId?: string;
  podConfigId?: string;
  withGpu?: boolean;
  isIdle?: boolean;
}

const NamespaceGpuConsumer: React.FC<NamespaceConsumerProps> = ({
  namespace,
  gpuCount,
  imageId,
  podConfigId,
  withGpu,
  isIdle,
}) => {
  const navigate = useTypedNavigate();
  const { kind } = useTypedParams<'workspaceKindSummary'>();

  return (
    <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
      <Button
        variant="link"
        isInline
        onClick={() => {
          navigate('workspaceKindSummary', {
            params: { kind },
            state: {
              namespace,
              imageId,
              podConfigId,
              withGpu,
              isIdle,
            },
          });
        }}
      >
        {namespace}
      </Button>
      <Content>{gpuCount} GPUs</Content>
    </Flex>
  );
};

export default WorkspaceKindSummaryExpandableCard;
