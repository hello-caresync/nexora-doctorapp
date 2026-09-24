'use client';

import { useState } from 'react';
import { Calculator, DollarSign, Landmark, PieChart, Receipt } from 'lucide-react';

import { DataTable, KpiGrid, Panel, SearchDesk, TabBar, ViewHeader } from './_viewUi';

type FinTab = 'ledger' | 'pnl' | 'apar' | 'budget' | 'gst';

export default function FinanceAccountingView() {
  const [tab, setTab] = useState<FinTab>('ledger');
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      <ViewHeader
        title="Finance & Accounting"
        subtitle="Double-entry ledger, P&L, AP/AR, departmental budgets, GST summaries."
        icon={DollarSign}
      />
      <KpiGrid
        items={[
          { label: 'Net Collections MTD', value: 'Γé╣18.4L', icon: DollarSign, tone: 'emerald' },
          { label: 'Accounts Payable', value: 'Γé╣4.2L', icon: Receipt, tone: 'amber' },
          { label: 'Accounts Receivable', value: 'Γé╣6.8L', icon: Landmark, tone: 'cyan' },
          { label: 'Budget Utilization', value: '72%', icon: PieChart, tone: 'indigo' },
        ]}
      />
      <SearchDesk value={search} onChange={setSearch} placeholder="Search ledger entries..." />
      <TabBar
        tabs={[
          { id: 'ledger', label: 'General Ledger' },
          { id: 'pnl', label: 'P&L Overview' },
          { id: 'apar', label: 'AP / AR' },
          { id: 'budget', label: 'Dept Budgets' },
          { id: 'gst', label: 'Tax / GST' },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === 'ledger' && (
        <Panel title="Double-Entry Ledger">
          <DataTable
            columns={['Account', 'Debit', 'Credit', 'Balance']}
            rows={[
              ['Cash & Bank', 'Γé╣4,82,900', 'ΓÇö', 'Γé╣12.4L'],
              ['Revenue ΓÇö OPD', 'ΓÇö', 'Γé╣2,10,000', 'Γé╣8.2L'],
            ]}
          />
        </Panel>
      )}
      {tab === 'pnl' && (
        <Panel title="Profit & Loss Overview Grid">
          <DataTable
            columns={['Line Item', 'MTD', 'YTD']}
            rows={[
              ['Revenue', 'Γé╣18.4L', 'Γé╣1.02Cr'],
              ['Operating Expense', 'Γé╣12.1L', 'Γé╣68L'],
              ['Net Margin', '34%', '33%'],
            ]}
          />
        </Panel>
      )}
      {tab === 'apar' && (
        <Panel title="Accounts Payable / Receivable Summaries">
          <DataTable
            columns={['Party', 'Type', 'Outstanding']}
            rows={[
              ['MedSupply Co.', 'AP', 'Γé╣1.2L'],
              ['Star Health TPA', 'AR', 'Γé╣2.4L'],
            ]}
          />
        </Panel>
      )}
      {tab === 'budget' && (
        <Panel title="Departmental Budget Tracker">
          <DataTable
            columns={['Department', 'Budget', 'Spent', 'Variance']}
            rows={[
              ['Radiology', 'Γé╣8L', 'Γé╣5.6L', '-Γé╣2.4L'],
              ['Pharmacy', 'Γé╣12L', 'Γé╣11.2L', '-Γé╣0.8L'],
            ]}
          />
        </Panel>
      )}
      {tab === 'gst' && (
        <Panel title="Tax / GST Summary Tools">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Calculator className="h-4 w-4 text-cyan-400" />
            Output GST MTD: Γé╣1.84L | Input GST: Γé╣1.12L | Net payable: Γé╣72,000
          </div>
        </Panel>
      )}
    </div>
  );
}
