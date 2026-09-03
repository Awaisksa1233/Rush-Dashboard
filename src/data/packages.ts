import { PackageDefinition, LocationDefinition } from '../types/dashboard';

export const PACKAGES: Record<string, PackageDefinition> = {
  fresh: {
    id: 'fresh',
    name: 'Fresh Wash',
    arabicName: 'باقة فريش',
    monthlyPrice: 149,
    color: '#3b82f6', // Bright royal blue
    accentBg: '#eff6ff',
    textColor: '#1d4ed8',
    borderColor: '#bfdbfe',
    tag: 'Entry Express'
  },
  shiny: {
    id: 'shiny',
    name: 'Shiny Wash',
    arabicName: 'باقة شايني',
    monthlyPrice: 199,
    color: '#10b981', // Emerald green
    accentBg: '#ecfdf5',
    textColor: '#047857',
    borderColor: '#a7f3d0',
    tag: 'Most Popular'
  },
  nano: {
    id: 'nano',
    name: 'Nano Ceramic',
    arabicName: 'باقة نانو سيراميك',
    monthlyPrice: 289,
    color: '#8b5cf6', // Violet
    accentBg: '#f5f3ff',
    textColor: '#6d28d9',
    borderColor: '#ddd6fe',
    tag: 'Premium Gloss'
  },
  interior_addon: {
    id: 'interior_addon',
    name: 'Interior Care Add-on',
    arabicName: 'إضافة تنظيف داخلي',
    monthlyPrice: 99,
    color: '#f59e0b', // Warm Amber
    accentBg: '#fffbeb',
    textColor: '#b45309',
    borderColor: '#fde68a',
    tag: 'Add-on Pack'
  }
};

export const LOCATIONS: LocationDefinition[] = [
  { id: 'all', name: 'All Locations (Kingdom-wide)', city: 'Saudi Arabia' },
  { id: 'loc_riyadh_north', name: 'Riyadh — Northern Ring Road', city: 'Riyadh' },
  { id: 'loc_riyadh_olaya', name: 'Riyadh — Olaya Branch', city: 'Riyadh' },
  { id: 'loc_jeddah_corniche', name: 'Jeddah — North Corniche', city: 'Jeddah' },
  { id: 'loc_dammam_corniche', name: 'Dammam — Khobar Coastal Road', city: 'Eastern Province' }
];

