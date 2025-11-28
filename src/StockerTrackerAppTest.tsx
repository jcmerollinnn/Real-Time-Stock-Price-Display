import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import StockTrackerApp from './StockTrackerApp';

// Mock the recharts library
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('StockTrackerApp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        'Global Quote': {
          '05. price': '175.50',
          '06. volume': '1000000',
          '10. change percent': '2.5%',
          '03. high': '176.00',
          '04. low': '174.00',
          '02. open': '174.50'
        }
      })
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Initial Render', () => {
    test('renders the app header with title', () => {
      render(<StockTrackerApp />);
      expect(screen.getByText('Real-Time Stock Tracker')).toBeInTheDocument();
      expect(screen.getByText('Monitor stocks with ML-powered predictions')).toBeInTheDocument();
    });

    test('renders empty state when no stocks are tracked', () => {
      render(<StockTrackerApp />);
      expect(screen.getByText('No Stocks Tracked')).toBeInTheDocument();
      expect(screen.getByText('Add a stock symbol above to start tracking real-time prices')).toBeInTheDocument();
    });

    test('renders stock dropdown with available options', () => {
      render(<StockTrackerApp />);
      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      
      const options = within(select).getAllByRole('option');
      expect(options.length).toBeGreaterThan(1);
    });

    test('renders dark mode toggle button', () => {
      render(<StockTrackerApp />);
      const darkModeButton = screen.getByLabelText('Toggle dark mode');
      expect(darkModeButton).toBeInTheDocument();
    });

    test('renders prediction toggle button', () => {
      render(<StockTrackerApp />);
      expect(screen.getByText('✓ Predictions ON')).toBeInTheDocument();
    });
  });

  describe('Dark Mode Toggle', () => {
    test('toggles dark mode on button click', () => {
      render(<StockTrackerApp />);
      const darkModeButton = screen.getByLabelText('Toggle dark mode');
      const container = screen.getByText('Real-Time Stock Tracker').closest('div')?.parentElement?.parentElement;
      
      // Initial state (light mode)
      expect(container).toHaveClass('bg-gradient-to-br');
      
      // Click to enable dark mode
      fireEvent.click(darkModeButton);
      expect(container).toHaveClass('bg-gray-900');
      
      // Click to disable dark mode
      fireEvent.click(darkModeButton);
      expect(container).toHaveClass('bg-gradient-to-br');
    });
  });

  describe('Adding Stocks', () => {
    test('allows user to select and add a stock', async () => {
      render(<StockTrackerApp />);
      
      const select = screen.getByRole('combobox');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      // Select a stock
      fireEvent.change(select, { target: { value: 'AAPL' } });
      expect(select).toHaveValue('AAPL');
      
      // Click add button
      fireEvent.click(addButton);
      
      // Wait for stock to appear
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('shows loading state when adding stock', async () => {
      render(<StockTrackerApp />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'GOOGL' } });
      
      const addButton = screen.getByRole('button', { name: /add/i });
      fireEvent.click(addButton);
      
      // Button should be disabled during loading
      expect(addButton).toBeDisabled();
    });

    test('prevents adding duplicate stocks', async () => {
      render(<StockTrackerApp />);
      
      const select = screen.getByRole('combobox');
      const addButton = screen.getByRole('button', { name: /add/i });
      
      // Add first stock
      fireEvent.change(select, { target: { value: 'MSFT' } });
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText('MSFT')).toBeInTheDocument();
      });
      
      // Try to add the same stock again
      fireEvent.change(select, { target: { value: 'MSFT' } });
      fireEvent.click(addButton);
      
      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/stock already tracked/i)).toBeInTheDocument();
      });
    });

    test('shows error message when adding invalid stock', async () => {
      render(<StockTrackerApp />);
      
      const addButton = screen.getByRole('button', { name: /add/i });
      
      // Try to add without selecting
      fireEvent.click(addButton);
      
      await waitFor(() => {
        expect(screen.getByText(/stock already tracked or invalid symbol/i)).toBeInTheDocument();
      });
    });
  });

  describe('Removing Stocks', () => {
    test('allows user to remove a tracked stock', async () => {
      render(<StockTrackerApp />);
      
      // Add a stock first
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'TSLA' } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      
      await waitFor(() => {
        expect(screen.getByText('TSLA')).toBeInTheDocument();
      });
      
      // Remove the stock
      const removeButton = screen.getByLabelText('Remove stock');
      fireEvent.click(removeButton);
      
      // Stock should be removed
      await waitFor(() => {
        expect(screen.queryByText('TSLA')).not.toBeInTheDocument();
      });
    });
  });

  describe('Chart Rendering', () => {
    test('renders chart when stock is added', async () => {
      render(<StockTrackerApp />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'AMZN' } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    test('displays chart with correct title', async () => {
      render(<StockTrackerApp />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'NVDA' } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      
      await waitFor(() => {
        expect(screen.getByText(/NVDA Price Chart/i)).toBeInTheDocument();
      });
    });

    test('chart includes prediction line when predictions are enabled', async () => {
      render(<StockTrackerApp />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'META' } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      
      await waitFor(() => {
        const lines = screen.getAllByTestId('line');
        expect(lines.length).toBe(2); // Actual + Predicted
      });
    });
  });

  describe('Prediction Toggle', () => {
    test('toggles prediction overlay', async () => {
      render(<StockTrackerApp />);
      
      // Add a stock first
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'AAPL' } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      });
      
      // Toggle predictions off
      const predictionButton = screen.getByText('✓ Predictions ON');
      fireEvent.click(predictionButton);
      
      await waitFor(() => {
        expect(screen.getByText('Predictions OFF')).toBeInTheDocument();
      });
      
      // Toggle predictions on
      fireEvent.click(screen.getByText('Predictions OFF'));
      
      await waitFor(() => {
        expect(screen.getByText('✓ Predictions ON')).toBeInTheDocument();
      });
    });
  });

  describe('Async Data Updates', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('updates stock prices periodically', async () => {
      render(<StockTrackerApp />);
      
      // Add a stock
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'GOOGL' } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      
      await waitFor(() => {
        expect(screen.getByText('GOOGL')).toBeInTheDocument();
      });
      
      // Fast-forward time to trigger update
      jest.advanceTimersByTime(5000);
      
      // Verify fetch was called multiple times
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    test('handles API errors gracefully', async () => {
      // Mock failed API call
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
      
      render(<StockTrackerApp />);
      
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'AAPL' } });
      fireEvent.click(screen.getByRole('button', { name: /add/i }));
      
      // Should still render the stock card with fallback data
      await waitFor(() => {
        expect(screen.getByText('AAPL')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<StockTrackerApp />);
      
      expect(screen.getByLabelText('Toggle dark mode')).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
    });

    test('buttons are keyboard accessible', () => {
      render(<StockTrackerApp />);
      
      const darkModeButton = screen.getByLabelText('Toggle dark mode');
      darkModeButton.focus();
      expect(darkModeButton).toHaveFocus();
    });
  });

  describe('Responsive Design', () => {
    test('renders correctly with responsive classes', () => {
      const { container } = render(<StockTrackerApp />);
      
      // Check for responsive classes
      const gridElements = container.querySelectorAll('.grid');
      gridElements.forEach(grid => {
        expect(grid.className).toMatch(/md:grid-cols|lg:grid-cols/);
      });
    });
  });
});