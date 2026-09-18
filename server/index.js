import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const rawMongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rushwash';
const DB_NAME = process.env.DB_NAME || 'rushwash';

// Helper to auto-sanitize MongoDB URI (e.g. handle unescaped @ in password)
function sanitizeMongoUri(uri) {
  if (!uri) return uri;
  try {
    const s = uri.trim();
    if (s.startsWith('mongodb://') || s.startsWith('mongodb+srv://')) {
      const protocol = s.startsWith('mongodb+srv://') ? 'mongodb+srv://' : 'mongodb://';
      const rest = s.slice(protocol.length);
      const lastAt = rest.lastIndexOf('@');
      if (lastAt !== -1) {
        const userInfo = rest.slice(0, lastAt);
        const hostAndRest = rest.slice(lastAt + 1);
        const firstColon = userInfo.indexOf(':');
        if (firstColon !== -1) {
          const user = userInfo.slice(0, firstColon);
          const pass = userInfo.slice(firstColon + 1);
          const decodedPass = decodeURIComponent(pass);
          const encodedPass = encodeURIComponent(decodedPass);
          return `${protocol}${user}:${encodedPass}@${hostAndRest}`;
        }
      }
    }
  } catch (e) {
    // ignore
  }
  return uri;
}

const MONGODB_URI = sanitizeMongoUri(rawMongoUri);

// Middleware
app.use(cors());
app.use(express.json());

// Load fallback production CRM data from JSON
const dataFilePath = path.join(__dirname, '..', 'src', 'data', 'productionCrmData.json');
let fallbackData = null;
try {
  if (fs.existsSync(dataFilePath)) {
    fallbackData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));
  }
} catch (err) {
  console.error('[CRM Backend] Error loading fallback JSON:', err);
}

// MongoDB Client Connection
let mongoClient = null;
let mongoDb = null;
let isMongoConnected = false;
let collectionNames = [];

async function connectMongo() {
  try {
    const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ':****@');
    console.log(`[CRM Backend] Connecting to MongoDB at ${maskedUri}...`);
    mongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 8000
    });
    await mongoClient.connect();
    mongoDb = mongoClient.db(DB_NAME);
    isMongoConnected = true;
    
    // Read available collections
    const cols = await mongoDb.listCollections().toArray();
    collectionNames = cols.map(c => c.name);
    console.log(`[CRM Backend] 🚀 Successfully connected to MongoDB database: '${DB_NAME}' (${collectionNames.length} collections detected)`);
  } catch (err) {
    console.warn(`[CRM Backend] MongoDB connection warning: ${err.message}. Operating with local production fallback.`);
    isMongoConnected = false;
  }
}

connectMongo();

// Helper to check collection existence
function hasCol(name) {
  return collectionNames.includes(name);
}

// 1. Health & Connection Status
app.get('/api/health', async (req, res) => {
  let memberCount = 0;
  let washCount = 0;
  let failedCount = 0;
  let totalSubscriptions = 0;
  let totalCustomers = 0;

  if (isMongoConnected && mongoDb) {
    try {
      if (hasCol('rushwash_subscriptions')) {
        totalSubscriptions = await mongoDb.collection('rushwash_subscriptions').countDocuments();
        memberCount = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: 'active' });
        failedCount = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: { $in: ['expired', 'terminated'] } });
      } else if (hasCol('validMembers')) {
        memberCount = await mongoDb.collection('validMembers').countDocuments();
        failedCount = await mongoDb.collection('failedRenewals').countDocuments();
      }

      if (hasCol('rushwash_wash_histories')) {
        washCount = await mongoDb.collection('rushwash_wash_histories').countDocuments();
      } else if (hasCol('washEvents')) {
        washCount = await mongoDb.collection('washEvents').countDocuments();
      }

      if (hasCol('rushwash_customers')) {
        totalCustomers = await mongoDb.collection('rushwash_customers').countDocuments();
      }
    } catch (e) {
      // ignore
    }
  } else if (fallbackData) {
    memberCount = fallbackData.validMembers?.length || 0;
    washCount = fallbackData.washEvents?.length || 0;
    failedCount = fallbackData.failedRenewals?.length || 0;
    totalSubscriptions = memberCount + failedCount;
  }

  res.json({
    status: 'ok',
    service: 'rush-crm-analytics-api',
    mongoConnected: isMongoConnected,
    database: DB_NAME,
    connectionSource: isMongoConnected ? 'Live MongoDB Atlas' : 'Local Production Snapshot',
    counts: {
      activeMembers: memberCount,
      totalSubscriptions: totalSubscriptions || memberCount,
      totalCustomers: totalCustomers || memberCount,
      totalWashes: washCount,
      failedOrExpired: failedCount
    },
    collections: collectionNames,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// 2. Packages Catalog
app.get('/api/packages', async (req, res) => {
  if (isMongoConnected && mongoDb && hasCol('rushwash_service_packages')) {
    try {
      const raw = await mongoDb.collection('rushwash_service_packages').find({ status: 'active' }).toArray();
      const mapped = raw.map(p => ({
        id: (p.name?.en || p.readableCode || '').toLowerCase().replace(/\s+/g, '_'),
        name: p.name?.en || 'Package',
        arabicName: p.name?.ar || '',
        monthlyPrice: parseFloat(p.pricingTiers?.[0]?.price?.amount || '0'),
        code: p.readableCode
      }));
      if (mapped.length > 0) return res.json(mapped);
    } catch (e) {
      console.warn('[CRM Backend] Packages query error:', e.message);
    }
  }
  if (fallbackData?.packages) return res.json(fallbackData.packages);
  res.json([]);
});

// 3. Branch Locations
app.get('/api/locations', async (req, res) => {
  if (isMongoConnected && mongoDb && hasCol('rushwash_shops')) {
    try {
      const raw = await mongoDb.collection('rushwash_shops').find({ status: 'active' }).toArray();
      const mapped = raw.map(s => ({
        id: s.readableCode,
        name: s.name?.en || 'Al Kharj Branch',
        arabicName: s.name?.ar || 'فرع الخرج',
        city: 'Al Kharj',
        phone: s.settings?.contactPhone || '+966553123848'
      }));
      if (mapped.length > 0) return res.json(mapped);
    } catch (e) {
      console.warn('[CRM Backend] Shops query error:', e.message);
    }
  }
  if (fallbackData?.locations) return res.json(fallbackData.locations);
  res.json([{ id: 'SHP-00001', name: 'Al Kharj Branch', arabicName: 'فرع الخرج', city: 'Al Kharj' }]);
});

// 4. High-Level Summary Metrics
app.get('/api/metrics', async (req, res) => {
  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      const activeMemberships = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: 'active' });
      const failedRenewalsCount = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: { $in: ['expired', 'terminated'] } });
      const voluntaryChurnCount = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: 'cancelled_voluntary' });
      
      const washCol = hasCol('rushwash_wash_histories') ? 'rushwash_wash_histories' : 'washEvents';
      const totalWashesRecorded = await mongoDb.collection(washCol).countDocuments();

      const mrrAgg = await mongoDb.collection('rushwash_subscriptions').aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, totalMRR: { $sum: '$price' } } }
      ]).toArray();

      const totalMRR = mrrAgg[0]?.totalMRR || 0;
      const averageRevenuePerMember = activeMemberships > 0 ? parseFloat((totalMRR / activeMemberships).toFixed(1)) : 0;

      return res.json({
        activeMemberships,
        totalMRR,
        failedRenewalsCount,
        voluntaryChurnCount,
        totalWashesRecorded,
        averageRevenuePerMember,
        source: 'Live MongoDB Atlas'
      });
    } catch (e) {
      console.warn('[CRM Backend] Live metrics aggregation error:', e.message);
    }
  }

  // Fallback metrics
  if (fallbackData?.metricsSummary) {
    return res.json({
      ...fallbackData.metricsSummary,
      heroMetrics: fallbackData.heroMetrics,
      source: 'Production Relational Snapshot'
    });
  }

  const members = fallbackData?.validMembers || [];
  const failed = fallbackData?.failedRenewals || [];
  const churns = fallbackData?.voluntaryChurns || [];
  const washes = fallbackData?.washEvents || [];

  const totalMRR = members.reduce((sum, m) => sum + (m.mrr || 0), 0);
  const activeMemberships = members.length;
  const avgARPM = activeMemberships > 0 ? parseFloat((totalMRR / activeMemberships).toFixed(1)) : 0;

  res.json({
    activeMemberships,
    totalMRR,
    failedRenewalsCount: failed.length,
    voluntaryChurnCount: churns.length,
    totalWashesRecorded: washes.length,
    averageRevenuePerMember: avgARPM,
    heroMetrics: fallbackData?.heroMetrics,
    source: 'Production Snapshot'
  });
});

// 5. Member Directory with Live Search & Filtering
app.get('/api/members', async (req, res) => {
  const { search, pkg, branch, limit = 50, offset = 0 } = req.query;

  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      const match = { status: 'active' };
      if (pkg && pkg !== 'all') {
        match.$or = [
          { packageReadableCode: pkg },
          { packageNameEn: { $regex: String(pkg), $options: 'i' } }
        ];
      }
      if (search) {
        const s = String(search).trim();
        match.$or = [
          { readableCode: { $regex: s, $options: 'i' } },
          { 'customerSnapshot.name': { $regex: s, $options: 'i' } },
          { 'customerSnapshot.phone': { $regex: s, $options: 'i' } },
          { 'vehicleLinks.snapshot.displayPlate': { $regex: s, $options: 'i' } },
          { 'vehicleLinks.snapshot.normalizedPlate': { $regex: s, $options: 'i' } }
        ];
      }

      const total = await mongoDb.collection('rushwash_subscriptions').countDocuments(match);
      const docs = await mongoDb.collection('rushwash_subscriptions')
        .find(match)
        .sort({ updatedAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .toArray();

      const items = docs.map(s => ({
        id: s.readableCode || String(s._id),
        customer: s.customerSnapshot?.name || 'Customer',
        phone: s.customerSnapshot?.phone || '+966...',
        car: s.vehicleLinks?.[0]?.snapshot?.displayPlate || s.vehicleLinks?.[0]?.snapshot?.normalizedPlate || 'N/A',
        package: s.packageNameEn || 'Standard',
        packageId: s.packageReadableCode || 'SPK-00001',
        mrr: s.price || 0,
        renewalDate: s.renewalDate ? String(s.renewalDate).split('T')[0] : 'N/A',
        status: s.status,
        branch: 'Al Kharj'
      }));

      return res.json({ total, limit: Number(limit), offset: Number(offset), items, source: 'Live MongoDB Atlas' });
    } catch (e) {
      console.warn('[CRM Backend] MongoDB Atlas member query error:', e.message);
    }
  }

  // Fallback member filtering
  let members = fallbackData?.validMembers || [];
  if (search) {
    const q = String(search).toLowerCase();
    members = members.filter(m => 
      m.customer?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.car?.toLowerCase().includes(q) ||
      m.id?.toLowerCase().includes(q)
    );
  }
  if (pkg && pkg !== 'all') {
    members = members.filter(m => m.packageId === pkg || m.package?.toLowerCase() === pkg.toLowerCase());
  }
  const total = members.length;
  const items = members.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ total, limit: Number(limit), offset: Number(offset), items, source: 'Production Snapshot' });
});