export const MOCK_RECORDS = {
  validMembers: [
    { id: 'SUB-10891', customer: 'Fahad Al-Otaibi', phone: '+966 50 123 4567', car: 'Lexus LX600 (KSA 4821)', pkg: 'Nano Ceramic', status: 'Auto-Renew Active', mrr: 289, validUntil: '2026-09-28', branch: 'Riyadh — Northern Ring Road', washesUsedThisPeriod: 4 },
    { id: 'SUB-10892', customer: 'Sultan Al-Ghamdi', phone: '+966 55 982 1102', car: 'Land Cruiser (KSA 1102)', pkg: 'Shiny Wash', status: 'Auto-Renew Active', mrr: 199, validUntil: '2026-09-22', branch: 'Riyadh — Olaya Branch', washesUsedThisPeriod: 3 },
    { id: 'SUB-10893', customer: 'Reem Al-Shehri', phone: '+966 54 332 9988', car: 'Porsche Macan (KSA 7719)', pkg: 'Nano Ceramic', status: 'Auto-Renew Active', mrr: 289, validUntil: '2026-10-04', branch: 'Jeddah — North Corniche', washesUsedThisPeriod: 5 },
    { id: 'SUB-10894', customer: 'Mohammed Al-Dosari', phone: '+966 56 441 2309', car: 'Ford F-150 (KSA 9921)', pkg: 'Fresh Wash', status: 'Auto-Renew Active', mrr: 149, validUntil: '2026-09-18', branch: 'Dammam — Khobar Coastal Road', washesUsedThisPeriod: 2 },
    { id: 'SUB-10895', customer: 'Abdullah Al-Subaie', phone: '+966 50 771 6652', car: 'Mercedes G63 (KSA 8000)', pkg: 'Nano Ceramic', status: 'Cancelled / Valid Until Expiry', mrr: 289, validUntil: '2026-09-14', branch: 'Riyadh — Northern Ring Road', washesUsedThisPeriod: 3 },
    { id: 'SUB-10896', customer: 'Khalid Al-Harbi', phone: '+966 53 661 2299', car: 'Toyota Camry (KSA 3314)', pkg: 'Shiny Wash', status: 'Auto-Renew Active', mrr: 199, validUntil: '2026-09-29', branch: 'Riyadh — Olaya Branch', washesUsedThisPeriod: 4 },
    { id: 'SUB-10897', customer: 'Nora Al-Zahrani', phone: '+966 55 440 9182', car: 'Genesis GV80 (KSA 5143)', pkg: 'Nano Ceramic', status: 'Cancelled / Valid Until Expiry', mrr: 289, validUntil: '2026-09-11', branch: 'Jeddah — North Corniche', washesUsedThisPeriod: 2 },
    { id: 'SUB-10898', customer: 'Bader Al-Mutairi', phone: '+966 58 119 4433', car: 'BMW X5 (KSA 6620)', pkg: 'Shiny Wash', status: 'Auto-Renew Active', mrr: 199, validUntil: '2026-09-25', branch: 'Riyadh — Northern Ring Road', washesUsedThisPeriod: 3 },
  ],
  failedRenewals: [
    { id: 'REN-4402', customer: 'Turki Al-Qahtani', phone: '+966 50 882 1992', car: 'GMC Yukon (KSA 2049)', pkg: 'Shiny Wash', amount: 199, reason: 'Insufficient Funds', attempts: 2, status: 'Retry Scheduled (Day 4)', lastAttempt: '2026-09-02 08:30', recoverable: true },
    { id: 'REN-4403', customer: 'Majed Al-Anazi', phone: '+966 56 123 9944', car: 'Nissan Patrol (KSA 8831)', pkg: 'Nano Ceramic', amount: 289, reason: 'Do Not Honour / Bank Decline', attempts: 1, status: 'Retry Scheduled (Day 2)', lastAttempt: '2026-09-03 04:15', recoverable: true },
    { id: 'REN-4404', customer: 'Saud Al-Shammary', phone: '+966 54 991 3321', car: 'Toyota Prado (KSA 4412)', pkg: 'Fresh Wash', amount: 149, reason: 'Expired Card (08/26)', attempts: 3, status: 'Card Update Link Sent', lastAttempt: '2026-09-01 14:20', recoverable: true },
    { id: 'REN-4405', customer: 'Ahmed Al-Shehri', phone: '+966 55 771 8899', car: 'Hyundai Tucson (KSA 6192)', pkg: 'Shiny Wash', amount: 199, reason: 'Restricted Card', attempts: 3, status: 'Final Failure — Terminated', lastAttempt: '2026-08-30 11:00', recoverable: false },
    { id: 'REN-4406', customer: 'Rayan Al-Dossari', phone: '+966 53 228 1144', car: 'Chevrolet Tahoe (KSA 7731)', pkg: 'Nano Ceramic', amount: 289, reason: 'Insufficient Funds', attempts: 2, status: 'Retry Scheduled (Day 3)', lastAttempt: '2026-09-02 19:40', recoverable: true },
    { id: 'REN-4407', customer: 'Ibrahim Al-Bishi', phone: '+966 50 442 8811', car: 'Audi Q7 (KSA 9122)', pkg: 'Shiny Wash', amount: 199, reason: 'Technical Gateway Timeout', attempts: 1, status: 'Instant Auto-Retry Queued', lastAttempt: '2026-09-03 16:10', recoverable: true },
  ],
  voluntaryChurns: [
    { id: 'CHURN-812', customer: 'Waleed Al-Amri', phone: '+966 50 331 4488', pkg: 'Nano Ceramic', reason: 'Customer Relocated', tenureMonths: 8, ltv: 2312, churnDate: '2026-09-01' },
    { id: 'CHURN-813', customer: 'Hassan Al-Zamil', phone: '+966 54 882 1199', pkg: 'Shiny Wash', reason: 'Sold Vehicle', tenureMonths: 5, ltv: 995, churnDate: '2026-08-29' },
    { id: 'CHURN-814', customer: 'Omar Al-Juhani', phone: '+966 56 771 0022', pkg: 'Fresh Wash', reason: 'Not washing frequently enough', tenureMonths: 2, ltv: 298, churnDate: '2026-08-28' },
    { id: 'CHURN-815', customer: 'Saad Al-Kaltham', phone: '+966 55 221 9933', pkg: 'Shiny Wash', reason: 'Price / Value sensitivity', tenureMonths: 4, ltv: 796, churnDate: '2026-08-27' },
  ],
  newSales: [
    { id: 'SALE-501', customer: 'Bandar Al-Olayan', car: 'Lucid Air (KSA 1001)', pkg: 'Nano Ceramic', amount: 289, type: 'New Customer', channel: 'On-site POS (Riyadh North)', date: '2026-09-03 14:15' },
    { id: 'SALE-502', customer: 'Mona Al-Malki', car: 'Range Rover Sport (KSA 3390)', pkg: 'Shiny Wash', amount: 199, type: 'New Customer', channel: 'Mobile Web App', date: '2026-09-03 12:40' },
    { id: 'SALE-503', customer: 'Ziyad Al-Husseini', car: 'BMW M4 (KSA 9982)', pkg: 'Nano Ceramic', amount: 289, type: 'Reactivation (Win-back)', channel: 'SMS Win-back Promo', date: '2026-09-03 10:20' },
    { id: 'SALE-504', customer: 'Fahad Al-Sudairy', car: 'Lexus RX350 (KSA 4190)', pkg: 'Shiny Wash + Interior', amount: 298, type: 'Upgrade (Fresh to Shiny+Interior)', channel: 'Staff Assisted (Olaya)', date: '2026-09-02 18:50' },
  ]
};
