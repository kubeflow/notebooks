import { generateWorkspaceSlug } from '~/app/pages/Workspaces/Form/utils/slugify';

describe('generateWorkspaceSlug', () => {
  it('converts display name to valid RFC1123 slug', () => {
    // cspell:disable-next-line
    expect(generateWorkspaceSlug("Bella's GPU Training Run")).toBe('bellas-gpu-training-run');
  });

  it('replaces spaces and underscores with dashes and lowercases', () => {
    expect(generateWorkspaceSlug('My_Workspace Test')).toBe('my-workspace-test');
  });

  it('strips special invalid characters', () => {
    expect(generateWorkspaceSlug('Project #123! @GPU')).toBe('project-123-gpu');
  });

  it('strips leading dashes or dots', () => {
    expect(generateWorkspaceSlug('---..test-workspace')).toBe('test-workspace');
  });

  it('collapses consecutive dashes into one', () => {
    expect(generateWorkspaceSlug('My --- Workspace')).toBe('my-workspace');
  });

  it('collapses consecutive dashes from double underscores', () => {
    expect(generateWorkspaceSlug('Foo__Bar')).toBe('foo-bar');
  });

  it('truncates to 253 characters', () => {
    const longName = 'a'.repeat(300);
    expect(generateWorkspaceSlug(longName).length).toBe(253);
  });

  it('provides a fallback if display name contains only special characters/emojis', () => {
    expect(generateWorkspaceSlug('!@#$%^&*()')).toBe('workspace-1');
  });
});