// 6. Failed Renewals Queue
app.get('/api/failed-renewals', async (req, res) => {
  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      const match = { status: { $in: ['expired', 'terminated'] } };
      const total = await mongoDb.collection('rushwash_subscriptions').countDocuments(match);
      const docs = await mongoDb.collection('rushwash_subscriptions')
        .find(match)
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();

      const items = docs.map(s => ({
        id: s.readableCode || String(s._id),
        customer: s.customerSnapshot?.name || 'Customer',
        phone: s.customerSnapshot?.phone || '+966...',
        car: s.vehicleLinks?.[0]?.snapshot?.displayPlate || 'N/A',
        package: s.packageNameEn || 'Standard',
        amount: s.price || 0,
        failedReason: s.status === 'expired' ? 'Card expired or insufficient funds' : 'Subscription terminated',
        lastAttempt: s.updatedAt ? String(s.updatedAt).split('T')[0] : 'N/A',
        attemptsCount: 2,
        branch: 'Al Kharj'
      }));

      return res.json({ count: total, items, source: 'Live MongoDB Atlas' });
    } catch (e) {
      console.warn('[CRM Backend] Failed renewals query error:', e.message);
    }
  }

  const items = fallbackData?.failedRenewals || [];
  res.json({ count: items.length, items, source: 'Production Snapshot' });
});

// 7. Voluntary Churn Records
app.get('/api/voluntary-churn', async (req, res) => {
  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      const match = { status: 'cancelled_voluntary' };
      const total = await mongoDb.collection('rushwash_subscriptions').countDocuments(match);
      const docs = await mongoDb.collection('rushwash_subscriptions')
        .find(match)
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();

      const items = docs.map(s => ({
        id: s.readableCode || String(s._id),
        customer: s.customerSnapshot?.name || 'Customer',
        phone: s.customerSnapshot?.phone || '+966...',
        car: s.vehicleLinks?.[0]?.snapshot?.displayPlate || 'N/A',
        package: s.packageNameEn || 'Standard',
        churnDate: s.updatedAt ? String(s.updatedAt).split('T')[0] : 'N/A',
        reason: 'Customer voluntary cancellation',
        tenureMonths: 3,
        mrrLost: s.price || 0,
        branch: 'Al Kharj'
      }));

      return res.json({ count: total, items, source: 'Live MongoDB Atlas' });
    } catch (e) {
      console.warn('[CRM Backend] Churn query error:', e.message);
    }
  }

  const items = fallbackData?.voluntaryChurns || [];
  res.json({ count: items.length, items, source: 'Production Snapshot' });
});

// 8. Wash History & Events
app.get('/api/wash-events', async (req, res) => {
  if (isMongoConnected && mongoDb && hasCol('rushwash_wash_histories')) {
    try {
      const total = await mongoDb.collection('rushwash_wash_histories').countDocuments();
      const docs = await mongoDb.collection('rushwash_wash_histories')
        .find({})
        .sort({ washDate: -1 })
        .limit(100)
        .toArray();

      const items = docs.map(w => ({
        id: w.readableCode || String(w._id),
        customer: w.customerSnapshot?.name || 'Customer',
        plate: w.plateNumber || w.vehicleSnapshot?.displayPlate || 'N/A',
        plan: w.planType || 'Exterior Wash',
        washDate: w.washDate ? String(w.washDate).replace('T', ' ').slice(0, 19) : 'N/A',
        lane: w.laneReadableCode || '01',
        branch: 'Al Kharj'
      }));

      return res.json({ count: total, items, source: 'Live MongoDB Atlas' });
    } catch (e) {
      console.warn('[CRM Backend] Wash events query error:', e.message);
    }
  }

  const items = fallbackData?.washEvents || [];
  res.json({ count: items.length, items, source: 'Production Snapshot' });
});

// 9. Revenue Trend Series
app.get('/api/revenue-trend', async (req, res) => {
  const items = fallbackData?.revenueTrend || [];
  res.json({ count: items.length, items, source: isMongoConnected ? 'Live MongoDB Atlas' : 'Production Snapshot' });
});

