import React, { useCallback, useState } from 'react';
import {
  Form,
  FormFieldGroup,
  FormFieldGroupExpandable,
  FormFieldGroupHeader,
  FormGroup,
} from '@patternfly/react-core/dist/esm/components/Form';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { HelperText, HelperTextItem } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { InfoCircleIcon } from '@patternfly/react-icons/dist/esm/icons/info-circle-icon';
import { CodeEditor, Language } from '@patternfly/react-code-editor';
import { ActivityRuleEntry, WorkspaceKindPodTemplateData } from '~/app/types';
import { V1Beta1ActivityProbe, V1Beta1ActivityProbePodExec } from '~/generated/data-contracts';
import { EditableRowsTable } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';
import ThemeAwareFormGroupWrapper from '~/shared/components/ThemeAwareFormGroupWrapper';
import { WorkspaceKindFormActivityRules } from '~/app/pages/WorkspaceKinds/Form/activityRules/WorkspaceKindFormActivityRules';

// The Activity Probe panel is hidden until its UX has been reviewed. An existing activityProbe
// is still preserved on save.
const SHOW_ACTIVITY_PROBE_PANEL = false;

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
        <WorkspaceKindFormActivityRules
          activityRules={activityRules}
          updateActivityRules={updateActivityRules}
        />
        {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */}
        {SHOW_ACTIVITY_PROBE_PANEL && (
          <FormFieldGroup
            aria-label="Activity Probe"
            header={
              <FormFieldGroupHeader
                titleText={{
                  text: 'Activity Probe',
                  id: 'workspace-kind-activity-probe',
                }}
                titleDescription={
                  <HelperText>
                    Configure activity probe settings to determine Workspace activity for culling
                    inactive workspaces.
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
              <>
                <FormFieldGroupExpandable
                  isExpanded
                  toggleAriaLabel="Schedule"
                  header={
                    <FormFieldGroupHeader
                      titleText={{
                        text: 'Schedule',
                        id: 'workspace-kind-activity-probe-schedule',
                      }}
                    />
                  }
                >
                  <ThemeAwareFormGroupWrapper
                    label="Probe Interval"
                    fieldId="workspace-kind-activity-probe-interval"
                    skipFieldset
                    helperTextNode={
                      <HelperText>
                        <HelperTextItem icon={<InfoCircleIcon />}>
                          Desired time between successful probes.
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
                  <ThemeAwareFormGroupWrapper
                    label="Minimum Probe Interval"
                    fieldId="workspace-kind-activity-probe-min-interval"
                    skipFieldset
                    helperTextNode={
                      <HelperText>
                        <HelperTextItem icon={<InfoCircleIcon />}>
                          Minimum time between any two probes, including retries after a failure.
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
                </FormFieldGroupExpandable>
                <FormFieldGroupExpandable
                  isExpanded
                  toggleAriaLabel="Script"
                  header={
                    <FormFieldGroupHeader
                      titleText={{
                        text: 'Script',
                        id: 'workspace-kind-activity-probe-script-group',
                      }}
                    />
                  }
                >
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
                  <ThemeAwareFormGroupWrapper
                    label="Probe Script"
                    isRequired
                    fieldId="workspace-kind-activity-probe-script"
                    skipFieldset
                    helperTextNode={
                      <HelperText>
                        <HelperTextItem icon={<InfoCircleIcon />}>
                          Runs inside the Workspace Pod and must start with a shebang and exit 0. To
                          report inactivity, write a JSON object with either{' '}
                          <code>has_activity</code> or <code>last_activity</code> to the file at{' '}
                          <code>$OUTPUT_JSON_PATH</code>.
                        </HelperTextItem>
                      </HelperText>
                    }
                  >
                    <CodeEditor
                      isLineNumbersVisible
                      isLanguageLabelVisible={false}
                      height="300px"
                      code={activityProbe.podExec.script}
                      onChange={(value) => updatePodExec({ script: value })}
                      language={Language.shell}
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                      }}
                      data-testid="workspace-kind-activity-probe-script-editor"
                    />
                  </ThemeAwareFormGroupWrapper>
                </FormFieldGroupExpandable>
              </>
            )}
          </FormFieldGroup>
        )}
      </Form>
    </ExpandableSection>
  );
};
