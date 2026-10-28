import type { PodResourceEntry } from './WorkspaceKindFormResource';

type Quantity = { amount: bigint; exponent: number };

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
    amount *= BigInt(1024) ** BigInt(['K', 'M', 'G', 'T', 'P', 'E'].indexOf(suffix[0]) + 1);
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
    left.amount * BigInt(10) ** BigInt(left.exponent - exponent) -
    right.amount * BigInt(10) ** BigInt(right.exponent - exponent)
  );
};

export const isDevicePluginGpu = (type: string): boolean =>
  /^[^/]+\/gpu$/.test(type) ||
  /^nvidia\.com\/mig-.+$/.test(type) ||
  /^gpu\.intel\.com\/(i915|xe)$/.test(type);

export const getResourceErrors = (resource: PodResourceEntry): string[] => {
  const { type, request, limit } = resource;
  const isGpu = isDevicePluginGpu(type);
  if (type !== 'cpu' && type !== 'memory' && !isGpu) {
    return [];
  }
  const errors: string[] = [];
  const parsedRequest = request ? parseQuantity(request) : undefined;
  const parsedLimit = limit ? parseQuantity(limit) : undefined;
  const label = type === 'cpu' ? 'CPU' : type === 'memory' ? 'Memory' : type;
  const values = [
    { name: 'request', value: request, parsed: parsedRequest },
    { name: 'limit', value: limit, parsed: parsedLimit },
  ];
  values.forEach(({ name, value, parsed }) => {
    if (!value) {
      return;
    }
    if (!parsed || parsed.amount < BigInt(0)) {
      errors.push(
        `${label} ${name} must be a non-negative ${isGpu ? 'whole number' : 'Kubernetes quantity'}.`,
      );
    } else if (
      isGpu &&
      parsed.exponent < 0 &&
      parsed.amount % BigInt(10) ** BigInt(-parsed.exponent) !== BigInt(0)
    ) {
      errors.push(`${label} ${name} must be a non-negative whole number.`);
    }
  });
  if (isGpu && request && !limit) {
    errors.push(
      `${label} requires a limit. Set a limit and either omit the request or make it equal to the limit.`,
    );
  }
  if (parsedRequest && parsedLimit) {
    const difference = compareQuantities(parsedRequest, parsedLimit);
    if (isGpu && difference !== BigInt(0)) {
      errors.push(`${label} request must equal its limit. You can also omit the request.`);
    } else if (!isGpu && difference > BigInt(0)) {
      errors.push(`${label} request must not exceed its limit.`);
    }
  }
  return errors;
};