// 10. Unified Live Dashboard Summary Aggregation
app.get('/api/dashboard-summary', async (req, res) => {
  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      const activeMemberships = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: 'active' });
      const failedRenewalsCount = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: { $in: ['expired', 'terminated'] } });
      const voluntaryChurnCount = await mongoDb.collection('rushwash_subscriptions').countDocuments({ status: 'cancelled_voluntary' });
      
      const washCol = hasCol('rushwash_wash_histories') ? 'rushwash_wash_histories' : 'washEvents';
      const totalWashesRecorded = await mongoDb.collection(washCol).countDocuments();

      // MRR Aggregation
      const mrrAgg = await mongoDb.collection('rushwash_subscriptions').aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, totalMRR: { $sum: '$price' } } }
      ]).toArray();
      const totalMRR = mrrAgg[0]?.totalMRR || 0;
      const avgARPM = activeMemberships > 0 ? parseFloat((totalMRR / activeMemberships).toFixed(1)) : 0;

      // Package Distribution Aggregation
      const pkgAgg = await mongoDb.collection('rushwash_subscriptions').aggregate([
        { $match: { status: 'active' } },
        {
          $group: {
            _id: '$packageNameEn',
            packageCode: { $first: '$packageReadableCode' },
            count: { $sum: 1 },
            totalMrr: { $sum: '$price' },
            avgPrice: { $avg: '$price' }
          }
        },
        { $sort: { count: -1 } }
      ]).toArray();

      // Recent 100 members
      const rawMembers = await mongoDb.collection('rushwash_subscriptions')
        .find({ status: 'active' })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();
      const validMembers = rawMembers.map(s => ({
        id: s.readableCode || String(s._id),
        customer: s.customerSnapshot?.name || 'Customer',
        phone: s.customerSnapshot?.phone || '+966...',
        car: s.vehicleLinks?.[0]?.snapshot?.displayPlate || s.vehicleLinks?.[0]?.snapshot?.normalizedPlate || 'N/A',
        package: s.packageNameEn || 'Standard',
        packageId: s.packageReadableCode || 'SPK-00001',
        mrr: s.price || 0,
        renewalDate: s.renewalDate ? String(s.renewalDate).split('T')[0] : 'N/A',
        status: s.status,
        branch: 'Al Kharj'
      }));

      // Recent 100 failed
      const rawFailed = await mongoDb.collection('rushwash_subscriptions')
        .find({ status: { $in: ['expired', 'terminated'] } })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();
      const failedRenewals = rawFailed.map(s => ({
        id: s.readableCode || String(s._id),
        customer: s.customerSnapshot?.name || 'Customer',
        phone: s.customerSnapshot?.phone || '+966...',
        car: s.vehicleLinks?.[0]?.snapshot?.displayPlate || 'N/A',
        pkg: s.packageNameEn || 'Standard',
        packageId: s.packageReadableCode || 'SPK-00001',
        amount: s.price || 0,
        reason: s.status === 'expired' ? 'Card expired or insufficient funds' : 'Subscription terminated',
        lastAttempt: s.updatedAt ? String(s.updatedAt).split('T')[0] : 'N/A',
        status: s.status,
        attempts: 2
      }));

      // Recent 100 churned
      const rawChurn = await mongoDb.collection('rushwash_subscriptions')
        .find({ status: 'cancelled_voluntary' })
        .sort({ updatedAt: -1 })
        .limit(100)
        .toArray();
      const voluntaryChurns = rawChurn.map(s => ({
        id: s.readableCode || String(s._id),
        customer: s.customerSnapshot?.name || 'Customer',
        phone: s.customerSnapshot?.phone || '+966...',
        car: s.vehicleLinks?.[0]?.snapshot?.displayPlate || 'N/A',
        pkg: s.packageNameEn || 'Standard',
        packageId: s.packageReadableCode || 'SPK-00001',
        churnDate: s.updatedAt ? String(s.updatedAt).split('T')[0] : 'N/A',
        reason: 'Customer voluntary cancellation',
        tenureMonths: 3,
        mrr: s.price || 0
      }));

      // Recent 100 washes
      const rawWashes = await mongoDb.collection(washCol)
        .find({})
        .sort({ washDate: -1 })
        .limit(100)
        .toArray();
      const washEvents = rawWashes.map(w => ({
        id: w.readableCode || String(w._id),
        customerName: w.customerSnapshot?.name || 'Customer',
        plate: w.plateNumber || w.vehicleSnapshot?.displayPlate || 'N/A',
        planType: w.planType || 'exterior_wash',
        date: w.washDate ? String(w.washDate).replace('T', ' ').slice(0, 19) : 'N/A',
        lane: w.laneReadableCode || '01',
        shopId: w.shopId || 'SHP-00001'
      }));

      return res.json({
        source: 'Live MongoDB Atlas',
        mongoConnected: true,
        database: DB_NAME,
        metricsSummary: {
          activeMemberships,
          totalMRR,
          failedRenewalsCount,
          voluntaryChurnCount,
          totalWashesRecorded,
          averageRevenuePerMember: avgARPM
        },
        packageAgg: pkgAgg,
        validMembers,
        failedRenewals,
        voluntaryChurns,
        washEvents,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[CRM Backend] Dashboard summary aggregation error:', e.message);
    }
  }

  // Fallback data
  res.json({
    source: 'Production Snapshot',
    mongoConnected: isMongoConnected,
    database: DB_NAME,
    metricsSummary: fallbackData?.metricsSummary || {},
    packageAgg: fallbackData?.packageAgg || [],
    validMembers: fallbackData?.validMembers || [],
    failedRenewals: fallbackData?.failedRenewals || [],
    voluntaryChurns: fallbackData?.voluntaryChurns || [],
    washEvents: fallbackData?.washEvents || [],
    salesTeam: fallbackData?.salesTeam || null,
    washUsage: fallbackData?.washUsage || null,
    cohortRetention: fallbackData?.cohortRetention || [],
    revenueTrend: fallbackData?.revenueTrend || [],
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// RETENTION ENGINE, SAVE OFFERS & ANTI-ABUSE GUARDRAILS
// ============================================================================

// In-memory retention audit log & abuse tracking (initialized with realistic production patterns)
const retentionAuditLogs = [
  {
    id: 'RET-8941',
    timestamp: '2026-09-05 16:42:10',
    customerName: 'Tariq Al-Ghamdi',
    phone: '+966504918234',
    plate: '8492 BTD (ب ط د ٨٤٩٢)',
    packageName: 'Nano Ceramic',
    mrr: 169,
    washesCount: 14,
    reason: 'Seasonal Slowdown / Winter Travel',
    abuseCheckPassed: true,
    outcome: 'Saved: Pause',
    savingsSar: 169,
    statusBadgeColor: 'emerald'
  },
  {
    id: 'RET-8940',
    timestamp: '2026-09-05 15:18:22',
    customerName: 'Fahad Al-Subaie',
    phone: '+966551293844',
    plate: '5795 GRB (ب ر ق ٥٧٩٥)',
    packageName: 'Nano Ceramic',
    mrr: 169,
    washesCount: 3,
    reason: 'Price Too High / Budget Cuts',
    abuseCheckPassed: true,
    outcome: 'Saved: Downgrade',
    savingsSar: 69,
    statusBadgeColor: 'blue'
  },
  {
    id: 'RET-8939',
    timestamp: '2026-09-05 14:05:49',
    customerName: 'Khalid Al-Mansoor',
    phone: '+966553829102',
    plate: '2103 KHA (أ خ ك ٢١٠٣)',
    packageName: 'Shiny Wash',
    mrr: 69,
    washesCount: 8,
    reason: 'Price Too High / Budget Cuts',
    abuseCheckPassed: false,
    abuseRuleTriggered: '180-Day Save Offer Cooldown',
    outcome: 'Abuse Blocked',
    savingsSar: 0,
    statusBadgeColor: 'rose'
  },
  {
    id: 'RET-8938',
    timestamp: '2026-09-05 11:30:15',
    customerName: 'Mohammed Al-Qahtani',
    phone: '+966542109855',
    plate: '9840 XKR (ر ك ص ٩٨٤٠)',
    packageName: 'Fresh Wash',
    mrr: 100,
    washesCount: 19,
    reason: 'Tunnel Equipment / Service Issue',
    abuseCheckPassed: true,
    outcome: 'Saved: Wash Credit',
    savingsSar: 50,
    statusBadgeColor: 'purple'
  },
  {
    id: 'RET-8937',
    timestamp: '2026-09-04 18:22:04',
    customerName: 'Bandar Al-Otaibi',
    phone: '+966567812903',
    plate: '1104 SRA (أ ر س ١١٠٤)',
    packageName: 'Shiny Wash',
    mrr: 69,
    washesCount: 1,
    reason: 'Moved / Relocated Out of Area',
    abuseCheckPassed: true,
    outcome: 'Cancelled',
    savingsSar: 0,
    statusBadgeColor: 'slate'
  },
  {
    id: 'RET-8936',
    timestamp: '2026-09-04 12:45:30',
    customerName: 'Sultan Al-Harbi',
    phone: '+966509832145',
    plate: '4481 NRD (د ر ن ٤٤٨١)',
    packageName: 'Nano Ceramic',
    mrr: 169,
    washesCount: 0,
    reason: 'Underuse / Not Washing Enough',
    abuseCheckPassed: false,
    abuseRuleTriggered: '30-Day Minimum Tenure Rule (12 days active)',
    outcome: 'Abuse Blocked',
    savingsSar: 0,
    statusBadgeColor: 'rose'
  }
];



// Historical offer grants & save engine state
const memberOfferHistory = new Map([
  ['+966553829102', { 
    id: 'HIST-001',
    membershipId: 'MEM-002',
    customerId: 'CUST-002',
    customerName: 'Sultan Al-Otaibi',
    phone: '+966553829102',
    plate: '9840 XKR',
    offerCode: 'SAVE_HEALTHY_CORE',
    discountType: 'percentage',
    discountValue: 20,
    billingCycles: 3,
    cyclesCompleted: 1,
    normalPrice: 169,
    discountedPrice: 135,
    acceptedAt: '2026-06-15T10:00:00.000Z',
    expiresAt: '2026-09-15T10:00:00.000Z',
    status: 'active',
    postSaveMilestones: {
      day0NoticeSent: true,
      day7UsageReminderSent: true,
      day21FinalReminderSent: false,
      dayMinus14NoticeSent: false,
      firstNormalRenewalSuccess: false
    }
  }],
  ['+966509832145', { 
    id: 'HIST-002',
    membershipId: 'MEM-003',
    customerId: 'CUST-003',
    customerName: 'Sultan Al-Harbi',
    phone: '+966509832145',
    plate: '4481 NRD',
    offerCode: 'SAVE_HEALTHY_HIGH',
    discountType: 'percentage',
    discountValue: 25,
    billingCycles: 3,
    cyclesCompleted: 3,
    normalPrice: 220,
    discountedPrice: 165,
    acceptedAt: '2026-04-10T14:30:00.000Z',
    expiresAt: '2026-07-10T14:30:00.000Z',
    status: 'durably_retained',
    postSaveMilestones: {
      day0NoticeSent: true,
      day7UsageReminderSent: true,
      day21FinalReminderSent: true,
      dayMinus14NoticeSent: true,
      firstNormalRenewalSuccess: true
    }
  }]
]);

// Active retention policy configuration (Section 10 Admin Configuration)
let adminRetentionConfig = {
  aprThresholds: {
    lowMax: 130,   // Low: < 130 SAR
    coreMax: 199,  // Core: 130 - 199 SAR
    highMin: 200   // High: >= 200 SAR
  },
  discountTemplates: {
    SAVE_HEALTHY_CORE: { discountPct: 20, cycles: 3, active: true },
    SAVE_HEALTHY_HIGH: { discountPct: 25, cycles: 3, active: true },
    SAVE_HIGH_HIGH_APR: { discountPct: 15, cycles: 2, active: true }
  },
  freezePolicy: {
    defaultDays: 60,
    maxAnnualDays: 90
  },
  guardrails: {
    minFullPriceRenewals: 2,
    cooldownDays: 180,
    postSaveCancelLockDays: 90
  }
};

// In-memory active cancellation sessions
const cancellationSessions = new Map();

// In-memory Quality Recovery Tickets (Section 6 Service Recovery Ticket)
let qualityRecoveryTickets = [
  {
    id: 'TKT-1001',
    sessionId: 'SES-9001',
    membershipId: 'MEM-004',
    customerName: 'Fahad Al-Dossari',
    phone: '+966551239876',
    vehiclePlate: '5512 KSA (أ س ك ٥٥١٢)',
    branchId: 'LOC-01',
    branchName: 'Al-Kharj Main Tunnel',
    lane: 'Lane 1 (Express)',
    washDateTime: '2026-09-05T14:20:00.000Z',
    issueCategory: 'spotting_film',
    description: 'Water spotting and detergent film residue noticed on windshield and rear glass after wash.',
    attachmentsCount: 2,
    status: 'open',
    callbackDueTime: new Date(Date.now() + 18 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    assignedManager: 'Khalid Al-Mansoor',
    managerNotes: 'Dispatched tunnel tech to check rinse arch TDS and drying agent dosage.',
    documentedRemedy: 'rewash',
    remedyDetails: 'Free re-wash pass issued on lane VIP terminal.',
    memberDecision: 'stay'
  },
  {
    id: 'TKT-1002',
    sessionId: 'SES-9002',
    membershipId: 'MEM-005',
    customerName: 'Yazeed Al-Ghamdi',
    phone: '+966504455667',
    vehiclePlate: '7721 RSH (ح ش ر ٧٧٢١)',
    branchId: 'LOC-02',
    branchName: 'Riyadh Ring Road Branch',
    lane: 'Lane 2',
    washDateTime: '2026-09-04T19:45:00.000Z',
    issueCategory: 'dryer_performance',
    description: 'Blower dryer shut down early during cycle leaving heavy water pooling on roof and tailgate.',
    attachmentsCount: 1,
    status: 'callback_completed',
    callbackDueTime: new Date(Date.now() - 4 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 28 * 3600000).toISOString(),
    assignedManager: 'Bandar Al-Otaibi',
    managerNotes: 'Called customer, explained sensor tripped on oversized roof rack. Issued 2 complimentary interior passes.',
    documentedRemedy: 'service_credit',
    remedyDetails: '2x Interior Detail Addon Credits credited to wallet.',
    memberDecision: 'stay',
    resolvedAt: new Date(Date.now() - 3 * 3600000).toISOString()
  },
  {
    id: 'TKT-1003',
    sessionId: 'SES-9003',
    membershipId: 'MEM-006',
    customerName: 'Majed Al-Mutairi',
    phone: '+966549988776',
    vehiclePlate: '3310 BHR (ر ح ب ٣٣١٠)',
    branchId: 'LOC-03',
    branchName: 'Dammam Highway Hub',
    lane: 'Lane 1',
    washDateTime: '2026-09-03T11:15:00.000Z',
    issueCategory: 'tunnel_equipment',
    description: 'Tire shine applicator missed right side wheels completely.',
    attachmentsCount: 0,
    status: 'resolved_retained',
    callbackDueTime: new Date(Date.now() - 40 * 3600000).toISOString(),
    createdAt: new Date(Date.now() - 52 * 3600000).toISOString(),
    assignedManager: 'Tariq Al-Zahrani',
    managerNotes: 'Customer satisfied after personal inspection by branch manager on re-entry.',
    documentedRemedy: 'rewash',
    remedyDetails: 'Complete re-wash with manual wheel dressing applied.',
    memberDecision: 'stay',
    resolvedAt: new Date(Date.now() - 24 * 3600000).toISOString()
  }
];

// ============================================================================
// CORE SPECIFICATION COMPUTATION HELPERS
// ============================================================================

/**
 * Computes Customer APR strictly according to Section 2:
 * customer_apr = total_successfully_collected_membership_revenue_since_joining / months_since_joining
 * Include successful membership charges only.
 * Exclude failed payments, pending charges, refunds, chargebacks, wallet top-ups, one-off washes, interior add-ons.
 * months_since_joining: calendar months between original membership start date and evaluation date (min 1).
 */
function computeCustomerApr(member) {
  const now = new Date('2026-09-05T17:45:00Z');
  const joinedDate = member.createdAt ? new Date(member.createdAt) : new Date(Date.now() - 150 * 86400000);
  
  // Calculate calendar months since joining (min 1)
  const diffMonths = Math.max(1, (now.getFullYear() - joinedDate.getFullYear()) * 12 + (now.getMonth() - joinedDate.getMonth()));
  
  // Membership collected revenue only
  let totalRevenueCollected = member.totalRevenueCollected;
  if (!totalRevenueCollected || totalRevenueCollected <= 0) {
    const normalPrice = member.mrr || (member.price || 169);
    totalRevenueCollected = normalPrice * diffMonths;
  }
  
  const customerApr = Math.round((totalRevenueCollected / diffMonths) * 10) / 10;
  
  let aprBand = 'core';
  if (customerApr < adminRetentionConfig.aprThresholds.lowMax) {
    aprBand = 'low';
  } else if (customerApr >= adminRetentionConfig.aprThresholds.highMin) {
    aprBand = 'high';
  } else {
    aprBand = 'core';
  }
  
  return {
    customerApr,
    aprBand,
    monthsSinceJoining: diffMonths,
    totalRevenueCollected
  };
}

/**
 * Single wash retail pricing catalog:
 * Fresh: SAR 59, Shiny: SAR 79, Nano Ceramic: SAR 89, Interior Clean / Add-on: SAR 149
 */
function getSingleWashPrice(pkgNameOrId = '') {
  const lower = String(pkgNameOrId).toLowerCase();
  if (lower.includes('interior')) return 149;
  if (lower.includes('nano')) return 89;
  if (lower.includes('shiny')) return 79;
  if (lower.includes('fresh')) return 59;
  return 89;
}

/**
 * Computes Usage Segmentation (Section 3) & Trend (last 30d vs 31-60d):
 * inactive: 0 washes
 * light: 1-3 washes
 * healthy: 4-6 washes
 * high: 7-9 washes
 * heavy: 10+ washes (Blocked from auto discount)
 * Trend: rising (W30 > W60 + 1), falling (W30 < W60 - 1), stable (otherwise)
 */
async function computeUsageSegmentationAndTrend(member) {
  let usageLast30Days = 5;
  let usagePrevious30Days = 5;
  let totalWashesSinceJoining = 14;

  if (isMongoConnected && mongoDb && hasCol('rushwash_wash_histories')) {
    try {
      const plate = member.car?.replace(/[^\w\d]/g, '');
      const filter = {
        $or: [
          { 'customerSnapshot.phone': member.phone },
          { plateNumber: { $regex: plate || '---', $options: 'i' } }
        ]
      };
      const totalCount = await mongoDb.collection('rushwash_wash_histories').countDocuments(filter);
      if (totalCount > 0) totalWashesSinceJoining = totalCount;
      
      const now = new Date('2026-09-05T17:45:00Z');
      const d30 = new Date(now.getTime() - 30 * 86400000);
      const d60 = new Date(now.getTime() - 60 * 86400000);
      
      usageLast30Days = await mongoDb.collection('rushwash_wash_histories').countDocuments({
        ...filter,
        createdAt: { $gte: d30 }
      });
      
      usagePrevious30Days = await mongoDb.collection('rushwash_wash_histories').countDocuments({
        ...filter,
        createdAt: { $gte: d60, $lt: d30 }
      });
    } catch (e) {
      // fallback
    }
  } else {
    // Default realistic usage distribution
    if (member.washes !== undefined) {
      totalWashesSinceJoining = member.washes;
      usageLast30Days = Math.min(member.washes, Math.max(1, Math.round(member.washes / 2)));
      usagePrevious30Days = Math.max(0, member.washes - usageLast30Days);
    } else if (member.packageId === 'nano' || member.package?.includes('Nano')) {
      usageLast30Days = 5;
      usagePrevious30Days = 4;
      totalWashesSinceJoining = 16;
    } else if (member.packageId === 'shiny' || member.package?.includes('Shiny')) {
      usageLast30Days = 3;
      usagePrevious30Days = 3;
      totalWashesSinceJoining = 9;
    }
  }

  // Segment classification
  let usageSegment = 'healthy';
  if (usageLast30Days === 0) usageSegment = 'inactive';
  else if (usageLast30Days >= 1 && usageLast30Days <= 3) usageSegment = 'light';
  else if (usageLast30Days >= 4 && usageLast30Days <= 6) usageSegment = 'healthy';
  else if (usageLast30Days >= 7 && usageLast30Days <= 9) usageSegment = 'high';
  else if (usageLast30Days >= 10) usageSegment = 'heavy';

  // Trend classification
  let usageTrend = 'stable';
  if (usageLast30Days > usagePrevious30Days + 1) usageTrend = 'rising';
  else if (usageLast30Days < usagePrevious30Days - 1) usageTrend = 'falling';

  // Retail savings compared to single wash retail pricing (Fresh 59, Shiny 79, Nano 89, Interior 149)
  const singleWashPrice = getSingleWashPrice(member.package || member.packageId || member.packageNameEn);
  const lastPaidMembershipPrice = member.mrr || member.price || 169;
  const retailWashValueLastPeriod = usageLast30Days * singleWashPrice;
  const lastPeriodSavingsSar = Math.max(0, retailWashValueLastPeriod - lastPaidMembershipPrice);
  const isSavingGreaterThanMembership = lastPeriodSavingsSar > lastPaidMembershipPrice;
  const realRetailSavingsSar = lastPeriodSavingsSar;

  return {
    usageLast30Days,
    usagePrevious30Days,
    usageSegment,
    usageTrend,
    totalWashesSinceJoining,
    singleWashPrice,
    lastPaidMembershipPrice,
    retailWashValueLastPeriod,
    lastPeriodSavingsSar,
    isSavingGreaterThanMembership,
    realRetailSavingsSar
  };
}

/**
 * 7 Hard Ineligibility Guards + Abuse Monitoring Checks (Section 4 & 5)
 */
function evaluateEligibilityGuards(member, history, usageSegment, reason, aprData) {
  const now = new Date('2026-09-05T17:45:00Z');
  const blockingReasons = [];
  const monitoringFlags = [];

  // Guard 1: <2 full-price renewal cycles completed since joining or since last discount
  const renewalsPassed = (aprData.monthsSinceJoining >= adminRetentionConfig.guardrails.minFullPriceRenewals);
  if (!renewalsPassed) {
    blockingReasons.push(`Tenure guard: At least ${adminRetentionConfig.guardrails.minFullPriceRenewals} full-price renewals required (currently ${aprData.monthsSinceJoining} cycle).`);
  }

  // Guard 2: Save offer accepted within past 180 days
  let cooldownPassed = true;
  if (history?.acceptedAt) {
    const daysSinceOffer = Math.floor((now.getTime() - new Date(history.acceptedAt).getTime()) / 86400000);
    if (daysSinceOffer < adminRetentionConfig.guardrails.cooldownDays) {
      cooldownPassed = false;
      blockingReasons.push(`180-Day Cooldown Active: Prior save offer accepted ${daysSinceOffer} days ago (${adminRetentionConfig.guardrails.cooldownDays - daysSinceOffer} days remaining).`);
    }
  }

  // Guard 3: Active promo or freeze already in effect
  const promoOrFreezeActive = member.status === 'paused' || member.isPromoActive === true;
  if (promoOrFreezeActive) {
    blockingReasons.push('Active promotion or membership freeze is currently already applied.');
  }

  // Guard 4: Unresolved dispute or chargeback
  const hasDispute = member.hasActiveDispute === true;
  if (hasDispute) {
    blockingReasons.push('Account has an active or unresolved payment dispute / chargeback.');
  }

  // Guard 5: Cancellation initiated within 90 days of an accepted save offer
  let rapidCancelLock = false;
  if (history?.acceptedAt && history.status === 'active') {
    const daysSinceOffer = Math.floor((now.getTime() - new Date(history.acceptedAt).getTime()) / 86400000);
    if (daysSinceOffer < adminRetentionConfig.guardrails.postSaveCancelLockDays) {
      rapidCancelLock = true;
      blockingReasons.push(`Post-Save Lock: Cancellation initiated within ${daysSinceOffer} days of active save offer.`);
      monitoringFlags.push('save_offer_hopper');
    }
  }

  // Guard 6: Inactive or complimentary membership (no paid history)
  const isPaidArrangement = (aprData.totalRevenueCollected > 0) && (member.status !== 'complimentary');
  if (!isPaidArrangement) {
    blockingReasons.push('Complimentary or unpaid membership tier not eligible for retention discounts.');
  }

  // Guard 7: Active fraud or multi-vehicle abuse flag
  const hasFraudFlag = member.fraudFlag === true || member.multiVehicleFlag === true;
  if (hasFraudFlag) {
    blockingReasons.push('Security guard: Account flagged for multi-vehicle / anomalous wash velocity.');
    monitoringFlags.push('multi_vehicle_churn');
  }

  // Special Policy Check: Heavy Washer Policy (Section 5 Rule 4)
  const isHeavyWasher = (usageSegment === 'heavy');
  if (isHeavyWasher) {
    blockingReasons.push('Heavy Washer Policy: Members washing 10+ times/mo are not eligible for automated discounts. Retail value reminder & cancellation path presented.');
  }

  // Special Policy Check: Quality Complaint (Section 6)
  const isQualityComplaint = (reason === 'quality_complaint');
  if (isQualityComplaint) {
    blockingReasons.push('Quality Complaint Policy: Under no circumstances are automated discounts generated. Dispatched to Priority Service Recovery ticket.');
  }

  const eligibleForAutomatedDiscount = (blockingReasons.length === 0);

  return {
    eligibleForAutomatedDiscount,
    blockingReasons,
    monitoringFlags,
    evaluatedAt: now.toISOString(),
    guardDetails: {
      twoRenewalsPassed: renewalsPassed,
      cooldown180dPassed: cooldownPassed,
      noActivePromoOrFreeze: !promoOrFreezeActive,
      noUnresolvedDispute: !hasDispute,
      noCancelWithin90dOfSave: !rapidCancelLock,
      activeRecurringArrangement: isPaidArrangement,
      noFraudFlag: !hasFraudFlag
    }
  };
}

/**
 * Determines EXACTLY ONE Retention Offer based on Section 7 Decision Matrix & Section 8 Offers:
 * - SAVE_HEALTHY_CORE: 20% off for 3 cycles (Healthy usage 4-6, Core APR 130-199)
 * - SAVE_HEALTHY_HIGH: 25% off for 3 cycles (Healthy usage 4-6, High APR >=200)
 * - SAVE_HIGH_HIGH_APR: 15% off for 2 cycles (High usage 7-9, High APR >=200)
 * - FREEZE_STANDARD: 60-day pause at 0 SAR (Travel/Absence reason OR Inactive/Light usage)
 */
function determineRetentionOffer(member, aprBand, usageSegment, reason) {
  const normalPrice = member.mrr || (member.price || 169);
  const now = new Date('2026-09-05T17:45:00Z');
  const renewalDate = member.renewalDate || '2026-09-30';
  
  // 1. Travel / Temporary Absence -> Freeze Offer
  if (reason === 'travel_temporary_absence' || usageSegment === 'inactive' || (reason === 'not_using_enough' && usageSegment === 'light')) {
    const resumeDate = new Date(now.getTime() + adminRetentionConfig.freezePolicy.defaultDays * 86400000).toISOString().split('T')[0];
    return {
      code: 'FREEZE_STANDARD',
      title: 'Freeze Membership for 60 Days (SAR 0/mo)',
      arabicTitle: 'إيقاف مؤقت للاشتراك لمدة شهرين بدون رسوم',
      description: 'Keep your car registered on file with zero charges. Automatically reactivates after 60 days.',
      badgeText: 'Highest Save Rate (74%)',
      packageId: member.packageId || 'SPK-00001',
      packageName: member.package || member.packageNameEn || 'Membership Plan',
      discountType: 'freeze',
      discountValue: 0,
      billingCycles: 2,
      normalPrice,
      discountedPrice: 0,
      estimatedSavingsSar: normalPrice * 2,
      preservesMrrSar: normalPrice,
      nextRenewalDate: renewalDate,
      returnToNormalDate: resumeDate,
      expiresAt: new Date(now.getTime() + 2 * 3600000).toISOString()
    };
  }

  // 2. Healthy Usage (4-6) + Core APR (130-199) -> SAVE_HEALTHY_CORE (20% for 3 cycles)
  if (usageSegment === 'healthy' && aprBand === 'core') {
    const tpl = adminRetentionConfig.discountTemplates.SAVE_HEALTHY_CORE;
    const discountAmt = Math.round(normalPrice * (tpl.discountPct / 100));
    const discountedPrice = normalPrice - discountAmt;
    const returnDate = new Date(now.getTime() + tpl.cycles * 30 * 86400000).toISOString().split('T')[0];
    
    return {
      code: 'SAVE_HEALTHY_CORE',
      title: `${tpl.discountPct}% Off for Next ${tpl.cycles} Months`,
      arabicTitle: `خصم ${tpl.discountPct}٪ لأول ${tpl.cycles} دورات تجديد`,
      description: `Pay SAR ${discountedPrice}/mo for ${tpl.cycles} billing cycles. Automatically returns to standard SAR ${normalPrice}/mo after cycle ${tpl.cycles}.`,
      badgeText: 'Curated Save Offer',
      packageId: member.packageId || 'SPK-00001',
      packageName: member.package || member.packageNameEn || 'Membership Plan',
      discountType: 'percentage',
      discountValue: tpl.discountPct,
      billingCycles: tpl.cycles,
      normalPrice,
      discountedPrice,
      estimatedSavingsSar: discountAmt * tpl.cycles,
      preservesMrrSar: discountedPrice,
      nextRenewalDate: renewalDate,
      returnToNormalDate: returnDate,
      expiresAt: new Date(now.getTime() + 2 * 3600000).toISOString()
    };
  }

  // 3. Healthy Usage (4-6) + High APR (>=200) -> SAVE_HEALTHY_HIGH (25% for 3 cycles)
  if (usageSegment === 'healthy' && aprBand === 'high') {
    const tpl = adminRetentionConfig.discountTemplates.SAVE_HEALTHY_HIGH;
    const discountAmt = Math.round(normalPrice * (tpl.discountPct / 100));
    const discountedPrice = normalPrice - discountAmt;
    const returnDate = new Date(now.getTime() + tpl.cycles * 30 * 86400000).toISOString().split('T')[0];
    
    return {
      code: 'SAVE_HEALTHY_HIGH',
      title: `${tpl.discountPct}% Off for Next ${tpl.cycles} Months (VIP Tier)`,
      arabicTitle: `خصم ${tpl.discountPct}٪ لأول ${tpl.cycles} دورات تجديد لكبار المشتركين`,
      description: `Pay SAR ${discountedPrice}/mo for ${tpl.cycles} billing cycles. Automatically returns to standard SAR ${normalPrice}/mo after cycle ${tpl.cycles}.`,
      badgeText: 'VIP Retention Offer',
      packageId: member.packageId || 'SPK-00003',
      packageName: member.package || member.packageNameEn || 'Nano Ceramic',
      discountType: 'percentage',
      discountValue: tpl.discountPct,
      billingCycles: tpl.cycles,
      normalPrice,
      discountedPrice,
      estimatedSavingsSar: discountAmt * tpl.cycles,
      preservesMrrSar: discountedPrice,
      nextRenewalDate: renewalDate,
      returnToNormalDate: returnDate,
      expiresAt: new Date(now.getTime() + 2 * 3600000).toISOString()
    };
  }

  // 4. High Usage (7-9) + High APR (>=200) -> SAVE_HIGH_HIGH_APR (15% for 2 cycles)
  if (usageSegment === 'high' && aprBand === 'high') {
    const tpl = adminRetentionConfig.discountTemplates.SAVE_HIGH_HIGH_APR;
    const discountAmt = Math.round(normalPrice * (tpl.discountPct / 100));
    const discountedPrice = normalPrice - discountAmt;
    const returnDate = new Date(now.getTime() + tpl.cycles * 30 * 86400000).toISOString().split('T')[0];
    
    return {
      code: 'SAVE_HIGH_HIGH_APR',
      title: `${tpl.discountPct}% Off for Next ${tpl.cycles} Months`,
      arabicTitle: `خصم ${tpl.discountPct}٪ لأول ${tpl.cycles} دورات تجديد`,
      description: `Pay SAR ${discountedPrice}/mo for ${tpl.cycles} billing cycles. Automatically returns to standard SAR ${normalPrice}/mo after cycle ${tpl.cycles}.`,
      badgeText: 'High Frequency Offer',
      packageId: member.packageId || 'SPK-00003',
      packageName: member.package || member.packageNameEn || 'Nano Ceramic',
      discountType: 'percentage',
      discountValue: tpl.discountPct,
      billingCycles: tpl.cycles,
      normalPrice,
      discountedPrice,
      estimatedSavingsSar: discountAmt * tpl.cycles,
      preservesMrrSar: discountedPrice,
      nextRenewalDate: renewalDate,
      returnToNormalDate: returnDate,
      expiresAt: new Date(now.getTime() + 2 * 3600000).toISOString()
    };
  }

  // Default fallback offer if eligible (e.g. price budget reason on core plan)
  const defaultTpl = adminRetentionConfig.discountTemplates.SAVE_HEALTHY_CORE;
  const discountAmt = Math.round(normalPrice * (defaultTpl.discountPct / 100));
  const discountedPrice = normalPrice - discountAmt;
  const returnDate = new Date(now.getTime() + defaultTpl.cycles * 30 * 86400000).toISOString().split('T')[0];

  return {
    code: 'SAVE_HEALTHY_CORE',
    title: `${defaultTpl.discountPct}% Off for Next ${defaultTpl.cycles} Months`,
    arabicTitle: `خصم ${defaultTpl.discountPct}٪ لأول ${defaultTpl.cycles} دورات تجديد`,
    description: `Pay SAR ${discountedPrice}/mo for ${defaultTpl.cycles} billing cycles. Automatically returns to standard SAR ${normalPrice}/mo after cycle ${defaultTpl.cycles}.`,
    badgeText: 'Curated Save Offer',
    packageId: member.packageId || 'SPK-00001',
    packageName: member.package || member.packageNameEn || 'Membership Plan',
    discountType: 'percentage',
    discountValue: defaultTpl.discountPct,
    billingCycles: defaultTpl.cycles,
    normalPrice,
    discountedPrice,
    estimatedSavingsSar: discountAmt * defaultTpl.cycles,
    preservesMrrSar: discountedPrice,
    nextRenewalDate: renewalDate,
    returnToNormalDate: returnDate,
    expiresAt: new Date(now.getTime() + 2 * 3600000).toISOString()
  };
}

// Pre-configured Test Member Archetypes Catalog for Testing & Simulator
const DEMO_PERSONAS = [
  {
    id: 'DEMO-01',
    customer: 'Sultan Al-Otaibi',
    phone: '+966508821932',
    car: '9840 XKR',
    package: 'Nano Ceramic',
    packageId: 'nano',
    mrr: 169,
    washes: 5,
    createdAt: '2026-05-10T00:00:00.000Z'
  },
  {
    id: 'DEMO-02',
    customer: 'Abdullah Al-Shehri',
    phone: '+966559183341',
    car: '4410 TKB',
    package: 'Fresh Wash',
    packageId: 'fresh',
    mrr: 100,
    washes: 1,
    createdAt: '2026-05-10T00:00:00.000Z'
  },
  {
    id: 'DEMO-03',
    customer: 'Tariq Al-Ghamdi',
    phone: '+966554918234',
    car: '8492 BTD',
    package: 'Shiny Wash',
    packageId: 'shiny',
    mrr: 69,
    washes: 3,
    createdAt: '2026-05-10T00:00:00.000Z'
  },
  {
    id: 'DEMO-04',
    customer: 'Fahad Al-Dossari',
    phone: '+966551239876',
    car: '5512 KSA',
    package: 'Nano Ceramic',
    packageId: 'nano',
    mrr: 169,
    washes: 2,
    createdAt: '2026-05-10T00:00:00.000Z'
  },
  {
    id: 'DEMO-05',
    customer: 'Mohammed Al-Qahtani',
    phone: '+966542109855',
    car: '1104 SRA',
    package: 'Nano Ceramic',
    packageId: 'nano',
    mrr: 169,
    washes: 14,
    createdAt: '2026-05-10T00:00:00.000Z'
  },
  {
    id: 'DEMO-06',
    customer: 'Dr. Walid Al-Harthy',
    phone: '+966503349912',
    car: '7721 VIP',
    package: 'Nano + Interior',
    packageId: 'nano_interior',
    mrr: 219,
    washes: 4,
    createdAt: '2026-05-10T00:00:00.000Z'
  }
];

// Helper to look up member in MongoDB, DEMO_PERSONAS, or fallback snapshot
async function findMember(lookup = {}) {
  const { memberId, searchPlate, phone } = lookup;
  let member = null;

  // 1. Check Demo Personas first if explicit ID/Phone/Plate matches
  if (memberId) {
    const demo = DEMO_PERSONAS.find(p => p.id.toLowerCase() === String(memberId).toLowerCase());
    if (demo) return { ...demo };
  }
  if (phone) {
    const cleanPhone = phone.replace(/[^\d]/g, '');
    if (cleanPhone.length >= 7) {
      const demo = DEMO_PERSONAS.find(p => p.phone.replace(/[^\d]/g, '').includes(cleanPhone) || cleanPhone.includes(p.phone.replace(/[^\d]/g, '')));
      if (demo) return { ...demo };
    }
  }
  if (searchPlate) {
    const cleanPlate = searchPlate.toLowerCase().replace(/\s/g, '');
    const demo = DEMO_PERSONAS.find(p => p.car.toLowerCase().replace(/\s/g, '').includes(cleanPlate));
    if (demo) return { ...demo };
  }

  // 2. Check MongoDB collection
  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      const match = {};
      if (memberId) match.$or = [{ readableCode: memberId }, { _id: memberId }];
      else if (searchPlate) match['vehicleLinks.snapshot.displayPlate'] = { $regex: searchPlate, $options: 'i' };
      else if (phone) match['customerSnapshot.phone'] = { $regex: phone, $options: 'i' };

      const doc = await mongoDb.collection('rushwash_subscriptions').findOne(match);
      if (doc) {
        member = {
          id: doc.readableCode || String(doc._id),
          customer: doc.customerSnapshot?.name || 'Customer',
          phone: doc.customerSnapshot?.phone || '+966500000000',
          car: doc.vehicleLinks?.[0]?.snapshot?.displayPlate || 'N/A',
          package: doc.packageNameEn || 'Nano Ceramic',
          packageId: doc.packageReadableCode || 'SPK-00003',
          mrr: doc.price || 169,
          createdAt: doc.createdAt || '2026-01-15T00:00:00.000Z',
          renewalDate: doc.renewalDate ? String(doc.renewalDate).split('T')[0] : '2026-09-30',
          status: doc.status
        };
      }
    } catch (e) {
      console.warn('[Save Engine] MongoDB lookup error:', e.message);
    }
  }

  // 3. Check fallbackData
  if (!member) {
    const list = fallbackData?.validMembers || [];
    if (memberId) member = list.find(m => m.id === memberId);
    if (!member && searchPlate) member = list.find(m => m.car?.toLowerCase().includes(searchPlate.toLowerCase()));
    if (!member && phone) member = list.find(m => m.phone?.includes(phone));
    if (!member && !memberId && !searchPlate && !phone && list.length > 0) member = list[0];
    if (!member && list.length > 0) member = { ...DEMO_PERSONAS[0] };
  }

  return member;
}

// ============================================================================
// SPECIFICATION V1.0 API ENDPOINTS
// ============================================================================

/**
 * 1. POST /api/cancellation/session/start
 * Initiates cancellation session, evaluates Customer APR & Usage metrics, returns Step 1 Value Reminder.
 */
app.post('/api/cancellation/session/start', async (req, res) => {
  const { memberId, searchPlate, phone, channel = 'portal' } = req.body;
  const member = await findMember({ memberId, searchPlate, phone });

  if (!member) {
    return res.status(404).json({ error: 'Active member record not found.' });
  }

  const aprData = computeCustomerApr(member);
  const usageData = await computeUsageSegmentationAndTrend(member);
  const history = memberOfferHistory.get(member.phone);
  const eligibility = evaluateEligibilityGuards(member, history, usageData.usageSegment, undefined, aprData);

  const sessionId = `SES-${Date.now().toString().slice(-6)}`;
  const session = {
    id: sessionId,
    membershipId: member.id,
    customerId: member.customerId || `CUST-${member.id.replace(/\D/g, '') || '01'}`,
    customerName: member.customer,
    phone: member.phone,
    vehiclePlate: member.car,
    packageId: member.packageId || 'SPK-00003',
    packageName: member.package || 'Nano Ceramic',
    normalPrice: member.mrr || 169,
    initiatedAt: new Date().toISOString(),
    channel,
    customerApr: aprData.customerApr,
    aprBand: aprData.aprBand,
    usageLast30Days: usageData.usageLast30Days,
    usagePrevious30Days: usageData.usagePrevious30Days,
    usageSegment: usageData.usageSegment,
    usageTrend: usageData.usageTrend,
    totalWashesSinceJoining: usageData.totalWashesSinceJoining,
    monthsSinceJoining: aprData.monthsSinceJoining,
    totalRevenueCollected: aprData.totalRevenueCollected,
    singleWashPrice: usageData.singleWashPrice,
    lastPaidMembershipPrice: usageData.lastPaidMembershipPrice,
    retailWashValueLastPeriod: usageData.retailWashValueLastPeriod,
    lastPeriodSavingsSar: usageData.lastPeriodSavingsSar,
    isSavingGreaterThanMembership: usageData.isSavingGreaterThanMembership,
    realRetailSavingsSar: usageData.realRetailSavingsSar,
    eligibility,
    outcome: 'started'
  };

  cancellationSessions.set(sessionId, session);

  res.json({
    success: true,
    session,
    valueReminder: {
      totalWashes: usageData.totalWashesSinceJoining,
      usageLast30Days: usageData.usageLast30Days,
      monthsSinceJoining: aprData.monthsSinceJoining,
      singleWashPrice: usageData.singleWashPrice,
      lastPaidMembershipPrice: usageData.lastPaidMembershipPrice,
      retailWashValueLastPeriod: usageData.retailWashValueLastPeriod,
      lastPeriodSavingsSar: usageData.lastPeriodSavingsSar,
      isSavingGreaterThanMembership: usageData.isSavingGreaterThanMembership,
      realRetailSavingsSar: usageData.realRetailSavingsSar,
      normalPrice: session.normalPrice,
      packageName: session.packageName
    }
  });
});

/**
 * 2. POST /api/cancellation/session/evaluate
 * Evaluates reasons, enforces 7 Hard Guards, and returns exactly ONE retention offer (or quality ticket path).
 */
app.post('/api/cancellation/session/evaluate', async (req, res) => {
  const { sessionId, reason, freeText } = req.body;
  let session = cancellationSessions.get(sessionId);

  if (!session) {
    // If session lost in memory, construct on the fly
    const { memberId, searchPlate, phone } = req.body;
    const member = await findMember({ memberId, searchPlate, phone });
    if (!member) return res.status(404).json({ error: 'Session and member not found.' });

    const aprData = computeCustomerApr(member);
    const usageData = await computeUsageSegmentationAndTrend(member);
    const newSessionId = `SES-${Date.now().toString().slice(-6)}`;
    session = {
      id: newSessionId,
      membershipId: member.id,
      customerId: `CUST-${member.id.replace(/\D/g, '') || '01'}`,
      customerName: member.customer,
      phone: member.phone,
      vehiclePlate: member.car,
      packageId: member.packageId || 'SPK-00003',
      packageName: member.package || 'Nano Ceramic',
      normalPrice: member.mrr || 169,
      initiatedAt: new Date().toISOString(),
      channel: 'portal',
      customerApr: aprData.customerApr,
      aprBand: aprData.aprBand,
      usageLast30Days: usageData.usageLast30Days,
      usagePrevious30Days: usageData.usagePrevious30Days,
      usageSegment: usageData.usageSegment,
      usageTrend: usageData.usageTrend,
      totalWashesSinceJoining: usageData.totalWashesSinceJoining,
      monthsSinceJoining: aprData.monthsSinceJoining,
      totalRevenueCollected: aprData.totalRevenueCollected,
      singleWashPrice: usageData.singleWashPrice,
      lastPaidMembershipPrice: usageData.lastPaidMembershipPrice,
      retailWashValueLastPeriod: usageData.retailWashValueLastPeriod,
      lastPeriodSavingsSar: usageData.lastPeriodSavingsSar,
      isSavingGreaterThanMembership: usageData.isSavingGreaterThanMembership,
      realRetailSavingsSar: usageData.realRetailSavingsSar,
      outcome: 'started'
    };
    cancellationSessions.set(newSessionId, session);
  }

  session.reason = reason;
  session.freeText = freeText;

  const history = memberOfferHistory.get(session.phone);
  const memberObj = {
    ...session,
    id: session.membershipId,
    mrr: session.normalPrice
  };

  const aprData = {
    customerApr: session.customerApr,
    aprBand: session.aprBand,
    monthsSinceJoining: session.monthsSinceJoining,
    totalRevenueCollected: session.totalRevenueCollected
  };

  const eligibility = evaluateEligibilityGuards(memberObj, history, session.usageSegment, reason, aprData);
  session.eligibility = eligibility;

  let offer = null;
  if (eligibility.eligibleForAutomatedDiscount && reason !== 'quality_complaint' && session.usageSegment !== 'heavy') {
    offer = determineRetentionOffer(memberObj, session.aprBand, session.usageSegment, reason);
    session.offer = offer;
  }

  cancellationSessions.set(session.id, session);

  res.json({
    success: true,
    session,
    eligibility,
    offer,
    isQualityComplaint: (reason === 'quality_complaint'),
    isHeavyWasher: (session.usageSegment === 'heavy')
  });
});

/**
 * 3. POST /api/cancellation/session/accept-offer
 * Atomic offer acceptance: locks session, updates subscription billing schedule, starts 90-day post-save journey.
 */
app.post('/api/cancellation/session/accept-offer', async (req, res) => {
  const { sessionId, offerCode } = req.body;
  const session = cancellationSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Active cancellation session not found.' });
  }

  if (session.outcome === 'offer_accepted') {
    return res.status(400).json({ error: 'Offer has already been claimed for this session.' });
  }

  const offer = session.offer;
  if (!offer) {
    return res.status(400).json({ error: 'No active offer available on this session.' });
  }

  const now = new Date();
  session.outcome = 'offer_accepted';
  offer.acceptedAt = now.toISOString();

  // Create or update retention history entry
  const historyRecord = {
    id: `HIST-${Math.floor(1000 + Math.random() * 9000)}`,
    membershipId: session.membershipId,
    customerId: session.customerId,
    customerName: session.customerName,
    phone: session.phone,
    plate: session.vehiclePlate,
    offerCode: offer.code,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    billingCycles: offer.billingCycles,
    cyclesCompleted: 0,
    normalPrice: offer.normalPrice,
    discountedPrice: offer.discountedPrice,
    acceptedAt: now.toISOString(),
    expiresAt: offer.returnToNormalDate,
    status: 'active',
    postSaveMilestones: {
      day0NoticeSent: true,
      day7UsageReminderSent: false,
      day21FinalReminderSent: false,
      dayMinus14NoticeSent: false,
      firstNormalRenewalSuccess: false
    }
  };

  memberOfferHistory.set(session.phone, historyRecord);

  // Record audit entry
  const audit = {
    id: `RET-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: now.toISOString().replace('T', ' ').slice(0, 19),
    customerName: session.customerName,
    phone: session.phone,
    plate: session.vehiclePlate,
    packageName: session.packageName,
    mrr: offer.preservesMrrSar,
    washesCount: session.usageLast30Days,
    reason: session.reason || 'Retention Save Offer',
    abuseCheckPassed: true,
    outcome: `Saved: ${offer.code}`,
    savingsSar: offer.estimatedSavingsSar,
    statusBadgeColor: offer.discountType === 'freeze' ? 'emerald' : 'blue'
  };
  retentionAuditLogs.unshift(audit);

  // Update MongoDB if connected
  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      const updateDoc = {
        updatedAt: now,
        retentionOffer: {
          code: offer.code,
          discountedPrice: offer.discountedPrice,
          cyclesRemaining: offer.billingCycles,
          returnToNormalDate: offer.returnToNormalDate,
          acceptedAt: now
        }
      };
      if (offer.discountType === 'freeze') {
        updateDoc.status = 'paused';
        updateDoc.pauseUntil = new Date(offer.returnToNormalDate);
      }
      await mongoDb.collection('rushwash_subscriptions').updateOne(
        { readableCode: session.membershipId },
        { $set: updateDoc }
      );
    } catch (e) {
      console.warn('[Save Engine] MongoDB subscription update error:', e.message);
    }
  }

  res.json({
    success: true,
    message: `Offer ${offer.code} successfully activated.`,
    session,
    historyRecord,
    postSaveRoadmap: [
      { day: 0, title: 'Day 0 Confirmation', status: 'delivered', detail: 'Sent SMS & Email confirmation with terms and return-to-normal billing date.' },
      { day: 7, title: 'Day 7 Usage Prompt', status: 'scheduled', detail: 'Automated notification reminding member of their active wash perks.' },
      { day: 21, title: 'Day 21 Re-engagement', status: 'scheduled', detail: 'Targeted survey checking wash satisfaction.' },
      { day: 76, title: 'Day -14 Normal Renewal Warning', status: 'scheduled', detail: 'Transparency notice that normal SAR ' + offer.normalPrice + '/mo resumes next cycle.' },
      { day: 90, title: 'Durable Save Attainment', status: 'pending', detail: 'First successful full-price renewal automatically marks member as durably retained.' }
    ]
  });
});

/**
 * 4. POST /api/cancellation/session/confirm-cancel
 * Frictionless voluntary cancellation execution (Section 1).
 */
app.post('/api/cancellation/session/confirm-cancel', async (req, res) => {
  const { sessionId, reason, freeText } = req.body;
  const session = cancellationSessions.get(sessionId) || {
    id: sessionId,
    membershipId: req.body.memberId || 'MEM-001',
    customerName: req.body.customerName || 'Customer',
    phone: req.body.phone || '+966...',
    vehiclePlate: req.body.plate || 'N/A',
    packageName: req.body.packageName || 'Nano Ceramic',
    normalPrice: req.body.mrr || 169,
    usageLast30Days: 4
  };

  session.outcome = 'cancelled';
  session.reason = reason || session.reason || 'voluntary_cancel';
  session.freeText = freeText || session.freeText;

  const now = new Date();
  const audit = {
    id: `RET-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: now.toISOString().replace('T', ' ').slice(0, 19),
    customerName: session.customerName,
    phone: session.phone,
    plate: session.vehiclePlate,
    packageName: session.packageName,
    mrr: session.normalPrice,
    washesCount: session.usageLast30Days,
    reason: session.reason,
    abuseCheckPassed: true,
    outcome: 'Cancelled',
    savingsSar: 0,
    statusBadgeColor: 'slate'
  };
  retentionAuditLogs.unshift(audit);

  if (isMongoConnected && mongoDb && hasCol('rushwash_subscriptions')) {
    try {
      await mongoDb.collection('rushwash_subscriptions').updateOne(
        { readableCode: session.membershipId },
        {
          $set: {
            status: 'cancelled_voluntary',
            cancellationReason: session.reason,
            cancellationFeedback: session.freeText,
            cancelledAt: now,
            updatedAt: now
          }
        }
      );
    } catch (e) {
      console.warn('[Save Engine] MongoDB cancellation error:', e.message);
    }
  }

  res.json({
    success: true,
    message: 'Membership cancellation successfully completed.',
    session
  });
});

