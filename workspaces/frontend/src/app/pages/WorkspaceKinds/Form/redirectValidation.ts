import yaml from 'js-yaml';
import { RedirectOption, traceRedirects } from '~/app/utils/redirectGraph';

export type RedirectOptionType = 'imageConfig' | 'podConfig';
export interface RedirectValidationError {
  optionType: RedirectOptionType;
  index: number;
  sourceId: string;
  message: string;
  cycle?: string[];
}

export const validateOptionRedirects = ({
  values,
  optionType,
}: {
  values: readonly RedirectOption[];
  optionType: RedirectOptionType;
}): RedirectValidationError[] => {
  const options = new Map(
    values.map((option) => [
      option.id,
      {
        ...option,
        redirect: option.redirect?.to ? option.redirect : undefined,
      },
    ]),
  );
  return values.flatMap((option, index) => {
    const trace = traceRedirects({ startId: option.id, options });
    if (trace.cycle) {
      return [
        {
          optionType,
          index,
          sourceId: option.id,
          cycle: trace.cycle,
          message: `${option.id}: redirect cycle ${trace.cycle.join(' → ')}. Choose another target or remove a redirect.`,
        },
      ];
    }
    if (option.redirect?.to && !options.has(option.redirect.to)) {
      return [
        {
          optionType,
          index,
          sourceId: option.id,
          message: `${option.id}: redirect target "${option.redirect.to}" does not exist. Choose another target or remove the redirect.`,
        },
      ];
    }
    return [];
  });
};

export const validateRedirects = (options: {
  imageConfig: { values?: readonly RedirectOption[] };
  podConfig: { values?: readonly RedirectOption[] };
}): RedirectValidationError[] => [
  ...validateOptionRedirects({
    values: options.imageConfig.values ?? [],
    optionType: 'imageConfig',
  }),
  ...validateOptionRedirects({ values: options.podConfig.values ?? [], optionType: 'podConfig' }),
];

export const getDraftRedirectError = ({
  values,
  draft,
  editIndex,
  optionType,
}: {
  values: readonly RedirectOption[];
  draft: RedirectOption;
  editIndex: number | null;
  optionType: RedirectOptionType;
}): string | undefined => {
  const prospective = [...values];
  const index = editIndex ?? prospective.length;
  prospective[index] = draft;
  return validateOptionRedirects({ values: prospective, optionType }).find(
    (error) => error.index === index,
  )?.message;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readOptions = (value: unknown): RedirectOption[] => {
  if (!isRecord(value) || !Array.isArray(value.values)) {
    throw new Error('Redirect validation requires option values arrays.');
  }
  return value.values.map((option: unknown) => {
    if (!isRecord(option) || typeof option.id !== 'string') {
      throw new Error('Each option must have a string ID.');
    }
    if (
      option.redirect !== undefined &&
      (!isRecord(option.redirect) || typeof option.redirect.to !== 'string')
    ) {
      throw new Error(`Option "${option.id}" must have a string redirect target.`);
    }
    return {
      id: option.id,
      redirect: isRecord(option.redirect) ? { to: String(option.redirect.to) } : undefined,
    };
  });
};

export const validateYamlRedirects = ({
  value,
  isCreate,
}: {
  value: string;
  isCreate: boolean;
}): {
  errors: RedirectValidationError[];
  parseError?: string;
} => {
  try {
    const parsed: unknown = yaml.load(value);
    const spec = isCreate && isRecord(parsed) ? parsed.spec : parsed;
    if (!isRecord(spec) || !isRecord(spec.podTemplate) || !isRecord(spec.podTemplate.options)) {
      throw new Error('Redirect validation requires podTemplate.options.');
    }
    const { options } = spec.podTemplate;
    return {
      errors: validateRedirects({
        imageConfig: { values: readOptions(options.imageConfig) },
        podConfig: { values: readOptions(options.podConfig) },
      }),
    };
  } catch (error) {
    return { errors: [], parseError: error instanceof Error ? error.message : 'Invalid YAML' };
  }
};
