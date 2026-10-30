import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from '@swc/core';
import type { getResourceErrors } from '~/app/pages/WorkspaceKinds/Form/podConfig/resourceValidation';

describe('resource validation in the development build', () => {
  it('compares Kubernetes quantities after SWC transpilation', () => {
    const filename = 'src/app/pages/WorkspaceKinds/Form/podConfig/resourceValidation.ts';
    const source = readFileSync(filename, 'utf8');
    const { code } = transformSync(source, {
      filename,
      jsc: { parser: { syntax: 'typescript' } },
      module: { type: 'commonjs' },
    });
    const exports = {} as { getResourceErrors: typeof getResourceErrors };
    runInNewContext(code, { exports, BigInt });
    const validate = (type: string, request: string, limit: string) =>
      exports.getResourceErrors({ id: 'resource', type, request, limit });

    expect(validate('memory', '1024Mi', '1Gi')).toHaveLength(0);
    expect(validate('cpu', '500m', '1')).toHaveLength(0);
    expect(validate('nvidia.com/gpu', '', '0.5')).toHaveLength(1);
  });
});
