'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, IndianRupee } from 'lucide-react';

import {
  MasterDataTable,
  MasterPanel,
  MasterSearchBar,
  MasterTabBar,
  MasterViewHeader,
} from './_masterLightUi';

type ServiceCategory =
  | 'Consultation'
  | 'Lab'
  | 'Radiology'
  | 'Procedure'
  | 'Admission'
  | 'OT'
  | 'Ambulance';

type Service = {
  id: string;
  category: ServiceCategory;
  name: string;
  standardRate: string;
  panelRate: string;
};

const SEED_SERVICES: Service[] = [
  { id: 'S01', category: 'Consultation', name: 'Senior Consultant OPD Fee', standardRate: 'Γé╣800', panelRate: 'Γé╣650' },
  { id: 'S02', category: 'Consultation', name: 'Super Specialist Review', standardRate: 'Γé╣1,200', panelRate: 'Γé╣950' },
  { id: 'S03', category: 'Lab', name: 'Complete Blood Count (CBC)', standardRate: 'Γé╣350', panelRate: 'Γé╣280' },
  { id: 'S04', category: 'Lab', name: 'Liver Function Panel', standardRate: 'Γé╣620', panelRate: 'Γé╣490' },
  { id: 'S05', category: 'Radiology', name: 'Chest X-Ray PA View', standardRate: 'Γé╣600', panelRate: 'Γé╣480' },
  { id: 'S06', category: 'Radiology', name: 'CT Brain Plain', standardRate: 'Γé╣4,800', panelRate: 'Γé╣4,200' },
  { id: 'S07', category: 'Procedure', name: 'Wound Dressing ΓÇö Major', standardRate: 'Γé╣450', panelRate: 'Γé╣380' },
  { id: 'S08', category: 'Admission', name: 'General Ward ΓÇö Daily Tariff', standardRate: 'Γé╣2,200', panelRate: 'Γé╣1,850' },
  { id: 'S09', category: 'OT', name: 'Minor OT Surgeon Charges', standardRate: 'Γé╣4,500', panelRate: 'Γé╣3,900' },
  { id: 'S10', category: 'Ambulance', name: 'Basic Life Support Transfer (10 km)', standardRate: 'Γé╣1,500', panelRate: 'Γé╣1,200' },
];

const CATEGORY_TABS: ServiceCategory[] = [
  'Consultation',
  'Lab',
  'Radiology',
  'Procedure',
  'Admission',
  'OT',
  'Ambulance',
];

export default function MasterServicesView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ServiceCategory>('Consultation');

  const filtered = useMemo(
    () =>
      SEED_SERVICES.filter(
        (s) =>
          s.category === category &&
          (s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.standardRate.includes(search) ||
            s.panelRate.includes(search)),
      ),
    [search, category],
  );

  return (
    <div className="space-y-6">
      <MasterViewHeader
        title="Core Services Catalog"
        subtitle="Standardized price listings with corporate panel rate differentials across charge categories."
        icon={ClipboardList}
      />

      <MasterSearchBar value={search} onChange={setSearch} placeholder="Search tariff line itemsΓÇª" />

      <MasterTabBar
        tabs={CATEGORY_TABS.map((c) => ({ id: c, label: c }))}
        active={category}
        onChange={setCategory}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category Items</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Panel Differential Avg</p>
          <p className="mt-1 flex items-center gap-1 text-2xl font-bold text-blue-600">
            <IndianRupee className="h-5 w-5" />
            ~18%
          </p>
        </div>
      </div>

      <MasterPanel
        title={`${category} Charging Matrix`}
        description="Standard rate vs corporate panel rate comparison"
      >
        <MasterDataTable
          columns={['Service', 'Standard Rate', 'Corporate Panel Rate', 'Differential']}
          rows={filtered.map((s) => {
            const std = parseInt(s.standardRate.replace(/\D/g, ''), 10) || 0;
            const panel = parseInt(s.panelRate.replace(/\D/g, ''), 10) || 0;
            const diff = std > 0 ? `${Math.round(((std - panel) / std) * 100)}%` : 'ΓÇö';
            return [
              <span key="n" className="font-semibold text-slate-800">
                {s.name}
              </span>,
              <span key="std" className="font-semibold tabular-nums text-slate-800">
                {s.standardRate}
              </span>,
              <span key="panel" className="font-semibold tabular-nums text-blue-600">
                {s.panelRate}
              </span>,
              <span
                key="diff"
                className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700"
              >
                ΓêÆ{diff}
              </span>,
            ];
          })}
        />
      </MasterPanel>
    </div>
  );
}
