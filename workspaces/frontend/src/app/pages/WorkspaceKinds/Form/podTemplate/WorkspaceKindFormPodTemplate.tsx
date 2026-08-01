import React, { useCallback, useState } from 'react';
import {
  Form,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
} from '@patternfly/react-core/dist/esm/components/Form';
import { ExpandableSection } from '@patternfly/react-core/dist/esm/components/ExpandableSection';
import { HelperText } from '@patternfly/react-core/dist/esm/components/HelperText';
import { Switch } from '@patternfly/react-core/dist/esm/components/Switch';
import { WorkspaceKindPodTemplateData, WorkspacesPodVolumeMountValue } from '~/app/types';
import { EditableRowsTable } from '~/app/pages/WorkspaceKinds/Form/EditableRowsTable';
import { ResourceInputWrapper } from '~/shared/components/ResourceInputWrapper';
import { WorkspaceFormPropertiesVolumes } from '~/app/pages/Workspaces/Form/properties/WorkspaceFormPropertiesVolumes';

interface WorkspaceKindFormPodTemplateProps {
  podTemplate: WorkspaceKindPodTemplateData;
  updatePodTemplate: (template: WorkspaceKindPodTemplateData) => void;
}

export const WorkspaceKindFormPodTemplate: React.FC<WorkspaceKindFormPodTemplateProps> = ({
  podTemplate,
  updatePodTemplate,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [volumes, setVolumes] = useState<WorkspacesPodVolumeMountValue[]>([]);

  const toggleActivityProbeEnabled = useCallback(
    (checked: boolean) => {
      if (checked) {
        updatePodTemplate({
          ...podTemplate,
          activityProbe: podTemplate.activityProbe ?? {},
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

  const handleVolumes = useCallback(
    (newVolumes: WorkspacesPodVolumeMountValue[]) => {
      setVolumes(newVolumes);
      updatePodTemplate({
        ...podTemplate,
        extraVolumeMounts: newVolumes,
      });
    },
    [podTemplate, updatePodTemplate],
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
              isChecked={podTemplate.activityProbe != null}
              label="Enabled"
              aria-label="pod template enable activity probe controlled check"
              onChange={(_, checked) => toggleActivityProbeEnabled(checked)}
              id="workspace-kind-pod-template-activity-probe-enabled"
              name="activity-probe-enabled"
              data-testid="workspace-kind-pod-template-activity-probe-switch"
            />
          </FormGroup>
          {podTemplate.activityProbe && (
            <FormGroup label="Probe Interval (seconds)">
              <ResourceInputWrapper
                value={String(podTemplate.activityProbe.probeIntervalSeconds ?? 3600)}
                type="time"
                onChange={(value) =>
                  updatePodTemplate({
                    ...podTemplate,
                    activityProbe: {
                      ...podTemplate.activityProbe,
                      probeIntervalSeconds: Number(value),
                    },
                  })
                }
                step={1}
                aria-label="probe interval input"
              />
            </FormGroup>
          )}
        </FormFieldGroup>
        <FormFieldGroup
          aria-label="Volume Mounts"
          header={
            <FormFieldGroupHeader
              titleText={{
                text: 'Volume Mounts',
                id: 'workspace-kind-volume-mounts',
              }}
              titleDescription={
                <HelperText>Configure volume mount paths for workspaces.</HelperText>
              }
            />
          }
        />
        <FormFieldGroup
          aria-label="Additional Volumes"
          header={
            <FormFieldGroupHeader
              titleText={{
                text: 'Additional Volumes',
                id: 'workspace-kind-extra-volume',
              }}
              titleDescription={
                <HelperText>Configure the paths to mount additional PVCs.</HelperText>
              }
            />
          }
        >
          <WorkspaceFormPropertiesVolumes volumes={volumes} setVolumes={handleVolumes} />
        </FormFieldGroup>
      </Form>
    </ExpandableSection>
  );
};
