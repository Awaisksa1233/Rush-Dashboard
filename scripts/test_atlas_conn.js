import 'dotenv/config';
import { MongoClient } from 'mongodb';

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

const rawUri = process.env.MONGODB_URI;
const uri = sanitizeMongoUri(rawUri);

console.log('Connecting to Atlas...');
const client = new MongoClient(uri);

async function inspect() {
  try {
    await client.connect();
    console.log('Connected to Atlas successfully!');
  } catch (err) {
    console.error('Connection failed:', err);
  } finally {
    await client.close();
  }
}

inspect();

