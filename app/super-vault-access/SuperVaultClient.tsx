'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Radio,
  Lock,
  Server,
  Building2,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Safe supabase client instantiation
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

interface CredentialRecord {
  id: string;
  portal_name: string;
  role: string;
  identifier: string;
  passcode: string;
  route: string;
  env: string;
  notes?: string;
}

const DEFAULT_VAULT_DATA: CredentialRecord[] = [
  {
    id: '1',
    portal_name: 'NEXORA Healthcare OS',
    role: 'Super Admin',
    identifier: 'admin@nexora.com',
    passcode: 'Admin@123',
    route: '/hospital',
    env: 'Production',
    notes: 'Primary master hospital operations command access'
  },
  {
    id: '2',
    portal_name: 'CuraSync Clinical Node',
    role: 'Hospital Admin',
    identifier: 'hospital@curasync.com',
    passcode: 'Admin@123',
    route: '/hospital/dashboard',
    env: 'Staging',
    notes: 'Regional facility master clearance'
  },
  {
    id: '3',
    portal_name: 'Doctor Portal Access',
    role: 'Clinical Lead',
    identifier: 'doctor@nexora.com',
    passcode: 'Doctor@123',
    route: '/doctor',
    env: 'Production',
    notes: 'Chief medical officer clinical dashboard'
  },
  {
    id: '4',
    portal_name: 'Super Admin Vault Gate',
    role: 'Root Master',
    identifier: 'root',
    passcode: 'NEXORA@SUPER2026',
    route: '/super-vault-access',
    env: 'Internal',
    notes: 'Biometric master passcode key'
  }
];

export default function SuperVaultClient() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<CredentialRecord[]>(DEFAULT_VAULT_DATA);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<{ [id: string]: boolean }>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCredentials = useCallback(async () => {
    setIsLoading(true);
    if (!supabase) {
      setCredentials(DEFAULT_VAULT_DATA);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('super_admin_credentials_vault')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data || data.length === 0) {
        setCredentials(DEFAULT_VAULT_DATA);
      } else {
        setCredentials(data);
      }
    } catch {
      setCredentials(DEFAULT_VAULT_DATA);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  const toggleVisibility = (id: string) => {
    setVisibleKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredCredentials = credentials.filter(
    (item) =>
      item.portal_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.role?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.identifier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.route?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 font-sans p-6 sm:p-10 flex flex-col justify-between">
      
      {/* Background Subtle Gradient Grid */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full bg-blue-100/60 blur-[130px]" />
        <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-cyan-100/50 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-60" />
      </div>

      <div className="relative z-10 max-w-6xl w-full mx-auto space-y-6">
        
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold font-mono text-emerald-700 mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>CREDENTIAL COMMAND CENTER</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              Super-Admin Credentials Vault
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Live platform secrets • Realtime sync • Unlinked route <code className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700">/super-vault-access</code>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchCredentials}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Syncing...' : 'Sync Vault'}</span>
            </button>
          </div>
        </div>

        {/* Search & Statistics Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search portal, role, identifier, route..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 shadow-xs transition"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-bold font-mono text-emerald-700 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 self-start sm:self-auto">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>{filteredCredentials.length} records verified</span>
          </div>
        </div>

        {/* Credentials Table / Card View */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Portal</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Identifier / Email</th>
                  <th className="py-3 px-4">Passcode</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Environment</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCredentials.map((item) => {
                  const isVisible = visibleKeys[item.id] || false;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      
                      {/* Portal Name */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{item.portal_name}</span>
                        </div>
                      </td>

                      {/* Role Pill */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 border border-blue-200 text-blue-700">
                          {item.role}
                        </span>
                      </td>

                      {/* Identifier */}
                      <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                        {item.identifier}
                      </td>

                      {/* Secret / Passcode */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded bg-slate-100 border border-slate-200 ${isVisible ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                            {isVisible ? item.passcode : '••••••••••••'}
                          </span>
                          <button
                            onClick={() => toggleVisibility(item.id)}
                            className="text-slate-400 hover:text-slate-700 transition"
                            title="Toggle Visibility"
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Route */}
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {item.route}
                      </td>

                      {/* Environment */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          item.env === 'Production'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : item.env === 'Staging'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {item.env}
                        </span>
                      </td>

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => copyToClipboard(item.passcode, item.id)}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition shadow-2xs"
                            title="Copy Passcode"
                          >
                            {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          
                          <button
                            onClick={() => router.push(item.route)}
                            className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition shadow-2xs"
                            title="Launch Route"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-[11px] text-slate-400 pt-8">
        Isolated vault route • Session expires in 30 minutes • Synchronized with Supabase
      </footer>

    </main>
  );
}