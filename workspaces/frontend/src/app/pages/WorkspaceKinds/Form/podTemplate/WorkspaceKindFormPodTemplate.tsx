import React, { useCallback, useState } from 'react';
import {
  Form,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
} from '@patternfly/react-core/dist/esm/components/Form';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Flex, FlexItem } from '@patternfly/react-core/dist/esm/layouts/Flex';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import { ActivityRuleEntry, WorkspaceKindPodTemplateData } from '~/app/types';
import { V1Beta1ActivityProbe, V1Beta1ActivityProbePodExec } from '~/generated/data-contracts';
import { EditableRowsTable } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { WorkspaceKindFormActivityRules } from '~/app/pages/WorkspaceKinds/Form/activityRules/WorkspaceKindFormActivityRules';

// Display fallbacks mirroring the CRD defaults for unset fields.
const DEFAULT_PROBE_INTERVAL_SECONDS = 3600;
const DEFAULT_MIN_PROBE_INTERVAL_SECONDS = 300;
const DEFAULT_POD_EXEC_TIMEOUT_SECONDS = 60;

const DEFAULT_POD_EXEC_SCRIPT = `#!/usr/bin/env bash
# A mock probe that always reports activity (replace with real detection logic)
echo '{"has_activity": true}' > "$OUTPUT_JSON_PATH"
exit 0`;

interface WorkspaceKindFormPodTemplateProps {
  podTemplate: WorkspaceKindPodTemplateData;
  updatePodTemplate: (template: WorkspaceKindPodTemplateData) => void;
  activityRules: ActivityRuleEntry[];
  updateActivityRules: (rules: ActivityRuleEntry[]) => void;
}

