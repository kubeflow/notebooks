import yaml from 'js-yaml';

// For testing purposes, a YAML string is considered invalid if it contains a specific pattern in the metadata name.
export function isInvalidYaml(yamlString: string): boolean {
  const parsed = yaml.load(yamlString) as { metadata?: { name?: string } };
  return parsed.metadata?.name?.includes('-invalid') ?? false;
}
