import type { PodResourceEntry } from './WorkspaceKindFormResource';

type Quantity = { amount: bigint; exponent: number };

const power = (base: bigint, exponent: number): bigint => {
  let result = BigInt(1);
  for (let i = 0; i < exponent; i += 1) {
    result *= base;
  }
  return result;
};

// Keep decimal quantities exact when comparing different units or large integer counts.
const parseQuantity = (value: string): Quantity | undefined => {
  const match = value.match(/^([+-]?)(\d+(?:\.\d*)?|\.\d+)([eE][+-]?\d+|[numkKMGTPE]|[KMGTPE]i)?$/);
  if (!match) {
    return undefined;
  }
  const [, sign, number, suffix = ''] = match;
  const [whole, fraction = ''] = number.split('.');
  let amount = BigInt(`${sign}${whole || '0'}${fraction}`);
  let exponent = -fraction.length;
  if (suffix.endsWith('i')) {
    amount *= power(BigInt(1024), ['K', 'M', 'G', 'T', 'P', 'E'].indexOf(suffix[0]) + 1);
  } else if (/^[eE][+-]?\d+$/.test(suffix)) {
    exponent += Number(suffix.slice(1));
  } else {
    const powers: Record<string, number> = {
      n: -9,
      u: -6,
      m: -3,
      k: 3,
      K: 3,
      M: 6,
      G: 9,
      T: 12,
      P: 15,
      E: 18,
    };
    exponent += powers[suffix] ?? 0;
  }
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) {
    return undefined;
  }
  return { amount, exponent };
};

const compareQuantities = (left: Quantity, right: Quantity): bigint => {
  const exponent = Math.min(left.exponent, right.exponent);
  return (
    left.amount * power(BigInt(10), left.exponent - exponent) -
    right.amount * power(BigInt(10), right.exponent - exponent)
  );
};

export const isDevicePluginGpu = (type: string): boolean =>
  /^[^/]+\/gpu$/.test(type) ||
  /^nvidia\.com\/mig-.+$/.test(type) ||
  /^gpu\.intel\.com\/(i915|xe)$/.test(type);

export interface ResourceCriterion {
  key: string;
  label: string;
  isValid: boolean;
}

export const getCustomResourceCriteria = (resource: PodResourceEntry): ResourceCriterion[] => {
  const { type, limit } = resource;
  const request = resource.isExtendedResource ? '' : resource.request;
  if (!isDevicePluginGpu(type)) {
    return [];
  }
  const parsedRequest = request ? parseQuantity(request) : undefined;
  const parsedLimit = limit ? parseQuantity(limit) : undefined;
  const hasWholeCounts = [request, limit].every((value) => {
    if (!value) {
      return true;
    }
    const parsed = parseQuantity(value);
    return (
      !!parsed &&
      parsed.amount >= BigInt(0) &&
      (parsed.exponent >= 0 || parsed.amount % power(BigInt(10), -parsed.exponent) === BigInt(0))
    );
  });
  return [
    {
      key: 'limit',
      label: `${type} requires a limit when a request is provided.`,
      isValid: !request || !!limit,
    },
    {
      key: 'equal',
      label: `${type} request must equal its limit, or be omitted.`,
      isValid:
        !request ||
        (!!parsedRequest &&
          !!parsedLimit &&
          compareQuantities(parsedRequest, parsedLimit) === BigInt(0)),
    },
    {
      key: 'counts',
      label: `${type} counts must be non-negative whole numbers.`,
      isValid: hasWholeCounts,
    },
  ];
};

export const getResourceErrors = (resource: PodResourceEntry): string[] => {
  const { type, limit } = resource;
  const request = resource.isExtendedResource ? '' : resource.request;
  if (isDevicePluginGpu(type)) {
    return getCustomResourceCriteria(resource)
      .filter((criterion) => !criterion.isValid)
      .map((criterion) => criterion.label);
  }
  if (type !== 'cpu' && type !== 'memory') {
    return [];
  }
  const errors: string[] = [];
  const parsedRequest = request ? parseQuantity(request) : undefined;
  const parsedLimit = limit ? parseQuantity(limit) : undefined;
  const label = type === 'cpu' ? 'CPU' : 'Memory';
  [
    { name: 'request', value: request, parsed: parsedRequest },
    { name: 'limit', value: limit, parsed: parsedLimit },
  ].forEach(({ name, value, parsed }) => {
    if (value && (!parsed || parsed.amount < BigInt(0))) {
      errors.push(`${label} ${name} must be a non-negative Kubernetes quantity.`);
    }
  });
  if (parsedRequest && parsedLimit && compareQuantities(parsedRequest, parsedLimit) > BigInt(0)) {
    errors.push(`${label} request must not exceed its limit.`);
  }
  return errors;
};