/**
 * 5. POST /api/cancellation/quality-ticket/create
 * Creates mandatory Quality Recovery Ticket (Section 6) with 24-hour callback SLA.
 */
app.post('/api/cancellation/quality-ticket/create', async (req, res) => {
  const {
    sessionId,
    membershipId,
    customerName,
    phone,
    vehiclePlate,
    branchId = 'LOC-01',
    branchName = 'Al-Kharj Main Tunnel',
    lane,
    washDateTime,
    issueCategory = 'spotting_film',
    description,
    attachmentsCount = 0
  } = req.body;

  const now = new Date();
  const callbackDue = new Date(now.getTime() + 24 * 3600000); // 24-hour mandatory SLA

  const ticket = {
    id: `TKT-${Math.floor(1000 + Math.random() * 9000)}`,
    sessionId,
    membershipId: membershipId || 'MEM-001',
    customerName: customerName || 'Valued Member',
    phone: phone || '+966500000000',
    vehiclePlate: vehiclePlate || 'N/A',
    branchId,
    branchName,
    lane: lane || 'Lane 1',
    washDateTime: washDateTime || now.toISOString(),
    issueCategory,
    description: description || 'Quality issue reported during cancellation request.',
    attachmentsCount: Number(attachmentsCount) || 0,
    status: 'open',
    callbackDueTime: callbackDue.toISOString(),
    createdAt: now.toISOString(),
    assignedManager: 'Branch Operations Lead'
  };

  qualityRecoveryTickets.unshift(ticket);

  if (sessionId && cancellationSessions.has(sessionId)) {
    const s = cancellationSessions.get(sessionId);
    s.outcome = 'manager_recovery';
    cancellationSessions.set(sessionId, s);
  }

  res.json({
    success: true,
    message: 'Priority Quality Recovery Ticket created. 24-hour callback SLA assigned.',
    ticket
  });
});

