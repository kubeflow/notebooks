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

// Match Kubernetes IsExtendedResourceName, including validation of the quota-prefixed name.
export const isExtendedResourceName = (name: string): boolean => {
  if (!name.includes('/') || name.includes('kubernetes.io/') || name.startsWith('requests.')) {
    return false;
  }
  const parts = `requests.${name}`.split('/');
  if (parts.length !== 2) {
    return false;
  }
  const [prefix, resource] = parts;
  const dnsLabel = '[a-z0-9](?:[-a-z0-9]*[a-z0-9])?';
  return (
    prefix.length <= 253 &&
    new RegExp(`^${dnsLabel}(?:\\.${dnsLabel})*$`).test(prefix) &&
    resource.length <= 63 &&
    /^[a-zA-Z0-9](?:[-_.a-zA-Z0-9]*[a-zA-Z0-9])?$/.test(resource)
  );
};

// cspell:ignore hugepages
export const isHugePageResourceName = (name: string): boolean => name.startsWith('hugepages-');

export const requiresMatchingResources = (name: string): boolean =>
  isExtendedResourceName(name) || isHugePageResourceName(name);

export const getResourceErrors = ({ type, request, limit }: PodResourceEntry): string[] => {
  if (!type) {
    return [];
  }
  const extended = isExtendedResourceName(type);
  const hugePages = isHugePageResourceName(type);
  if (!extended && !hugePages && !['cpu', 'memory', 'ephemeral-storage'].includes(type)) {
    return [
      `${type} is not a supported resource name. Extended resources require a valid domain prefix, such as example.com/device.`,
    ];
  }
  const errors: string[] = [];
  const parsedRequest = request ? parseQuantity(request) : undefined;
  const parsedLimit = limit ? parseQuantity(limit) : undefined;
  const label = type === 'cpu' ? 'CPU' : type === 'memory' ? 'Memory' : type;
  [
    { name: 'request', value: request, parsed: parsedRequest },
    { name: 'limit', value: limit, parsed: parsedLimit },
  ].forEach(({ name, value, parsed }) => {
    if (!value) {
      return;
    }
    if (!parsed || parsed.amount < BigInt(0)) {
      errors.push(
        `${label} ${name} must be a non-negative ${extended ? 'whole number' : 'Kubernetes quantity'}.`,
      );
    } else if (
      extended &&
      parsed.exponent < 0 &&
      parsed.amount % power(BigInt(10), -parsed.exponent) !== BigInt(0)
    ) {
      errors.push(`${label} ${name} must be a non-negative whole number.`);
    }
  });
  if (parsedRequest && parsedLimit) {
    const difference = compareQuantities(parsedRequest, parsedLimit);
    if ((extended || hugePages) && difference !== BigInt(0)) {
      errors.push(`${label} request must equal its limit, or be omitted.`);
    } else if (!extended && !hugePages && difference > BigInt(0)) {
      errors.push(`${label} request must not exceed its limit.`);
    }
  }
  if (hugePages) {
    // cspell:ignore hugepages
    const pageSize = parseQuantity(type.slice('hugepages-'.length));
    if (!pageSize || pageSize.amount <= BigInt(0)) {
      errors.push(`${label} must specify a positive page size.`);
    } else {
      [parsedRequest, parsedLimit].forEach((quantity) => {
        if (quantity) {
          const exponent = Math.min(quantity.exponent, pageSize.exponent);
          const amount = quantity.amount * power(BigInt(10), quantity.exponent - exponent);
          const page = pageSize.amount * power(BigInt(10), pageSize.exponent - exponent);
          if (amount % page !== BigInt(0)) {
            errors.push(`${label} quantities must be multiples of the page size.`);
          }
        }
      });
    }
  }
  return errors;
};
