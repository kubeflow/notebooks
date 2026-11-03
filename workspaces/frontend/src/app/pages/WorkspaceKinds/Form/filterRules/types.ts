import { FilterRuleEntry } from '~/app/types';
import { OptionsOptionLabel } from '~/generated/data-contracts';

export interface FilterRuleLabelSuggestions {
  imageConfig: OptionsOptionLabel[];
  podConfig: OptionsOptionLabel[];
}

export interface WorkspaceKindFormFilterRulesProps {
  filterRules: FilterRuleEntry[];
  updateFilterRules: (rules: FilterRuleEntry[]) => void;
  labelSuggestions: FilterRuleLabelSuggestions;
}

export interface FilterRuleModalProps {
  /** Omit when adding a rule. Mount a fresh modal for each editing session. */
  rule?: FilterRuleEntry;
  labelSuggestions: FilterRuleLabelSuggestions;
  onApply: (rule: FilterRuleEntry) => void;
  onCancel: () => void;
}