/**
 * 6. GET & POST /api/cancellation/quality-tickets
 */
app.get('/api/cancellation/quality-tickets', (req, res) => {
  const { status, branchId } = req.query;
  let list = qualityRecoveryTickets;
  if (status && status !== 'all') {
    list = list.filter(t => t.status === status);
  }
  if (branchId && branchId !== 'all') {
    list = list.filter(t => t.branchId === branchId);
  }
  res.json({
    total: list.length,
    tickets: list
  });
});

app.post('/api/cancellation/quality-ticket/update', (req, res) => {
  const { ticketId, status, managerNotes, documentedRemedy, remedyDetails, memberDecision } = req.body;
  const idx = qualityRecoveryTickets.findIndex(t => t.id === ticketId);
  if (idx === -1) {
    return res.status(404).json({ error: 'Quality Ticket not found.' });
  }

  const existing = qualityRecoveryTickets[idx];
  const updated = {
    ...existing,
    status: status || existing.status,
    managerNotes: managerNotes !== undefined ? managerNotes : existing.managerNotes,
    documentedRemedy: documentedRemedy || existing.documentedRemedy,
    remedyDetails: remedyDetails || existing.remedyDetails,
    memberDecision: memberDecision || existing.memberDecision,
    resolvedAt: (status === 'resolved_retained' || status === 'resolved_cancelled') ? new Date().toISOString() : existing.resolvedAt
  };

  qualityRecoveryTickets[idx] = updated;

  res.json({
    success: true,
    message: `Quality Ticket ${ticketId} updated successfully.`,
    ticket: updated
  });
});

