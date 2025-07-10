import {
  ExpandableSection,
  Form,
  FormFieldGroup,
  FormFieldGroupHeader,
  FormGroup,
  HelperText,
  HelperTextItem,
  Switch,
} from '@patternfly/react-core';
import React, { useCallback, useState } from 'react';
import { WorkspaceKindPodTemplateData } from '~/app/types';
import { EditableLabels } from '~/app/pages/WorkspaceKinds/Form/EditableLabels';
import { WorkspacePodVolumeMount } from '~/shared/api/backendApiTypes';
import { ResourceInputWrapper } from '~/app/pages/WorkspaceKinds/Form/podConfig/ResourceInputWrapper';
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
  const [volumes, setVolumes] = useState<WorkspacePodVolumeMount[]>([]);

  const toggleCullingEnabled = useCallback(
    (checked: boolean) => {
      if (podTemplate.culling) {
        updatePodTemplate({
          ...podTemplate,
          culling: {
            ...podTemplate.culling,
            enabled: checked,
          },
        });
      }
    },
    [podTemplate, updatePodTemplate],
  );

  const handleVolumes = useCallback(
    (newVolumes: WorkspacePodVolumeMount[]) => {
      setVolumes(newVolumes);
      updatePodTemplate({
        ...podTemplate,
        extraVolumeMounts: volumes,
      });
    },
    [podTemplate, updatePodTemplate, volumes],
  );

  return (
    <div className="pf-u-mb-0">
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
            <EditableLabels
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
            <EditableLabels
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
          {/* podTemplate.culling is currently not developed in the backend */}
          {podTemplate.culling && (
            <FormFieldGroup
              aria-label="Pod Culling"
              header={
                <FormFieldGroupHeader
                  titleText={{
                    text: 'Pod Culling',
                    id: 'workspace-kind-pod-culling',
                  }}
                  titleDescription={
                    <HelperText>
                      <HelperTextItem variant="warning">
                        Warning: Only for JupyterLab deployments
                      </HelperTextItem>
                      Culling scales the number of pods in a Workspace to zero based on its last
                      activity by polling Jupyter&apos;s status endpoint.
                    </HelperText>
                  }
                />
              }
            >
              <FormGroup>
                <Switch
                  isChecked={podTemplate.culling.enabled || false}
                  label="Enabled"
                  aria-label="pod template enable culling controlled check"
                  onChange={(_, checked) => toggleCullingEnabled(checked)}
                  id="workspace-kind-pod-template-culling-enabled"
                  name="culling-enabled"
                />
              </FormGroup>
              <FormGroup label="Max Inactive Period">
                <ResourceInputWrapper
                  value={String(podTemplate.culling.maxInactiveSeconds || 86400)}
                  type="time"
                  onChange={(value) =>
                    podTemplate.culling &&
                    updatePodTemplate({
                      ...podTemplate,
                      culling: {
                        ...podTemplate.culling,
                        maxInactiveSeconds: Number(value),
                      },
                    })
                  }
                  step={1}
                  aria-label="max inactive period input"
                  isDisabled={!podTemplate.culling.enabled}
                />
              </FormGroup>
            </FormFieldGroup>
          )}
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
    </div>
  );
};
