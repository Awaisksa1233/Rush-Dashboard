import { PackageDefinition, LocationDefinition } from '../types/dashboard';
import productionData from './productionCrmData.json';

export const PACKAGES: Record<string, PackageDefinition> = {
  fresh: {
    id: 'fresh',
    name: 'Fresh Wash',
    arabicName: 'باقة فريش',
    monthlyPrice: 100, // MongoDB SPK-00001
    color: '#3b82f6',
    accentBg: '#eff6ff',
    textColor: '#1d4ed8',
    borderColor: '#bfdbfe',
    tag: 'SPK-00001'
  },
  shiny: {
    id: 'shiny',
    name: 'Shiny Wash',
    arabicName: 'باقة براق',
    monthlyPrice: 69, // MongoDB SPK-00002
    color: '#10b981',
    accentBg: '#ecfdf5',
    textColor: '#047857',
    borderColor: '#a7f3d0',
    tag: 'SPK-00002'
  },
  nano: {
    id: 'nano',
    name: 'Nano Ceramic',
    arabicName: 'باقة نانو',
    monthlyPrice: 169, // MongoDB SPK-00003
    color: '#8b5cf6',
    accentBg: '#f5f3ff',
    textColor: '#6d28d9',
    borderColor: '#ddd6fe',
    tag: 'SPK-00003'
  },
  interior_clean: {
    id: 'interior_clean' as any,
    name: 'Interior Clean',
    arabicName: 'تنظيف داخلي',
    monthlyPrice: 79, // MongoDB SPK-00004
    color: '#f59e0b',
    accentBg: '#fffbeb',
    textColor: '#b45309',
    borderColor: '#fde68a',
    tag: 'SPK-00004'
  },
  nano_interior: {
    id: 'nano_interior' as any,
    name: 'Nano + Interior',
    arabicName: 'نانو + تنظيف داخلي',
    monthlyPrice: 219, // MongoDB SPK-00005
    color: '#ec4899',
    accentBg: '#fdf2f8',
    textColor: '#be185d',
    borderColor: '#fbcfe8',
    tag: 'SPK-00005'
  },
  shiny_interior: {
    id: 'shiny_interior' as any,
    name: 'Shiny + Interior',
    arabicName: 'براق + تنظيف داخلي',
    monthlyPrice: 119, // MongoDB SPK-00006
    color: '#06b6d4',
    accentBg: '#ecfeff',
    textColor: '#0e7490',
    borderColor: '#a5f3fc',
    tag: 'SPK-00006'
  }
};


export const LOCATIONS: LocationDefinition[] = [
  { id: 'all', name: 'All Locations (Kingdom-wide)', city: 'Saudi Arabia' },
  { id: 'loc_alkharj', name: 'Al Kharj — King Abdullah Road (HQ Branch) [SHP-00001]', city: 'Al Kharj' }
];

export const REAL_DB_RECORDS = {
  validMembers: (productionData.validMembers && productionData.validMembers.length > 0)
    ? productionData.validMembers.slice(0, 50)
    : [],
  failedRenewals: (productionData.failedRenewals && productionData.failedRenewals.length > 0)
    ? productionData.failedRenewals.slice(0, 50).map((r: any) => ({
        id: r.id,
        customer: r.customer,
        phone: r.phone,
        car: r.car,
        pkg: r.pkg,
        amount: r.amount || r.mrr,
        reason: r.reason,
        attempts: r.attempts,
        status: r.status,
        lastAttempt: r.lastAttempt,
        recoverable: true
      }))
    : [],
  voluntaryChurns: (productionData.voluntaryChurns && productionData.voluntaryChurns.length > 0)
    ? productionData.voluntaryChurns.slice(0, 50).map((r: any) => ({
        id: r.id,
        customer: r.customer,
        phone: r.phone,
        pkg: r.pkg,
        reason: r.reason,
        tenureMonths: r.tenureMonths,
        ltv: r.ltv,
        churnDate: r.churnDate
      }))
    : [],
  washEvents: (productionData.washEvents && productionData.washEvents.length > 0)
    ? productionData.washEvents.slice(0, 20)
    : []
};


