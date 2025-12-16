import { mockModArchResponse } from 'mod-arch-core';
import { editWorkspaceKind } from '~/__tests__/cypress/cypress/pages/workspaceKinds/editWorkspaceKind';
import { workspaceKinds } from '~/__tests__/cypress/cypress/pages/workspaceKinds/workspaceKinds';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import type { WorkspacekindsWorkspaceKind } from '~/generated/data-contracts';

const DEFAULT_NAMESPACE = 'default';
const TEST_WORKSPACE_KIND_NAME = 'test-workspace-kind';

type EditWorkspaceKindSetup = {
  mockWorkspaceKind: WorkspacekindsWorkspaceKind;
  mockNamespace: ReturnType<typeof buildMockNamespace>;
};

const setupEditWorkspaceKind = (
  workspaceKindOverrides?: Partial<Parameters<typeof buildMockWorkspaceKind>[0]>,
): EditWorkspaceKindSetup => {
  const mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });
  const mockWorkspaceKind = buildMockWorkspaceKind({
    name: TEST_WORKSPACE_KIND_NAME,
    displayName: 'Test Workspace Kind',
    description: 'A test workspace kind for editing',
    deprecated: false,
    hidden: false,
    ...workspaceKindOverrides,
  });

  cy.interceptApi(
    'GET /api/:apiVersion/namespaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockNamespace]),
  ).as('getNamespaces');

  cy.intercept(
    'GET',
    `/api/${NOTEBOOKS_API_VERSION}/workspacekinds/${mockWorkspaceKind.name}`,
    mockModArchResponse(mockWorkspaceKind),
  ).as('getWorkspaceKind');

  cy.interceptApi(
    'GET /api/:apiVersion/workspacekinds',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([mockWorkspaceKind]),
  ).as('getWorkspaceKinds');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces/:namespace',
    { path: { apiVersion: NOTEBOOKS_API_VERSION, namespace: mockNamespace.name } },
    mockModArchResponse([]),
  ).as('getWorkspaces');

  cy.interceptApi(
    'GET /api/:apiVersion/workspaces',
    { path: { apiVersion: NOTEBOOKS_API_VERSION } },
    mockModArchResponse([]),
  ).as('getAllWorkspaces');

  return { mockWorkspaceKind, mockNamespace };
};

const visitEditWorkspaceKind = (kind: string) => {
  editWorkspaceKind.visit(kind);
  cy.wait('@getWorkspaceKind');
};

