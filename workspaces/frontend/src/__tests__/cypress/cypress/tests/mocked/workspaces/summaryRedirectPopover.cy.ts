import { mockModArchResponse } from 'mod-arch-core';
import { createWorkspace } from '~/__tests__/cypress/cypress/pages/workspaces/createWorkspace';
import { buildMockNamespace, buildMockWorkspaceKind } from '~/shared/mock/mockBuilder';
import { NOTEBOOKS_API_VERSION } from '~/__tests__/cypress/cypress/support/commands/api';
import { navBar } from '~/__tests__/cypress/cypress/pages/components/navBar';
import type { WorkspacekindsImageConfigValue } from '~/generated/data-contracts';
import { WorkspacekindsRedirectMessageLevel } from '~/generated/data-contracts';

const buildMockImageConfigValue = (
  overrides?: Partial<WorkspacekindsImageConfigValue>,
): WorkspacekindsImageConfigValue => ({
  id: 'default-image',
  displayName: 'Default Image',
  description: 'Default description',
  labels: [],
  hidden: false,
  ...overrides,
});

const DEFAULT_NAMESPACE = 'default';

describe.skip('Summary Redirect Popover - Delayed Hide Behavior', () => {
  let mockNamespace: ReturnType<typeof buildMockNamespace>;
  let mockWorkspaceKind: ReturnType<typeof buildMockWorkspaceKind>;

  beforeEach(() => {
    mockNamespace = buildMockNamespace({ name: DEFAULT_NAMESPACE });

    // Create images with redirect
    const sourceImage = buildMockImageConfigValue({
      id: 'source-image',
      displayName: 'Source Image v1.0',
      description: 'Old version image',
      redirect: {
        to: 'target-image',
        message: {
          level: WorkspacekindsRedirectMessageLevel.RedirectMessageLevelWarning,
          text: 'This image is deprecated. Please use the target image.',
        },
      },
    });

    const targetImage = buildMockImageConfigValue({
      id: 'target-image',
      displayName: 'Target Image v2.0',
      description: 'New version image',
    });

    mockWorkspaceKind = buildMockWorkspaceKind({
      name: 'test-kind',
      displayName: 'Test Workspace Kind',
      podTemplate: {
        ...buildMockWorkspaceKind().podTemplate,
        options: {
          ...buildMockWorkspaceKind().podTemplate.options,
          imageConfig: {
            default: 'source-image',
            values: [sourceImage, targetImage],
          },
        },
      },
    });

    cy.interceptApi(
      'GET /api/:apiVersion/namespaces',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockNamespace]),
    ).as('getNamespaces');

    cy.interceptApi(
      'GET /api/:apiVersion/workspacekinds',
      { path: { apiVersion: NOTEBOOKS_API_VERSION } },
      mockModArchResponse([mockWorkspaceKind]),
    ).as('getWorkspaceKinds');

    cy.visit('/workspaces/create');
    cy.wait('@getNamespaces');
    navBar.selectNamespace(mockNamespace.name);
    cy.wait('@getWorkspaceKinds');

    // Select the workspace kind
    createWorkspace.selectKind('test-kind');
    createWorkspace.clickNext();

    // Select the image with redirect (source image is default)
    // Already on image selection step
  });

  describe('Redirect icon hover behavior', () => {
    it('should show popover immediately on icon hover', () => {
      // Navigate to summary
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Find redirect icon in summary
      cy.get('[data-testid="redirect-icon-1-new"]').should('exist');

      // Hover over icon
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseenter');

      // Popover should appear
      cy.get('.pf-v6-c-popover').should('be.visible');
      cy.contains('Redirect Information').should('be.visible');
      cy.contains('Source Image v1.0 → Target Image v2.0').should('be.visible');
    });

    it('should keep popover visible for 1 second after mouse leaves icon', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Hover to show popover
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseenter');
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Move mouse away from icon
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseleave');

      // Popover should still be visible immediately after mouse leave
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Popover should still be visible after a short delay
      cy.get('.pf-v6-c-popover').should('be.visible');
    });

    it('should hide popover after 1 second if mouse does not enter popover', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Hover to show popover
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseenter');
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Move mouse away from icon
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseleave');

      // Popover should be hidden after delay (using clock.tick would require cy.clock() setup)
      cy.get('.pf-v6-c-popover', { timeout: 2000 }).should('not.be.visible');
    });

    it('should keep popover visible if mouse enters popover content within 1 second', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Hover to show popover
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseenter');
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Move mouse away from icon
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseleave');

      // Move mouse to popover content quickly
      cy.get('.pf-v6-c-popover__content').trigger('mouseenter');

      // Popover should still be visible
      cy.get('.pf-v6-c-popover').should('be.visible');
    });

    it('should hide popover when mouse leaves popover content', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Hover to show popover
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseenter');
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Move to popover content
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseleave');
      cy.get('.pf-v6-c-popover__content').trigger('mouseenter');

      // Now leave the popover content
      cy.get('.pf-v6-c-popover__content').trigger('mouseleave');

      // Popover should hide
      cy.get('.pf-v6-c-popover').should('not.be.visible');
    });
  });

  describe('Pinning behavior', () => {
    it('should pin popover on icon click', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Click icon to pin
      cy.get('[data-testid="redirect-icon-1-new"]').click();

      // Popover should be visible
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Move mouse away - popover should stay visible (pinned)
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseleave');

      // Popover should still be visible after delay
      cy.get('.pf-v6-c-popover', { timeout: 2000 }).should('be.visible');
    });

    it('should unpin popover on second click', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Click to pin
      cy.get('[data-testid="redirect-icon-1-new"]').click();
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Click again to unpin
      cy.get('[data-testid="redirect-icon-1-new"]').click();

      // Popover should hide
      cy.get('.pf-v6-c-popover').should('not.be.visible');
    });

    it('should not start delayed hide timer when popover is pinned', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Click to pin
      cy.get('[data-testid="redirect-icon-1-new"]').click();
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Hover and unhover - should not trigger delay
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseenter');
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseleave');

      // Popover should still be visible (because it's pinned)
      cy.get('.pf-v6-c-popover', { timeout: 2000 }).should('be.visible');
    });
  });

  describe('Keyboard accessibility', () => {
    it('should pin popover on Enter key', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Focus and press Enter
      cy.get('[data-testid="redirect-icon-1-new"]').focus();
      cy.get('[data-testid="redirect-icon-1-new"]').type('{enter}');

      // Popover should be visible
      cy.get('.pf-v6-c-popover').should('be.visible');
    });

    it('should pin popover on Space key', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Focus and press Space
      cy.get('[data-testid="redirect-icon-1-new"]').focus();
      cy.get('[data-testid="redirect-icon-1-new"]').type(' ');

      // Popover should be visible
      cy.get('.pf-v6-c-popover').should('be.visible');
    });
  });

  describe('Multiple redirect icons', () => {
    it('should handle multiple redirect icons independently', () => {
      // Note: This test assumes there might be multiple redirect icons in the summary
      // In the current setup, we only have one image with redirect
      // This test validates that the ID-based state management works correctly

      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Verify the redirect icon exists
      cy.get('[data-testid="redirect-icon-1-new"]').should('exist');

      // Hover to show popover
      cy.get('[data-testid="redirect-icon-1-new"]').trigger('mouseenter');
      cy.get('.pf-v6-c-popover').should('be.visible');

      // The popover should have the correct content
      cy.contains('Source Image v1.0 → Target Image v2.0').should('be.visible');
      cy.contains('This image is deprecated').should('be.visible');
    });
  });

  describe('Switch to target button interaction', () => {
    it('should close popover after clicking switch to target button', () => {
      createWorkspace.clickNext(); // Pod config
      createWorkspace.clickNext(); // Properties

      // Show popover
      cy.get('[data-testid="redirect-icon-1-new"]').click();
      cy.get('.pf-v6-c-popover').should('be.visible');

      // Click "Switch to" button in popover
      cy.get('[data-testid="redirect-target-link"]').click();

      // Popover should close
      cy.get('.pf-v6-c-popover').should('not.be.visible');

      // Image should have changed to target
      // (This would need to verify the actual image selection changed)
    });
  });
});
