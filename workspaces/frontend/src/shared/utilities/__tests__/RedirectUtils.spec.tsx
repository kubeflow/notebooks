import {
  transformRedirectMessageLevel,
  transformRedirectToChain,
  getMessageLevelColor,
  getMessageLevelText,
  OptionValue,
} from '~/shared/utilities/RedirectUtils';
import {
  OptionsRedirectMessageLevel,
  WorkspacesRedirectMessageLevel,
} from '~/generated/data-contracts';

describe('RedirectUtils', () => {
  describe('transformRedirectMessageLevel', () => {
    it('transforms levels correctly', () => {
      expect(
        transformRedirectMessageLevel(OptionsRedirectMessageLevel.RedirectMessageLevelInfo),
      ).toBe(WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo);
      expect(
        transformRedirectMessageLevel(OptionsRedirectMessageLevel.RedirectMessageLevelWarning),
      ).toBe(WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning);
      expect(
        transformRedirectMessageLevel(OptionsRedirectMessageLevel.RedirectMessageLevelDanger),
      ).toBe(WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger);
      expect(transformRedirectMessageLevel(undefined)).toBe(
        WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo,
      );
    });
  });

  describe('transformRedirectToChain', () => {
    const allOptions = [
      { id: 'opt-b', displayName: 'Option B', description: 'Desc B', labels: [] },
    ] as unknown as OptionValue[];

    it('returns undefined if no redirect', () => {
      expect(
        transformRedirectToChain({ id: 'opt-a' } as unknown as OptionValue, []),
      ).toBeUndefined();
    });

    it('builds a single step chain', () => {
      const optionA = {
        id: 'opt-a',
        displayName: 'Option A',
        description: 'Desc A',
        labels: [],
        redirect: { to: 'opt-b', message: { level: 'info', text: 'Msg' } },
      } as unknown as OptionValue;

      const chain = transformRedirectToChain(optionA, allOptions);
      expect(chain).toHaveLength(1);
      expect(chain![0].source.displayName).toBe('Option A');
      expect(chain![0].target.displayName).toBe('Option B');
      expect(chain![0].message?.text).toBe('Msg');
    });

    it('handles missing target gracefully', () => {
      const optionA = {
        id: 'opt-a',
        displayName: 'Option A',
        redirect: { to: 'missing' },
      } as unknown as OptionValue;

      const chain = transformRedirectToChain(optionA, []);
      expect(chain![0].target.displayName).toContain('not found');
    });
  });

  describe('getMessageLevelColor', () => {
    it('returns correct colors', () => {
      expect(getMessageLevelColor(WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo)).toBe(
        'blue',
      );
      expect(getMessageLevelColor(WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning)).toBe(
        'orange',
      );
      expect(getMessageLevelColor(WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger)).toBe(
        'red',
      );
    });
  });

  describe('getMessageLevelText', () => {
    it('returns correct text', () => {
      expect(getMessageLevelText(WorkspacesRedirectMessageLevel.RedirectMessageLevelInfo)).toBe(
        'Info',
      );
      expect(getMessageLevelText(WorkspacesRedirectMessageLevel.RedirectMessageLevelWarning)).toBe(
        'Warning',
      );
      expect(getMessageLevelText(WorkspacesRedirectMessageLevel.RedirectMessageLevelDanger)).toBe(
        'Danger',
      );
    });
  });
});
