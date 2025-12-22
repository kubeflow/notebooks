import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ToolbarFilter, {
  FilterConfigMap,
  ToolbarFilterRef,
} from '~/shared/components/ToolbarFilter';

// Mock ThemeAwareSearchInput to simplify testing
jest.mock('~/app/components/ThemeAwareSearchInput', () => {
  const MockSearchInput = ({
    value,
    onChange,
    placeholder,
    'data-testid': testId,
  }: {
    value: string;
    onChange: (val: string) => void;
    placeholder: string;
    'data-testid': string;
  }) => (
    <input
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
  return MockSearchInput;
});

describe('ToolbarFilter', () => {
  const textFilterConfig = {
    name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
    desc: {
      type: 'text',
      label: 'Description',
      placeholder: 'Filter by description',
    },
  } as const satisfies FilterConfigMap<string>;

  const mixedFilterConfig = {
    name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
    status: {
      type: 'select',
      label: 'Status',
      placeholder: 'Filter by status',
      options: [
        { value: 'Active', label: 'Active' },
        { value: 'Inactive', label: 'Inactive' },
      ],
    },
  } as const satisfies FilterConfigMap<string>;

  const defaultProps = {
    filterConfig: textFilterConfig,
    visibleFilterKeys: ['name', 'desc'] as const,
    filterValues: { name: '', desc: '' },
    onFilterChange: jest.fn(),
    onClearAllFilters: jest.fn(),
    testIdPrefix: 'filter',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the toolbar with correct id based on testIdPrefix', () => {
      render(<ToolbarFilter {...defaultProps} />);

      expect(screen.getByTestId('filter-toolbar')).toBeInTheDocument();
    });

    it('should render the attribute dropdown with first filter selected', () => {
      render(<ToolbarFilter {...defaultProps} />);

      const dropdown = screen.getByTestId('filter-dropdown');
      expect(dropdown).toBeInTheDocument();
      expect(dropdown).toHaveTextContent('Name');
    });

    it('should render the first filter input by default', () => {
      render(<ToolbarFilter {...defaultProps} />);

      expect(screen.getByTestId('filter-name-input')).toBeInTheDocument();
    });

    it('should render toolbar actions when provided', () => {
      const toolbarActions = <button data-testid="custom-action">Custom Action</button>;

      render(<ToolbarFilter {...defaultProps} toolbarActions={toolbarActions} />);

      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
    });

    it('should use custom testIdPrefix when provided', () => {
      render(<ToolbarFilter {...defaultProps} testIdPrefix="custom-prefix" />);

      expect(screen.getByTestId('custom-prefix-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('custom-prefix-name-input')).toBeInTheDocument();
    });

    it('should render with different first visible filter', () => {
      render(<ToolbarFilter {...defaultProps} visibleFilterKeys={['desc', 'name']} />);

      const dropdown = screen.getByTestId('filter-dropdown');
      expect(dropdown).toHaveTextContent('Description');
      expect(screen.getByTestId('filter-desc-input')).toBeInTheDocument();
    });
  });

  describe('Attribute dropdown interactions', () => {
    it('should open the dropdown when clicked', async () => {
      const user = userEvent.setup();
      render(<ToolbarFilter {...defaultProps} />);

      const dropdown = screen.getByTestId('filter-dropdown');
      await user.click(dropdown);

      expect(dropdown).toHaveAttribute('aria-expanded', 'true');
    });

    it('should render filter options in the dropdown menu', async () => {
      const user = userEvent.setup();
      render(<ToolbarFilter {...defaultProps} />);

      await user.click(screen.getByTestId('filter-dropdown'));

      expect(screen.getByTestId('filter-dropdown-name')).toBeInTheDocument();
      expect(screen.getByTestId('filter-dropdown-desc')).toBeInTheDocument();
    });
  });

  describe('Text filter', () => {
    it('should display the current filter value', () => {
      render(<ToolbarFilter {...defaultProps} filterValues={{ name: 'test-value', desc: '' }} />);

      const input = screen.getByTestId('filter-name-input') as HTMLInputElement;
      expect(input.value).toBe('test-value');
    });

    it('should call onFilterChange when text is entered', async () => {
      const user = userEvent.setup();
      const onFilterChange = jest.fn();
      render(<ToolbarFilter {...defaultProps} onFilterChange={onFilterChange} />);

      const input = screen.getByTestId('filter-name-input');
      await user.type(input, 'a');

      expect(onFilterChange).toHaveBeenCalledWith('name', 'a');
    });

    it('should pass the placeholder from config', () => {
      render(<ToolbarFilter {...defaultProps} />);

      const input = screen.getByTestId('filter-name-input');
      expect(input).toHaveAttribute('placeholder', 'Filter by name');
    });
  });

  describe('Select filter', () => {
    const selectOnlyConfig = {
      status: {
        type: 'select',
        label: 'Status',
        placeholder: 'Filter by status',
        options: [
          { value: 'Active', label: 'Active' },
          { value: 'Inactive', label: 'Inactive' },
        ],
      },
    } as const satisfies FilterConfigMap<string>;

    const selectProps = {
      filterConfig: selectOnlyConfig,
      visibleFilterKeys: ['status'] as const,
      filterValues: { status: '' },
      onFilterChange: jest.fn(),
      onClearAllFilters: jest.fn(),
      testIdPrefix: 'filter',
    };

    it('should render a select dropdown for select filter type', () => {
      render(<ToolbarFilter {...selectProps} />);

      expect(screen.getByTestId('filter-status-dropdown')).toBeInTheDocument();
    });

    it('should display the placeholder in the select toggle', () => {
      render(<ToolbarFilter {...selectProps} />);

      const selectToggle = screen.getByTestId('filter-status-dropdown');
      expect(selectToggle).toHaveTextContent('Filter by status');
    });

    it('should open select dropdown when clicked', async () => {
      const user = userEvent.setup();
      render(<ToolbarFilter {...selectProps} />);

      const selectToggle = screen.getByTestId('filter-status-dropdown');
      await user.click(selectToggle);

      expect(selectToggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('should render select options when dropdown is open', async () => {
      const user = userEvent.setup();
      render(<ToolbarFilter {...selectProps} />);

      await user.click(screen.getByTestId('filter-status-dropdown'));

      expect(screen.getByTestId('filter-status-active')).toBeInTheDocument();
      expect(screen.getByTestId('filter-status-inactive')).toBeInTheDocument();
    });

    it('should call onFilterChange when an option is clicked', async () => {
      const user = userEvent.setup();
      const onFilterChange = jest.fn();
      render(<ToolbarFilter {...selectProps} onFilterChange={onFilterChange} />);

      await user.click(screen.getByTestId('filter-status-dropdown'));

      const activeOption = screen.getByTestId('filter-status-active');
      await user.click(activeOption);

      expect(activeOption).toBeInTheDocument();
    });
  });

  describe('Filter chips', () => {
    it('should display a chip when a filter has a value', () => {
      render(<ToolbarFilter {...defaultProps} filterValues={{ name: 'test-filter', desc: '' }} />);

      expect(screen.getByText('test-filter')).toBeInTheDocument();
    });

    it('should display chips for multiple filters with values', () => {
      render(
        <ToolbarFilter
          {...defaultProps}
          filterValues={{ name: 'name-filter', desc: 'desc-filter' }}
        />,
      );

      expect(screen.getByText('name-filter')).toBeInTheDocument();
      expect(screen.getByText('desc-filter')).toBeInTheDocument();
    });

    it('should call onFilterChange with empty string when chip is deleted', async () => {
      const user = userEvent.setup();
      const onFilterChange = jest.fn();
      render(
        <ToolbarFilter
          {...defaultProps}
          filterValues={{ name: 'test-filter', desc: '' }}
          onFilterChange={onFilterChange}
        />,
      );

      const chip = screen.getByText('test-filter').closest('.pf-v6-c-label') as HTMLElement;
      expect(chip).toBeInTheDocument();

      const closeButton = within(chip).getByRole('button', { name: /close/i });
      await user.click(closeButton);
      expect(onFilterChange).toHaveBeenCalledWith('name', '');
    });
  });

  describe('Clear all filters', () => {
    it('should show clear all filters button when filters are active', () => {
      render(<ToolbarFilter {...defaultProps} filterValues={{ name: 'test-filter', desc: '' }} />);

      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });

    it('should call onClearAllFilters when clear button is clicked', async () => {
      const user = userEvent.setup();
      const onClearAllFilters = jest.fn();
      render(
        <ToolbarFilter
          {...defaultProps}
          filterValues={{ name: 'test-filter', desc: '' }}
          onClearAllFilters={onClearAllFilters}
        />,
      );

      await user.click(screen.getByText('Clear all filters'));

      expect(onClearAllFilters).toHaveBeenCalled();
    });
  });

  describe('Ref methods', () => {
    it('should expose clearAll method via ref that calls onClearAllFilters', () => {
      const onClearAllFilters = jest.fn();
      const ref = React.createRef<ToolbarFilterRef<keyof typeof textFilterConfig>>();

      render(<ToolbarFilter {...defaultProps} ref={ref} onClearAllFilters={onClearAllFilters} />);

      expect(ref.current).not.toBeNull();
      ref.current?.clearAll();

      expect(onClearAllFilters).toHaveBeenCalled();
    });

    it('should expose setFilter method via ref that calls onFilterChange', () => {
      const onFilterChange = jest.fn();
      const ref = React.createRef<ToolbarFilterRef<keyof typeof textFilterConfig>>();

      render(<ToolbarFilter {...defaultProps} ref={ref} onFilterChange={onFilterChange} />);

      expect(ref.current).not.toBeNull();
      ref.current?.setFilter('name', 'ref-value');

      expect(onFilterChange).toHaveBeenCalledWith('name', 'ref-value');
    });
  });

  describe('Hidden filter chips', () => {
    it('should render chips for filters with values not in visibleFilterKeys', () => {
      const extendedConfig = {
        name: { type: 'text', label: 'Name', placeholder: 'Filter by name' },
        desc: { type: 'text', label: 'Description', placeholder: 'Filter by description' },
        extra: { type: 'text', label: 'Extra', placeholder: 'Filter by extra' },
      } as const satisfies FilterConfigMap<string>;

      type ExtendedFilterKeys = keyof typeof extendedConfig;
      const extendedFilterValues: Record<ExtendedFilterKeys, string> = {
        name: '',
        desc: '',
        extra: 'extra-value',
      };

      render(
        <ToolbarFilter
          filterConfig={extendedConfig}
          visibleFilterKeys={['name', 'desc']}
          filterValues={extendedFilterValues}
          onFilterChange={jest.fn()}
          onClearAllFilters={jest.fn()}
          testIdPrefix="filter"
        />,
      );

      expect(screen.getByText('extra-value')).toBeInTheDocument();
    });
  });

  describe('Mixed filter types', () => {
    const mixedProps = {
      filterConfig: mixedFilterConfig,
      visibleFilterKeys: ['name', 'status'] as const,
      filterValues: { name: '', status: '' },
      onFilterChange: jest.fn(),
      onClearAllFilters: jest.fn(),
      testIdPrefix: 'filter',
    };

    it('should render text filter by default when first filter is text type', () => {
      render(<ToolbarFilter {...mixedProps} />);

      expect(screen.getByTestId('filter-name-input')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-status-dropdown')).not.toBeInTheDocument();
    });

    it('should render correct filter type based on active filter', () => {
      render(<ToolbarFilter {...mixedProps} visibleFilterKeys={['status', 'name']} />);

      expect(screen.getByTestId('filter-status-dropdown')).toBeInTheDocument();
      expect(screen.queryByTestId('filter-name-input')).not.toBeInTheDocument();
    });
  });

  describe('Multiselect filter', () => {
    const multiselectConfig = {
      tags: {
        type: 'multiselect',
        label: 'Tags',
        placeholder: 'Filter by tags',
        options: [
          { value: 'frontend', label: 'Frontend' },
          { value: 'backend', label: 'Backend' },
          { value: 'database', label: 'Database' },
        ],
      },
    } as const satisfies FilterConfigMap<string>;

    const multiselectProps = {
      filterConfig: multiselectConfig,
      visibleFilterKeys: ['tags'],
      filterValues: { tags: [] },
      onFilterChange: jest.fn(),
      onClearAllFilters: jest.fn(),
      testIdPrefix: 'filter',
    };

    it('should render a multiselect dropdown for multiselect filter type', () => {
      render(<ToolbarFilter {...multiselectProps} />);

      expect(screen.getByTestId('filter-tags-dropdown')).toBeInTheDocument();
    });

    it('should display the placeholder in the multiselect toggle', () => {
      render(<ToolbarFilter {...multiselectProps} />);

      const selectToggle = screen.getByTestId('filter-tags-dropdown');
      expect(selectToggle).toHaveTextContent('Filter by tags');
    });

    it('should keep placeholder and show badge when values are selected', () => {
      render(
        <ToolbarFilter {...multiselectProps} filterValues={{ tags: ['frontend', 'backend'] }} />,
      );

      const selectToggle = screen.getByTestId('filter-tags-dropdown');
      expect(selectToggle).toHaveTextContent('Filter by tags');
      expect(selectToggle).toHaveTextContent('2');
    });

    it('should open multiselect dropdown when clicked', async () => {
      const user = userEvent.setup();
      render(<ToolbarFilter {...multiselectProps} />);

      const selectToggle = screen.getByTestId('filter-tags-dropdown');
      await user.click(selectToggle);

      expect(selectToggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('should render multiselect options with checkboxes when dropdown is open', async () => {
      const user = userEvent.setup();
      render(<ToolbarFilter {...multiselectProps} />);

      await user.click(screen.getByTestId('filter-tags-dropdown'));

      expect(screen.getByTestId('filter-tags-frontend')).toBeInTheDocument();
      expect(screen.getByTestId('filter-tags-backend')).toBeInTheDocument();
      expect(screen.getByTestId('filter-tags-database')).toBeInTheDocument();
    });

    it('should display chips for each selected value in multiselect', () => {
      render(
        <ToolbarFilter {...multiselectProps} filterValues={{ tags: ['frontend', 'backend'] }} />,
      );

      expect(screen.getByText('frontend')).toBeInTheDocument();
      expect(screen.getByText('backend')).toBeInTheDocument();
    });

    it('should call onFilterChange with updated array when chip is deleted', async () => {
      const user = userEvent.setup();
      const onFilterChange = jest.fn();
      render(
        <ToolbarFilter
          {...multiselectProps}
          filterValues={{ tags: ['frontend', 'backend'] }}
          onFilterChange={onFilterChange}
        />,
      );

      const chip = screen.getByText('frontend').closest('.pf-v6-c-label') as HTMLElement;
      expect(chip).toBeInTheDocument();

      const closeButton = within(chip).getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onFilterChange).toHaveBeenCalledWith('tags', ['backend']);
    });
  });
});
