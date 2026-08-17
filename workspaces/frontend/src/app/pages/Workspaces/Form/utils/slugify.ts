export const generateWorkspaceSlug = (displayName: string): string => {
  if (!displayName) {
    return '';
  }

  let slug = displayName.replace(/[^a-zA-Z0-9\-._\s]/g, '');
  slug = slug.replace(/[\s_]+/g, '-');
  slug = slug.replace(/-+/g, '-');
  slug = slug.toLowerCase();
  slug = slug.replace(/^[^a-z0-9]+/, '');
  slug = slug.slice(0, 253);
  slug = slug.replace(/[^a-z0-9]+$/, '');

  if (!slug) {
    return 'workspace-1';
  }

  return slug;
};