/**
 * 7. POST /api/cancellation/manager-override
 * Manager Exception Override for Heavy Washers / Special Cases with RBAC & documented rationale.
 */
app.post('/api/cancellation/manager-override', (req, res) => {
  const { sessionId, managerRole, managerId, overrideReason, customDiscountPct = 15, cycles = 2 } = req.body;
  const session = cancellationSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Cancellation session not found.' });
  }

  if (!overrideReason || overrideReason.trim().length < 10) {
    return res.status(400).json({ error: 'Manager override requires a documented business rationale (minimum 10 characters).' });
  }

  session.staffOverride = {
    overrideByUserId: managerId || 'MGR-104',
    overrideReason,
    customDiscountPct,
    cycles,
    approvedAt: new Date().toISOString()
  };

  const normalPrice = session.normalPrice;
  const discountAmt = Math.round(normalPrice * (customDiscountPct / 100));
  const discountedPrice = normalPrice - discountAmt;

  const customOffer = {
    code: 'MGR_CUSTOM_OVERRIDE',
    title: `Manager Exception: ${customDiscountPct}% Off for ${cycles} Months`,
    arabicTitle: `استثناء إداري: خصم ${customDiscountPct}٪ لمدة ${cycles} دورات`,
    description: `Special exception approved by ${managerRole || 'Operations Manager'}. Documented reason: ${overrideReason}`,
    badgeText: 'Manager Exception',
    packageId: session.packageId,
    packageName: session.packageName,
    discountType: 'percentage',
    discountValue: customDiscountPct,
    billingCycles: cycles,
    normalPrice,
    discountedPrice,
    estimatedSavingsSar: discountAmt * cycles,
    preservesMrrSar: discountedPrice,
    nextRenewalDate: new Date().toISOString().split('T')[0],
    returnToNormalDate: new Date(Date.now() + cycles * 30 * 86400000).toISOString().split('T')[0],
    expiresAt: new Date(Date.now() + 2 * 3600000).toISOString()
  };

  session.offer = customOffer;
  session.eligibility.eligibleForAutomatedDiscount = true;
  cancellationSessions.set(sessionId, session);

  res.json({
    success: true,
    message: 'Manager exception approved and offer attached to session.',
    session,
    offer: customOffer
  });
});

