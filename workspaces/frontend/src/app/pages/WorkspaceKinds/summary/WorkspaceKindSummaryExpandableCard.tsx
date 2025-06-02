import * as React from 'react';
import {
  Bullseye,
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
import { Link } from 'react-router-dom';
import {
  t_global_spacer_md as MediumPadding,
  t_global_font_size_4xl as LargeFontSize,
  t_global_font_weight_heading_bold as BoldFontWeight,
} from '@patternfly/react-tokens';

interface WorkspaceKindSummaryExpandableCardProps {
  isExpanded: boolean;
  onExpandToggle: () => void;
}

const WorkspaceKindSummaryExpandableCard: React.FC<WorkspaceKindSummaryExpandableCardProps> = ({
  isExpanded,
  onExpandToggle,
}) => (
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
              <Content>X.XXX m</Content>
            </FlexItem>
            <FlexItem>
              <Content>Requested of X.XX m</Content>
            </FlexItem>
          </SectionFlex>
          <SectionDivider />
          <SectionFlex title="Idle GPU Workspaces">
            <FlexItem>
              <Bullseye>
                <Link
                  to="TODO link"
                  aria-label="Link to idle GPU Workspaces"
                  style={{ fontSize: LargeFontSize.value, fontWeight: BoldFontWeight.value }}
                >
                  3
                </Link>
              </Bullseye>
            </FlexItem>
            <FlexItem>
              <Bullseye>
                <Content>Idle GPU Workspaces</Content>
              </Bullseye>
            </FlexItem>
          </SectionFlex>
          <SectionDivider />
          <SectionFlex title="Top GPU Consumers">
            <FlexItem>
              <Stack hasGutter>
                <StackItem>
                  <TeamGpuConsumer team="Team X" gpuCount={3} />
                </StackItem>
                <StackItem>
                  <TeamGpuConsumer team="Team Y" gpuCount={2} />
                </StackItem>
              </Stack>
            </FlexItem>
          </SectionFlex>
        </Flex>
      </CardBody>
    </CardExpandableContent>
  </Card>
);

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

interface TeamGpuConsumerProps {
  team: string;
  gpuCount: number;
}

const TeamGpuConsumer: React.FC<TeamGpuConsumerProps> = ({ team: teamName, gpuCount }) => (
  <Flex justifyContent={{ default: 'justifyContentSpaceBetween' }}>
    <Link aria-label={`Link to ${teamName}`} to={`TODO link for ${teamName}`}>
      {teamName}
    </Link>
    <Content>{gpuCount} GPUs</Content>
  </Flex>
);

export default WorkspaceKindSummaryExpandableCard;