describe('Edit workspace kind', () => {
  describe('Basic', () => {
    it('should display the edit workspace kind page with correct title', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.verifyPageURL(mockWorkspaceKind.name);
      editWorkspaceKind.findPageTitle();
    });

    it('should display form properties section', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.assertFormPropertiesVisible();
    });

    it('should display all expandable sections', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.assertPropertiesSectionVisible();
      editWorkspaceKind.assertImageConfigSectionVisible();
      editWorkspaceKind.assertPodConfigSectionVisible();
      editWorkspaceKind.assertPodTemplateSectionVisible();
    });

    it('should have submit button disabled in edit mode when no changes are made', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.assertSubmitButtonDisabled(true);
      editWorkspaceKind.assertSubmitButtonText('Save');
    });

    it('should navigate back to workspace kinds on cancel', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.clickCancel();

      workspaceKinds.verifyPageURL();
      cy.wait('@getWorkspaceKinds');
    });
  });

  describe('Properties section', () => {
    it('should display workspace kind properties when properties section is expanded', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertWorkspaceKindName(mockWorkspaceKind.displayName);
      editWorkspaceKind.assertDescription(mockWorkspaceKind.description);
      editWorkspaceKind.assertIconUrl(mockWorkspaceKind.icon.url);
      editWorkspaceKind.assertLogoUrl(mockWorkspaceKind.logo.url);
    });

    it('should toggle properties section expansion', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.assertPropertiesSectionExpanded(false);

      editWorkspaceKind.expandPropertiesSection();
      editWorkspaceKind.assertPropertiesSectionExpanded(true);
      editWorkspaceKind.assertWorkspaceKindNameInputVisible();

      editWorkspaceKind.collapsePropertiesSection();
      editWorkspaceKind.assertPropertiesSectionExpanded(false);
    });

    it('should display hidden switch in edit mode', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind({ hidden: false });

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertHiddenSwitchExists();
      editWorkspaceKind.assertHiddenChecked(false);
    });

    it('should display deprecated switch in edit mode', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind({ deprecated: false });

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertDeprecatedSwitchExists();
      editWorkspaceKind.assertDeprecatedChecked(false);
    });

    it('should display hidden workspace kind with checked switch', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind({ hidden: true });

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertHiddenChecked(true);
    });

    it('should display deprecated workspace kind with checked switch and deprecation message', () => {
      const deprecationMessage = 'This workspace kind is deprecated';
      const { mockWorkspaceKind } = setupEditWorkspaceKind({
        deprecated: true,
        deprecationMessage,
      });

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertDeprecatedChecked(true);
      editWorkspaceKind.assertDeprecationMessageVisible(true);
      editWorkspaceKind.assertDeprecationMessage(deprecationMessage);
    });

    it('should show deprecation message input when deprecated switch is toggled on', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind({ deprecated: false });

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertDeprecatedChecked(false);
      editWorkspaceKind.assertDeprecationMessageVisible(false);

      editWorkspaceKind.toggleDeprecated();

      editWorkspaceKind.assertDeprecationMessageVisible(true);
    });

    it('should hide deprecation message input when deprecated switch is toggled off', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind({
        deprecated: true,
        deprecationMessage: 'This is deprecated',
      });

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertDeprecatedChecked(true);
      editWorkspaceKind.assertDeprecationMessageVisible(true);

      editWorkspaceKind.toggleDeprecated();

      editWorkspaceKind.assertDeprecationMessageVisible(false);
    });
  });

  describe('Workspace images section', () => {
    it('should expand workspace images section', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.assertImageConfigSectionExpanded(false);

      editWorkspaceKind.expandImageConfigSection();

      editWorkspaceKind.assertImageConfigSectionExpanded(true);
    });

    it('should display images table when workspace kind has images', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      editWorkspaceKind.assertImagesTableVisible();
    });

    it('should display all images from workspace kind', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      const imageCount = mockWorkspaceKind.podTemplate.options.imageConfig.values.length;
      editWorkspaceKind.assertImageCount(imageCount);
    });

    it('should display Add Image button when images exist', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      editWorkspaceKind.assertAddImageButtonVisible();
    });

    it('should open add image modal when clicking Add Image button', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      editWorkspaceKind.clickAddImageButton();

      editWorkspaceKind.assertImageModalVisible(true);
      editWorkspaceKind.assertImageModalTitle('Add Image');
    });

    it('should close modal when clicking cancel', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();
      editWorkspaceKind.clickAddImageButton();

      editWorkspaceKind.assertImageModalVisible(true);

      editWorkspaceKind.cancelImageModal();

      editWorkspaceKind.assertImageModalVisible(false);
    });

    it('should fill image form fields', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();
      editWorkspaceKind.clickAddImageButton();

      const imageId = 'test-image-id';
      const displayName = 'Test Image';
      const description = 'Test image description';
      const imageUrl = 'quay.io/test/image:latest';

      editWorkspaceKind.typeImageId(imageId);
      editWorkspaceKind.typeImageDisplayName(displayName);
      editWorkspaceKind.typeImageDescription(description);
      editWorkspaceKind.typeImageUrl(imageUrl);

      editWorkspaceKind.assertImageId(imageId);
      editWorkspaceKind.assertImageDisplayName(displayName);
      editWorkspaceKind.assertImageDescription(description);
      editWorkspaceKind.assertImageUrl(imageUrl);
    });

    it('should add new image to the table after submitting form', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      const initialImageCount = mockWorkspaceKind.podTemplate.options.imageConfig.values.length;
      editWorkspaceKind.assertImageCount(initialImageCount);

      editWorkspaceKind.clickAddImageButton();

      const newImageDisplayName = 'New Test Image';
      editWorkspaceKind.typeImageId('new-test-image');
      editWorkspaceKind.typeImageDisplayName(newImageDisplayName);
      editWorkspaceKind.typeImageDescription('A new test image');
      editWorkspaceKind.typeImageUrl('quay.io/test/new-image:v1.0.0');

      editWorkspaceKind.submitImageModal();

      editWorkspaceKind.assertImageModalVisible(false);
      editWorkspaceKind.assertImageCount(initialImageCount + 1);
      editWorkspaceKind.assertImageInTable(newImageDisplayName);
    });

    it('should display all required fields in add image form', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();
      editWorkspaceKind.clickAddImageButton();

      editWorkspaceKind.assertImageIdInputVisible();
      editWorkspaceKind.assertImageDisplayNameInputVisible();
      editWorkspaceKind.assertImageDescriptionInputVisible();
      editWorkspaceKind.assertImageUrlInputVisible();
    });

    it('should open remove modal when clicking remove from actions menu', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      editWorkspaceKind.clickImageTableRowKebab(0);
      editWorkspaceKind.clickRemoveImage();

      editWorkspaceKind.assertRemoveImageModalVisible(true);
    });

    it('should cancel image removal when clicking cancel in remove modal', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      const initialImageCount = mockWorkspaceKind.podTemplate.options.imageConfig.values.length;

      editWorkspaceKind.clickImageTableRowKebab(0);
      editWorkspaceKind.clickRemoveImage();
      editWorkspaceKind.assertRemoveImageModalVisible(true);

      editWorkspaceKind.cancelRemoveImage();

      editWorkspaceKind.assertRemoveImageModalVisible(false);
      editWorkspaceKind.assertImageCount(initialImageCount);
    });

    it('should remove image from table when confirming removal', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      const initialImageCount = mockWorkspaceKind.podTemplate.options.imageConfig.values.length;
      const imageToRemove = mockWorkspaceKind.podTemplate.options.imageConfig.values[0];

      editWorkspaceKind.assertImageInTable(imageToRemove.displayName);

      editWorkspaceKind.clickImageTableRowKebab(0);
      editWorkspaceKind.clickRemoveImage();
      editWorkspaceKind.confirmRemoveImage();

      editWorkspaceKind.assertRemoveImageModalVisible(false);
      editWorkspaceKind.assertImageCount(initialImageCount - 1);
      editWorkspaceKind.assertImageNotInTable(imageToRemove.displayName);
    });

    it('should open edit modal when clicking edit from actions menu', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandImageConfigSection();

      const imageToEdit = mockWorkspaceKind.podTemplate.options.imageConfig.values[0];

      editWorkspaceKind.clickImageTableRowKebab(0);
      editWorkspaceKind.clickEditImage();

      editWorkspaceKind.assertImageModalVisible(true);
      editWorkspaceKind.assertImageModalTitle('Edit Image');
      editWorkspaceKind.assertImageId(imageToEdit.id);
      editWorkspaceKind.assertImageDisplayName(imageToEdit.displayName);
    });
  });

  describe('Pod configurations section', () => {
    it('should expand pod configurations section', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.assertPodConfigSectionExpanded(false);

      editWorkspaceKind.expandPodConfigSection();

      editWorkspaceKind.assertPodConfigSectionExpanded(true);
    });

    it('should display pod configurations table when workspace kind has configs', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      editWorkspaceKind.assertPodConfigsTableVisible();
    });

    it('should display all pod configurations from workspace kind', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      const podConfigCount = mockWorkspaceKind.podTemplate.options.podConfig.values.length;
      editWorkspaceKind.assertPodConfigCount(podConfigCount);
    });

    it('should display Add Config button when configs exist', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      editWorkspaceKind.assertAddConfigButtonVisible();
    });

    it('should open add pod config modal when clicking Add Config button', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      editWorkspaceKind.clickAddConfigButton();

      editWorkspaceKind.assertPodConfigModalVisible(true);
      editWorkspaceKind.assertPodConfigModalTitle('Create A Pod Configuration');
    });

    it('should close modal when clicking cancel', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();
      editWorkspaceKind.clickAddConfigButton();

      editWorkspaceKind.assertPodConfigModalVisible(true);

      editWorkspaceKind.cancelPodConfigModal();

      editWorkspaceKind.assertPodConfigModalVisible(false);
    });

    it('should fill pod config form fields', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();
      editWorkspaceKind.clickAddConfigButton();

      const configId = 'test-pod-config-id';
      const displayName = 'Test Pod Config';
      const description = 'Test pod configuration description';

      editWorkspaceKind.typePodConfigId(configId);
      editWorkspaceKind.typePodConfigDisplayName(displayName);
      editWorkspaceKind.typePodConfigDescription(description);

      editWorkspaceKind.assertPodConfigId(configId);
      editWorkspaceKind.assertPodConfigDisplayName(displayName);
      editWorkspaceKind.assertPodConfigDescription(description);
    });

    it('should add new pod config to the table after submitting form', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      const initialPodConfigCount = mockWorkspaceKind.podTemplate.options.podConfig.values.length;
      editWorkspaceKind.assertPodConfigCount(initialPodConfigCount);

      editWorkspaceKind.clickAddConfigButton();

      const newPodConfigDisplayName = 'New Test Pod Config';
      editWorkspaceKind.typePodConfigId('new-test-pod-config');
      editWorkspaceKind.typePodConfigDisplayName(newPodConfigDisplayName);
      editWorkspaceKind.typePodConfigDescription('A new test pod configuration');

      editWorkspaceKind.submitPodConfigModal();

      editWorkspaceKind.assertPodConfigModalVisible(false);
      editWorkspaceKind.assertPodConfigCount(initialPodConfigCount + 1);
      editWorkspaceKind.assertPodConfigInTable(newPodConfigDisplayName);
    });

    it('should display all required fields in add pod config form', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();
      editWorkspaceKind.clickAddConfigButton();

      editWorkspaceKind.assertPodConfigIdInputVisible();
      editWorkspaceKind.assertPodConfigDisplayNameInputVisible();
      editWorkspaceKind.assertPodConfigDescriptionInputVisible();
    });

    it('should open remove modal when clicking remove from actions menu', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      editWorkspaceKind.clickPodConfigTableRowKebab(0);
      editWorkspaceKind.clickRemovePodConfig();

      editWorkspaceKind.assertRemovePodConfigModalVisible(true);
    });

    it('should cancel pod config removal when clicking cancel in remove modal', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      const initialPodConfigCount = mockWorkspaceKind.podTemplate.options.podConfig.values.length;

      editWorkspaceKind.clickPodConfigTableRowKebab(0);
      editWorkspaceKind.clickRemovePodConfig();
      editWorkspaceKind.assertRemovePodConfigModalVisible(true);

      editWorkspaceKind.cancelRemovePodConfig();

      editWorkspaceKind.assertRemovePodConfigModalVisible(false);
      editWorkspaceKind.assertPodConfigCount(initialPodConfigCount);
    });

    it('should remove pod config from table when confirming removal', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      const initialPodConfigCount = mockWorkspaceKind.podTemplate.options.podConfig.values.length;
      const podConfigToRemove = mockWorkspaceKind.podTemplate.options.podConfig.values[0];

      editWorkspaceKind.assertPodConfigInTable(podConfigToRemove.displayName);

      editWorkspaceKind.clickPodConfigTableRowKebab(0);
      editWorkspaceKind.clickRemovePodConfig();
      editWorkspaceKind.confirmRemovePodConfig();

      editWorkspaceKind.assertRemovePodConfigModalVisible(false);
      editWorkspaceKind.assertPodConfigCount(initialPodConfigCount - 1);
      editWorkspaceKind.assertPodConfigNotInTable(podConfigToRemove.displayName);
    });

    it('should open edit modal when clicking edit from actions menu', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodConfigSection();

      const podConfigToEdit = mockWorkspaceKind.podTemplate.options.podConfig.values[0];

      editWorkspaceKind.clickPodConfigTableRowKebab(0);
      editWorkspaceKind.clickEditPodConfig();

      editWorkspaceKind.assertPodConfigModalVisible(true);
      editWorkspaceKind.assertPodConfigModalTitle('Edit Pod Configuration');
      editWorkspaceKind.assertPodConfigId(podConfigToEdit.id);
      editWorkspaceKind.assertPodConfigDisplayName(podConfigToEdit.displayName);
    });
  });

  describe('Pod lifecycle section', () => {
    it('should expand pod lifecycle section', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.assertPodTemplateSectionExpanded(false);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.assertPodTemplateSectionExpanded(true);
    });

    it('should display pod metadata section when expanded', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.assertPodMetadataSectionVisible();
    });

    it('should display additional volumes section when expanded', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.assertAdditionalVolumesSectionVisible();
    });

    it('should add a new label', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();
      editWorkspaceKind.expandLabelsSection();

      editWorkspaceKind.clickAddLabel();
      editWorkspaceKind.typeLabelKey(0, 'test-key');
      editWorkspaceKind.typeLabelValue(0, 'test-value');

      editWorkspaceKind.assertLabelCount(1);
      editWorkspaceKind.assertLabelKey(0, 'test-key');
      editWorkspaceKind.assertLabelValue(0, 'test-value');
    });

    it('should delete a label', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();
      editWorkspaceKind.expandLabelsSection();

      editWorkspaceKind.clickAddLabel();
      editWorkspaceKind.typeLabelKey(0, 'test-key');
      editWorkspaceKind.typeLabelValue(0, 'test-value');

      editWorkspaceKind.assertLabelCount(1);

      editWorkspaceKind.clickDeleteLabel(0);

      editWorkspaceKind.assertLabelCount(0);
    });

    it('should add multiple labels', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();
      editWorkspaceKind.expandLabelsSection();

      editWorkspaceKind.clickAddLabel();
      editWorkspaceKind.typeLabelKey(0, 'label1');
      editWorkspaceKind.typeLabelValue(0, 'value1');

      editWorkspaceKind.clickAddLabel();
      editWorkspaceKind.typeLabelKey(1, 'label2');
      editWorkspaceKind.typeLabelValue(1, 'value2');

      editWorkspaceKind.assertLabelCount(2);
      editWorkspaceKind.assertLabelKey(0, 'label1');
      editWorkspaceKind.assertLabelValue(0, 'value1');
      editWorkspaceKind.assertLabelKey(1, 'label2');
      editWorkspaceKind.assertLabelValue(1, 'value2');
    });

    it('should add a new annotation', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();
      editWorkspaceKind.expandAnnotationsSection();

      editWorkspaceKind.clickAddAnnotation();
      editWorkspaceKind.typeAnnotationKey(0, 'annotation-key');
      editWorkspaceKind.typeAnnotationValue(0, 'annotation-value');

      editWorkspaceKind.assertAnnotationCount(1);
      editWorkspaceKind.assertAnnotationKey(0, 'annotation-key');
      editWorkspaceKind.assertAnnotationValue(0, 'annotation-value');
    });

    it('should delete an annotation', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();
      editWorkspaceKind.expandAnnotationsSection();

      editWorkspaceKind.clickAddAnnotation();
      editWorkspaceKind.typeAnnotationKey(0, 'annotation-key');
      editWorkspaceKind.typeAnnotationValue(0, 'annotation-value');

      editWorkspaceKind.assertAnnotationCount(1);

      editWorkspaceKind.clickDeleteAnnotation(0);

      editWorkspaceKind.assertAnnotationCount(0);
    });

    it('should add multiple annotations', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();
      editWorkspaceKind.expandAnnotationsSection();

      editWorkspaceKind.clickAddAnnotation();
      editWorkspaceKind.typeAnnotationKey(0, 'annotation1');
      editWorkspaceKind.typeAnnotationValue(0, 'value1');

      editWorkspaceKind.clickAddAnnotation();
      editWorkspaceKind.typeAnnotationKey(1, 'annotation2');
      editWorkspaceKind.typeAnnotationValue(1, 'value2');

      editWorkspaceKind.assertAnnotationCount(2);
      editWorkspaceKind.assertAnnotationKey(0, 'annotation1');
      editWorkspaceKind.assertAnnotationValue(0, 'value1');
      editWorkspaceKind.assertAnnotationKey(1, 'annotation2');
      editWorkspaceKind.assertAnnotationValue(1, 'value2');
    });

    it('should open create volume modal when clicking Create Volume button', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();

      editWorkspaceKind.assertVolumeModalVisible(true);
      editWorkspaceKind.assertVolumeModalTitle('Create Volume');
    });

    it('should create a new volume', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.assertVolumeCount(0);

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('my-pvc');
      editWorkspaceKind.typeMountPath('/data');
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.assertVolumeModalVisible(false);
      editWorkspaceKind.assertVolumeCount(1);
      editWorkspaceKind.assertVolumeInTable('my-pvc');
    });

    it('should create a volume with read-only access', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('readonly-pvc');
      editWorkspaceKind.typeMountPath('/readonly-data');
      editWorkspaceKind.toggleReadOnly();
      editWorkspaceKind.assertReadOnlyChecked(true);
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.assertVolumeCount(1);
      editWorkspaceKind.assertVolumeInTable('readonly-pvc');
    });

    it('should cancel volume creation', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('cancelled-pvc');
      editWorkspaceKind.typeMountPath('/cancelled');
      editWorkspaceKind.cancelVolumeModal();

      editWorkspaceKind.assertVolumeModalVisible(false);
      editWorkspaceKind.assertVolumeCount(0);
    });

    it('should open edit volume modal when clicking edit from actions menu', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('edit-test-pvc');
      editWorkspaceKind.typeMountPath('/edit-test');
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.clickVolumeRowKebab(0);
      editWorkspaceKind.clickEditVolume();

      editWorkspaceKind.assertVolumeModalVisible(true);
      editWorkspaceKind.assertVolumeModalTitle('Edit Volume');
      editWorkspaceKind.assertPvcName('edit-test-pvc');
      editWorkspaceKind.assertMountPath('/edit-test');
    });

    it('should edit an existing volume', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('original-pvc');
      editWorkspaceKind.typeMountPath('/original');
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.clickVolumeRowKebab(0);
      editWorkspaceKind.clickEditVolume();

      editWorkspaceKind.typePvcName('edited-pvc');
      editWorkspaceKind.typeMountPath('/edited');
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.assertVolumeCount(1);
      editWorkspaceKind.assertVolumeInTable('edited-pvc');
      editWorkspaceKind.assertVolumeNotInTable('original-pvc');
    });

    it('should open detach modal when clicking detach from actions menu', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('detach-test-pvc');
      editWorkspaceKind.typeMountPath('/detach-test');
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.clickVolumeRowKebab(0);
      editWorkspaceKind.clickDetachVolume();

      editWorkspaceKind.assertDetachVolumeModalVisible(true);
    });

    it('should cancel volume detachment', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('cancel-detach-pvc');
      editWorkspaceKind.typeMountPath('/cancel-detach');
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.clickVolumeRowKebab(0);
      editWorkspaceKind.clickDetachVolume();
      editWorkspaceKind.cancelDetachVolume();

      editWorkspaceKind.assertDetachVolumeModalVisible(false);
      editWorkspaceKind.assertVolumeCount(1);
      editWorkspaceKind.assertVolumeInTable('cancel-detach-pvc');
    });

    it('should detach a volume when confirming detachment', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.clickCreateVolume();
      editWorkspaceKind.typePvcName('detach-pvc');
      editWorkspaceKind.typeMountPath('/detach');
      editWorkspaceKind.submitVolumeModal();

      editWorkspaceKind.assertVolumeCount(1);

      editWorkspaceKind.clickVolumeRowKebab(0);
      editWorkspaceKind.clickDetachVolume();
      editWorkspaceKind.confirmDetachVolume();

      editWorkspaceKind.assertDetachVolumeModalVisible(false);
      editWorkspaceKind.assertVolumeCount(0);
    });
  });

  describe('Multiple sections', () => {
    it('should allow multiple sections to be expanded simultaneously', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();
      editWorkspaceKind.expandImageConfigSection();
      editWorkspaceKind.expandPodConfigSection();
      editWorkspaceKind.expandPodTemplateSection();

      editWorkspaceKind.assertPropertiesSectionExpanded(true);
      editWorkspaceKind.assertImageConfigSectionExpanded(true);
      editWorkspaceKind.assertPodConfigSectionExpanded(true);
      editWorkspaceKind.assertPodTemplateSectionExpanded(true);
    });
  });

  describe('Form validation', () => {
    it('should display all required fields', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertWorkspaceKindNameInputVisible();
      editWorkspaceKind.assertIconUrlInputVisible();
      editWorkspaceKind.assertLogoUrlInputVisible();
    });

    it('should allow editing workspace kind name', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();
      const newName = 'Updated Workspace Kind Name';

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.typeWorkspaceKindName(newName);

      editWorkspaceKind.assertWorkspaceKindName(newName);
    });

    it('should allow editing description', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();
      const newDescription = 'Updated description for workspace kind';

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.typeDescription(newDescription);

      editWorkspaceKind.assertDescription(newDescription);
    });

    it('should allow editing icon URL', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();
      const newIconUrl = 'https://example.com/new-icon.png';

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.typeIconUrl(newIconUrl);

      editWorkspaceKind.assertIconUrl(newIconUrl);
    });

    it('should allow editing logo URL', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind();
      const newLogoUrl = 'https://example.com/new-logo.png';

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.typeLogoUrl(newLogoUrl);

      editWorkspaceKind.assertLogoUrl(newLogoUrl);
    });

    it('should allow toggling hidden state', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind({ hidden: false });

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.assertHiddenChecked(false);

      editWorkspaceKind.toggleHidden();

      editWorkspaceKind.assertHiddenChecked(true);
    });

    it('should allow editing deprecation message when deprecated', () => {
      const { mockWorkspaceKind } = setupEditWorkspaceKind({
        deprecated: true,
        deprecationMessage: 'Original message',
      });
      const newMessage = 'Updated deprecation message';

      visitEditWorkspaceKind(mockWorkspaceKind.name);

      editWorkspaceKind.expandPropertiesSection();

      editWorkspaceKind.typeDeprecationMessage(newMessage);

      editWorkspaceKind.assertDeprecationMessage(newMessage);
    });
  });
});