export const WorkspaceKindFormPodTemplate: React.FC<WorkspaceKindFormPodTemplateProps> = ({
  podTemplate,
  updatePodTemplate,
  activityRules,
  updateActivityRules,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { activityProbe } = podTemplate;

  const toggleActivityProbeEnabled = useCallback(
    (checked: boolean) => {
      if (checked) {
        updatePodTemplate({
          ...podTemplate,
          activityProbe: podTemplate.activityProbe ?? {
            podExec: { script: DEFAULT_POD_EXEC_SCRIPT },
          },
        });
      } else {
        updatePodTemplate({
          ...podTemplate,
          activityProbe: undefined,
        });
      }
    },
    [podTemplate, updatePodTemplate],
  );

  const updateActivityProbe = useCallback(
    (changes: Partial<V1Beta1ActivityProbe>) => {
      if (!podTemplate.activityProbe) {
        return;
      }
      updatePodTemplate({
        ...podTemplate,
        activityProbe: { ...podTemplate.activityProbe, ...changes },
      });
    },
    [podTemplate, updatePodTemplate],
  );

  const updatePodExec = useCallback(
    (changes: Partial<V1Beta1ActivityProbePodExec>) => {
      if (!podTemplate.activityProbe) {
        return;
      }
      updateActivityProbe({ podExec: { ...podTemplate.activityProbe.podExec, ...changes } });
    },
    [podTemplate.activityProbe, updateActivityProbe],
  );

  return (
    <ExpandableSection
      toggleText="Pod Lifecycle & Customization"
      onToggle={() => setIsExpanded((prev) => !prev)}
      isExpanded={isExpanded}
      isIndented
      data-testid="workspace-kind-pod-template-section"
    >
      <Form>
        <FormFieldGroup
          aria-label="Pod Metadata"
          header={
            <FormFieldGroupHeader
              titleText={{
                text: 'Pod Metadata',
                id: 'workspace-kind-pod-metadata',
              }}
              titleDescription={
                <HelperText>
                  Edit mutable metadata of all pods created with this Workspace Kind.
                </HelperText>
              }
            />
          }
        >
          <EditableRowsTable
            rows={Object.entries(podTemplate.podMetadata.labels).map((entry) => ({
              key: entry[0],
              value: entry[1],
            }))}
            setRows={(newLabels) => {
              updatePodTemplate({
                ...podTemplate,
                podMetadata: {
                  ...podTemplate.podMetadata,
                  labels: newLabels.reduce((acc: { [k: string]: string }, { key, value }) => {
                    acc[key] = value;
                    return acc;
                  }, {}),
                },
              });
            }}
          />
          <EditableRowsTable
            title="Annotations"
            description="Use annotations to attach arbitrary non-identifying metadata to Kubernetes objects."
            buttonLabel="Annotation"
            rows={Object.entries(podTemplate.podMetadata.annotations).map((entry) => ({
              key: entry[0],
              value: entry[1],
            }))}
            setRows={(newAnnotations) => {
              updatePodTemplate({
                ...podTemplate,
                podMetadata: {
                  ...podTemplate.podMetadata,
                  annotations: newAnnotations.reduce(
                    (acc: { [k: string]: string }, { key, value }) => {
                      acc[key] = value;
                      return acc;
                    },
                    {},
                  ),
                },
              });
            }}
          />
        </FormFieldGroup>
        <FormFieldGroup
          aria-label="Activity Probe"
          data-testid="workspace-kind-activity-probe"
          header={
            <FormFieldGroupHeader
              titleText={{
                text: 'Activity Probe',
                id: 'workspace-kind-activity-probe',
              }}
              titleDescription={
                <HelperText>
                  Configure how workspace activity is detected with a Bash script. Activity Rules
                  use these results to determine when to pause idle workspaces.
                </HelperText>
              }
            />
          }
        >
          <FormGroup>
            <Switch
              isChecked={activityProbe != null}
              label="Enabled"
              aria-label="pod template enable activity probe controlled check"
              onChange={(_, checked) => toggleActivityProbeEnabled(checked)}
              id="workspace-kind-pod-template-activity-probe-enabled"
              name="activity-probe-enabled"
              data-testid="workspace-kind-pod-template-activity-probe-switch"
            />
          </FormGroup>
          {activityProbe && (
            <FormFieldGroup
              aria-label="Activity Probe settings"
              data-testid="workspace-kind-activity-probe-settings"
            >
              <Flex
                direction={{ default: 'column', xl: 'row' }}
                flexWrap={{ default: 'wrap' }}
                spaceItems={{ default: 'spaceItemsLg' }}
                data-testid="workspace-kind-activity-probe-timing"
              >
                <FlexItem flex={{ default: 'flex_1' }}>
                  <ThemeAwareFormGroupWrapper
                    label="Activity Check Interval"
                    fieldId="workspace-kind-activity-probe-interval"
                    skipFieldset
                    helperTextNode={
                      <HelperText>
                        <HelperTextItem icon={<InfoCircleIcon />}>
                          After a successful check, wait this long before checking workspace
                          activity again.
                        </HelperTextItem>
                      </HelperText>
                    }
                  >
                    <ResourceInputWrapper
                      value={String(
                        activityProbe.probeIntervalSeconds ?? DEFAULT_PROBE_INTERVAL_SECONDS,
                      )}
                      type="time"
                      onChange={(value) =>
                        updateActivityProbe({ probeIntervalSeconds: Number(value) })
                      }
                      min={1}
                      step={1}
                      aria-label="probe interval input"
                    />
                  </ThemeAwareFormGroupWrapper>
                </FlexItem>
                <FlexItem flex={{ default: 'flex_1' }}>
                  <ThemeAwareFormGroupWrapper
                    label="Minimum Time Between Checks"
                    fieldId="workspace-kind-activity-probe-min-interval"
                    skipFieldset
                    helperTextNode={
                      <HelperText>
                        <HelperTextItem icon={<InfoCircleIcon />}>
                          Wait at least this long between checks. If a check fails, retry after this
                          delay.
                        </HelperTextItem>
                      </HelperText>
                    }
                  >
                    <ResourceInputWrapper
                      value={String(
                        activityProbe.minProbeIntervalSeconds ?? DEFAULT_MIN_PROBE_INTERVAL_SECONDS,
                      )}
                      type="time"
                      onChange={(value) =>
                        updateActivityProbe({ minProbeIntervalSeconds: Number(value) })
                      }
                      min={1}
                      step={1}
                      aria-label="minimum probe interval input"
                    />
                  </ThemeAwareFormGroupWrapper>
                </FlexItem>
                <FlexItem flex={{ default: 'flex_1' }}>
                  <ThemeAwareFormGroupWrapper
                    label="Timeout"
                    fieldId="workspace-kind-activity-probe-timeout"
                    skipFieldset
                    helperTextNode={
                      <HelperText>
                        <HelperTextItem icon={<InfoCircleIcon />}>
                          Maximum time the probe script may run.
                        </HelperTextItem>
                      </HelperText>
                    }
                  >
                    <ResourceInputWrapper
                      value={String(
                        activityProbe.podExec.timeoutSeconds ?? DEFAULT_POD_EXEC_TIMEOUT_SECONDS,
                      )}
                      type="time"
                      onChange={(value) => updatePodExec({ timeoutSeconds: Number(value) })}
                      min={1}
                      step={1}
                      aria-label="probe script timeout input"
                    />
                  </ThemeAwareFormGroupWrapper>
                </FlexItem>
              </Flex>
              <ThemeAwareFormGroupWrapper
                label="Probe Script"
                isRequired
                fieldId="workspace-kind-activity-probe-script"
                skipFieldset
                helperTextNode={
                  <HelperText>
                    <HelperTextItem icon={<InfoCircleIcon />}>
                      Runs inside the Workspace Pod and must start with a shebang and exit 0. To
                      report inactivity, write a JSON object with either <code>has_activity</code>{' '}
                      or <code>last_activity</code> to the file at <code>$OUTPUT_JSON_PATH</code>.
                    </HelperTextItem>
                  </HelperText>
                }
              >
                <div data-testid="workspace-kind-activity-probe-script-editor">
                  <CodeEditor
                    isLineNumbersVisible
                    isLanguageLabelVisible={false}
                    height="300px"
                    code={activityProbe.podExec.script}
                    onChange={(value) => updatePodExec({ script: value })}
                    language={Language.shell}
                    options={{
                      ariaLabel: 'Probe Script',
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                    }}
                  />
                </div>
              </ThemeAwareFormGroupWrapper>
            </FormFieldGroup>
          )}
        </FormFieldGroup>
        <WorkspaceKindFormActivityRules
          activityRules={activityRules}
          updateActivityRules={updateActivityRules}
        />
      </Form>
    </ExpandableSection>
  );
};
