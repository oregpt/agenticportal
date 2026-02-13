/**
 * Demo Chat API
 * 
 * Public endpoint for the demo page - uses mock data to demonstrate capabilities
 * POST /api/demo/chat - Process a natural language query
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock responses for demo queries
const MOCK_RESPONSES: Record<string, { message: string; sql: string; results: { columns: string[]; rows: any[] } }> = {
  'orders': {
    message: 'The answer is: 1,247',
    sql: 'SELECT COUNT(*) as order_count FROM orders;',
    results: {
      columns: ['order_count'],
      rows: [{ order_count: 1247 }]
    }
  },
  'products': {
    message: 'Found 5 results:',
    sql: 'SELECT product_name, category, total_sales, revenue FROM products ORDER BY total_sales DESC LIMIT 5;',
    results: {
      columns: ['product_name', 'category', 'total_sales', 'revenue'],
      rows: [
        { product_name: 'Widget Pro', category: 'Electronics', total_sales: 1250, revenue: '$62,500' },
        { product_name: 'Gadget Plus', category: 'Electronics', total_sales: 980, revenue: '$49,000' },
        { product_name: 'Smart Device', category: 'Home', total_sales: 756, revenue: '$37,800' },
        { product_name: 'Premium Bundle', category: 'Bundles', total_sales: 620, revenue: '$31,000' },
        { product_name: 'Basic Kit', category: 'Accessories', total_sales: 450, revenue: '$13,500' }
      ]
    }
  },
  'revenue': {
    message: 'The answer is: $2,847,500',
    sql: 'SELECT SUM(amount) as total_revenue FROM transactions WHERE created_at >= DATE_TRUNC(\'month\', CURRENT_DATE);',
    results: {
      columns: ['total_revenue'],
      rows: [{ total_revenue: '$2,847,500' }]
    }
  },
  'customers': {
    message: 'Found 8 results:',
    sql: 'SELECT name, email, city, total_orders FROM customers WHERE city = \'New York\' ORDER BY total_orders DESC LIMIT 10;',
    results: {
      columns: ['name', 'email', 'city', 'total_orders'],
      rows: [
        { name: 'John Smith', email: 'john@company.com', city: 'New York', total_orders: 47 },
        { name: 'Sarah Johnson', email: 'sarah@startup.io', city: 'New York', total_orders: 35 },
        { name: 'Mike Chen', email: 'mike@tech.co', city: 'New York', total_orders: 28 },
        { name: 'Emily Davis', email: 'emily@corp.com', city: 'New York', total_orders: 24 },
        { name: 'Alex Wilson', email: 'alex@agency.com', city: 'New York', total_orders: 21 },
        { name: 'Lisa Brown', email: 'lisa@firm.com', city: 'New York', total_orders: 18 },
        { name: 'David Lee', email: 'david@ventures.com', city: 'New York', total_orders: 15 },
        { name: 'Jennifer Martinez', email: 'jen@solutions.com', city: 'New York', total_orders: 12 }
      ]
    }
  },
  'categories': {
    message: 'Found 4 results:',
    sql: 'SELECT category, COUNT(*) as product_count, SUM(sales) as total_sales FROM products GROUP BY category ORDER BY total_sales DESC;',
    results: {
      columns: ['category', 'product_count', 'total_sales'],
      rows: [
        { category: 'Electronics', product_count: 45, total_sales: '$892,000' },
        { category: 'Home', product_count: 38, total_sales: '$456,000' },
        { category: 'Accessories', product_count: 67, total_sales: '$234,000' },
        { category: 'Bundles', product_count: 12, total_sales: '$178,000' }
      ]
    }
  },
  'monthly': {
    message: 'Found 6 results:',
    sql: 'SELECT DATE_TRUNC(\'month\', created_at) as month, SUM(amount) as revenue FROM transactions GROUP BY month ORDER BY month;',
    results: {
      columns: ['month', 'revenue'],
      rows: [
        { month: 'January 2025', revenue: '$412,000' },
        { month: 'February 2025', revenue: '$389,000' },
        { month: 'March 2025', revenue: '$467,000' },
        { month: 'April 2025', revenue: '$523,000' },
        { month: 'May 2025', revenue: '$498,000' },
        { month: 'June 2025', revenue: '$558,500' }
      ]
    }
  }
};

function matchQuery(query: string): { message: string; sql: string; results: { columns: string[]; rows: any[] } } | null {
  const q = query.toLowerCase();
  
  if (q.includes('order') && (q.includes('how many') || q.includes('count'))) {
    return MOCK_RESPONSES['orders'];
  }
  if (q.includes('product') && (q.includes('top') || q.includes('best') || q.includes('sales'))) {
    return MOCK_RESPONSES['products'];
  }
  if (q.includes('revenue') || q.includes('total')) {
    return MOCK_RESPONSES['revenue'];
  }
  if (q.includes('customer') && (q.includes('new york') || q.includes('ny'))) {
    return MOCK_RESPONSES['customers'];
  }
  if (q.includes('categor')) {
    return MOCK_RESPONSES['categories'];
  }
  if (q.includes('month') || q.includes('trend')) {
    return MOCK_RESPONSES['monthly'];
  }
  
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

    // Try to match the query to a mock response
    const matched = matchQuery(query);
    
    if (matched) {
      return NextResponse.json(matched);
    }

    // Default response for unmatched queries
    return NextResponse.json({
      message: "I found some relevant data. In a real setup, I'd query your connected database to answer this precisely.",
      sql: `-- This is a demo. Your actual query would be:\nSELECT * FROM your_table WHERE conditions LIMIT 10;`,
      results: {
        columns: ['info'],
        rows: [
          { info: 'Connect your own database to get real results!' },
          { info: 'Supported: PostgreSQL, BigQuery, Google Sheets, and more.' }
        ]
      }
    });
  } catch (error) {
    console.error('Demo chat error:', error);
    
    return NextResponse.json({
      message: "Sorry, I couldn't process that question. Please try rephrasing it.",
      sql: null,
      results: null,
    });
  }
}