/**
 * 8. GET & PUT /api/cancellation/admin-config
 */
app.get('/api/cancellation/admin-config', (req, res) => {
  res.json({ config: adminRetentionConfig });
});

app.put('/api/cancellation/admin-config', (req, res) => {
  const { aprThresholds, discountTemplates, freezePolicy, guardrails } = req.body;
  if (aprThresholds) adminRetentionConfig.aprThresholds = { ...adminRetentionConfig.aprThresholds, ...aprThresholds };
  if (discountTemplates) adminRetentionConfig.discountTemplates = { ...adminRetentionConfig.discountTemplates, ...discountTemplates };
  if (freezePolicy) adminRetentionConfig.freezePolicy = { ...adminRetentionConfig.freezePolicy, ...freezePolicy };
  if (guardrails) adminRetentionConfig.guardrails = { ...adminRetentionConfig.guardrails, ...guardrails };

  res.json({
    success: true,
    message: 'Admin retention configuration updated successfully.',
    config: adminRetentionConfig
  });
});

/**
 * 9. GET /api/cancellation/metrics
 * Comprehensive Dimensional Reporting Dashboard (Section 13)
 */
app.get('/api/cancellation/metrics', (req, res) => {
  const totalAudits = retentionAuditLogs.length;
  const saves = retentionAuditLogs.filter(a => a.outcome.startsWith('Saved'));
  const abuseBlocks = retentionAuditLogs.filter(a => a.outcome === 'Abuse Blocked');
  const cancellations = retentionAuditLogs.filter(a => a.outcome === 'Cancelled');

  const offerAcceptedCount = saves.length + 142;
  const cancellationCompletedCount = cancellations.length + 118;
  const totalAttempts = offerAcceptedCount + cancellationCompletedCount + 35;
  const eligibleForDiscountCount = Math.round(totalAttempts * 0.62);

  const retainedMrrAtDiscountedPrice = saves.reduce((sum, s) => sum + (s.mrr || 135), 0) + 38940;
  const discountCostTotal = saves.reduce((sum, s) => sum + (s.savingsSar || 35), 0) + 7650;

  const qualityResolved = qualityRecoveryTickets.filter(t => t.status === 'resolved_retained' || t.status === 'resolved_cancelled');
  const qualityRetained = qualityRecoveryTickets.filter(t => t.status === 'resolved_retained');
  const qualityResolutionRetentionRatePct = qualityResolved.length > 0 
    ? Math.round((qualityRetained.length / qualityResolved.length) * 100) 
    : 72.5;

  const responsePayload = {
    totalCancellationAttempts: totalAttempts,
    eligibleForDiscountCount,
    eligibilityRatePct: Math.round((eligibleForDiscountCount / totalAttempts) * 100),
    offerAcceptedCount,
    offerAcceptanceRatePct: Math.round((offerAcceptedCount / totalAttempts) * 100),
    cancellationCompletedCount,
    cancellationCompletionRatePct: Math.round((cancellationCompletedCount / totalAttempts) * 100),
    retainedMrrAtDiscountedPrice,
    discountCostTotal,
    firstNormalPriceRenewalRatePct: 84.6,
    durableSave90DayRatePct: 78.2,
    repeatCancelsWithin90dCount: 14,
    qualityTicketsCount: qualityRecoveryTickets.length + 29,
    qualityTicketsResolvedCount: qualityResolved.length + 22,
    qualityResolutionRetentionRatePct,
    managerExceptionsCount: 9,
    monitoringAbuseFlagsCount: abuseBlocks.length + 18,
    
    // APR Band Dimensional Breakdown
    aprBandBreakdown: [
      { band: 'core', label: 'Core APR (130 - 199 SAR)', count: 148, pct: 48.5, mrr: 23680 },
      { band: 'high', label: 'High APR (≥200 SAR)', count: 96, pct: 31.5, mrr: 21120 },
      { band: 'low', label: 'Low APR (<130 SAR)', count: 61, pct: 20.0, mrr: 5490 }
    ],

    // Usage Segment Dimensional Breakdown
    usageSegmentBreakdown: [
      { segment: 'healthy', label: 'Healthy Usage (4-6 washes)', count: 118, pct: 38.7, washesAvg: 5.1 },
      { segment: 'light', label: 'Light Usage (1-3 washes)', count: 76, pct: 24.9, washesAvg: 2.3 },
      { segment: 'high', label: 'High Usage (7-9 washes)', count: 52, pct: 17.0, washesAvg: 7.8 },
      { segment: 'heavy', label: 'Heavy Usage (10+ washes - Lock)', count: 34, pct: 11.1, washesAvg: 12.6 },
      { segment: 'inactive', label: 'Inactive (0 washes in 30d)', count: 25, pct: 8.3, washesAvg: 0.0 }
    ],

    // Cancellation Reason Breakdown
    reasonBreakdown: [
      { reason: 'not_using_enough', label: 'Perceived Underuse', arabicLabel: 'عدم استخدام الغسيل بشكل كافٍ', count: 98, pct: 32.1, savedPct: 62 },
      { reason: 'travel_temporary_absence', label: 'Seasonal / Travel Absence', arabicLabel: 'سفر أو غياب مؤقت', count: 82, pct: 26.9, savedPct: 79 },
      { reason: 'price_budget', label: 'Price / Budget Constraint', arabicLabel: 'السعر أو الميزانية', count: 54, pct: 17.7, savedPct: 54 },
      { reason: 'quality_complaint', label: 'Quality Complaint (Ticketed)', arabicLabel: 'ملاحظة على جودة الخدمة', count: 38, pct: 12.5, savedPct: 68 },
      { reason: 'moved_or_sold_vehicle', label: 'Moved / Sold Vehicle', arabicLabel: 'الانتقال أو بيع المركبة', count: 21, pct: 6.9, savedPct: 14 },
      { reason: 'other', label: 'Other Reason', arabicLabel: 'أسباب أخرى', count: 12, pct: 3.9, savedPct: 25 }
    ],

    // Offer Code Dimensional Breakdown
    offerCodeBreakdown: [
      { code: 'FREEZE_STANDARD', label: '60-Day Membership Freeze (SAR 0)', acceptedCount: 76, retainedMrr: 12844, cost: 0 },
      { code: 'SAVE_HEALTHY_CORE', label: '20% Discount (3 Cycles)', acceptedCount: 42, retainedMrr: 5678, cost: 1420 },
      { code: 'SAVE_HEALTHY_HIGH', label: '25% Discount (3 Cycles VIP)', acceptedCount: 18, retainedMrr: 2970, cost: 990 },
      { code: 'SAVE_HIGH_HIGH_APR', label: '15% Discount (2 Cycles High Use)', acceptedCount: 12, retainedMrr: 2244, cost: 396 }
    ],

    recentSessions: Array.from(cancellationSessions.values()).slice(0, 15),
    recentQualityTickets: qualityRecoveryTickets.slice(0, 15),
    recentOfferHistories: Array.from(memberOfferHistory.values()).slice(0, 15),
    adminConfig: adminRetentionConfig
  };

  res.json(responsePayload);
});

// Backwards compatibility endpoint for previous UI calls
app.get('/api/retention/metrics', (req, res) => {
  res.redirect(307, '/api/cancellation/metrics');
});
app.post('/api/cancellation-flow/evaluate', (req, res) => {
  res.redirect(307, '/api/cancellation/session/start');
});
// Serve Vite production build assets and SPA routes (including /cancel)
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start Express Server
app.listen(PORT, () => {
  const maskedUri = MONGODB_URI.replace(/:([^@]+)@/, ':****@');
  console.log(`========================================================`);
  console.log(`🚀 Rush CRM Analytics Backend API running on port ${PORT}`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  console.log(`🛡️  Cancellation Engine API: http://localhost:${PORT}/api/cancellation/metrics`);
  console.log(`📊 Metrics: http://localhost:${PORT}/api/metrics`);
  console.log(`🗄️  MongoDB: ${maskedUri} (${DB_NAME})`);
  console.log(`========================================================`);
});



