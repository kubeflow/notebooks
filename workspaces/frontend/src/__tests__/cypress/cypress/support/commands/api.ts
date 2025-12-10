import type { UserSettings } from 'mod-arch-core';
import type {
  ApiErrorEnvelope,
  ApiNamespaceListEnvelope,
  ApiWorkspaceActionPauseEnvelope,
  ApiWorkspaceCreateEnvelope,
  ApiWorkspaceEnvelope,
  ApiWorkspaceKindEnvelope,
  ApiWorkspaceKindListEnvelope,
  ApiWorkspaceListEnvelope,
  HealthCheckHealthCheck,
} from '~/generated/data-contracts';

export const NOTEBOOKS_API_VERSION = 'v1';

type Replacement<R extends string = string> = Record<R, string | undefined>;
type Query<Q extends string = string> = Record<Q, string>;
type Options = { path?: Replacement; query?: Query; times?: number } | null;

/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Cypress {
    interface Chainable {
      interceptApi: ((
        type: 'GET /api/:apiVersion/user',
        options: { path: { apiVersion: string } },
        response: UserSettings,
      ) => Cypress.Chainable<null>) &
        ((
          type: 'GET /api/:apiVersion/healthcheck',
          options: { path: { apiVersion: string } },
          response: HealthCheckHealthCheck | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'GET /api/:apiVersion/namespaces',
          options: { path: { apiVersion: string } },
          response: ApiNamespaceListEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'GET /api/:apiVersion/workspaces',
          options: { path: { apiVersion: string } },
          response: ApiWorkspaceListEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'GET /api/:apiVersion/workspaces/:namespace',
          options: { path: { apiVersion: string; namespace: string } },
          response: ApiWorkspaceListEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'GET /api/:apiVersion/workspaces/:namespace/:workspaceName',
          options: { path: { apiVersion: string; namespace: string; workspaceName: string } },
          response: ApiWorkspaceEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'POST /api/:apiVersion/workspaces/:namespace',
          options: { path: { apiVersion: string; namespace: string } },
          response: ApiWorkspaceCreateEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'PUT /api/:apiVersion/workspaces/:namespace/:workspaceName',
          options: { path: { apiVersion: string; namespace: string; workspaceName: string } },
          response: ApiWorkspaceEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'DELETE /api/:apiVersion/workspaces/:namespace/:workspaceName',
          options: { path: { apiVersion: string; namespace: string; workspaceName: string } },
          response: void | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'POST /api/:apiVersion/workspaces/:namespace/:workspaceName/actions/pause',
          options: { path: { apiVersion: string; namespace: string; workspaceName: string } },
          response: ApiWorkspaceActionPauseEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'PUT /api/:apiVersion/workspaces/:namespace/:workspaceName',
          options: { path: { apiVersion: string; namespace: string; workspaceName: string } },
          response: ApiWorkspaceEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'GET /api/:apiVersion/workspacekinds',
          options: { path: { apiVersion: string } },
          response: ApiWorkspaceKindListEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'GET /api/:apiVersion/workspacekinds/:kind',
          options: { path: { apiVersion: string; kind: string } },
          response: ApiWorkspaceKindEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>) &
        ((
          type: 'POST /api/:apiVersion/workspacekinds',
          options: { path: { apiVersion: string } },
          response: ApiWorkspaceKindEnvelope | ApiErrorEnvelope,
        ) => Cypress.Chainable<null>);
    }
  }
}

Cypress.Commands.add(
  'interceptApi',
  (type: string, ...args: [Options | null, unknown] | [unknown]) => {
    if (!type) {
      throw new Error('Invalid type parameter.');
    }
    const options = args.length === 2 ? args[0] : null;
    const response = (args.length === 2 ? args[1] : args[0]) ?? '';

    const pathParts = type.match(/:[a-z][a-zA-Z0-9-_]+/g);
    const [method, staticPathname] = type.split(' ');
    let pathname = staticPathname;
    if (pathParts?.length) {
      if (!options || !options.path) {
        throw new Error(`${type}: missing path replacements`);
      }
      const { path: pathReplacements } = options;
      pathParts.forEach((p) => {
        // remove the starting column from the regex match
        const part = p.substring(1);
        const replacement = pathReplacements[part];
        if (!replacement) {
          throw new Error(`${type} missing path replacement: ${part}`);
        }
        pathname = pathname.replace(new RegExp(`:${part}\\b`), replacement);
      });
    }

    // Check if response is an ApiErrorEnvelope and extract status code
    let interceptResponse = response;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasError = (obj: any): obj is { error: { code: string } } =>
      typeof obj === 'object' &&
      obj !== null &&
      'error' in obj &&
      typeof obj.error?.code === 'string';

    if (hasError(response)) {
      const statusCode = parseInt(response.error.code, 10);
      interceptResponse = {
        statusCode,
        body: response,
      };
    }

    return cy.intercept(
      {
        method,
        pathname: `/${pathname}`,
        query: options?.query,
        ...(options?.times && { times: options.times }),
      },
      interceptResponse,
    );
  },
);
