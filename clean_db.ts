import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

// Initialize Firebase Admin
let credential;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  credential = cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON));
} else {
  const serviceAccountPath = './serviceAccountKey.json';
  if (fs.existsSync(serviceAccountPath)) {
    credential = cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')));
  } else {
    console.warn("No Firebase credentials found.");
    process.exit(1);
  }
}

initializeApp({ credential });
const configData = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const databaseId = configData.firestoreDatabaseId || '(default)';
console.log('Using databaseId:', databaseId);

const db = getFirestore(databaseId);

async function clean() {
  const snap = await db.collection('screens').get();
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.approved === false) {
      console.log('Deleting unapproved screen:', doc.id);
      await db.collection('screens').doc(doc.id).delete();
      count++;
    } else if (doc.id.toLowerCase().includes('iphone')) {
      console.log('Deleting iphone screen:', doc.id);
      await db.collection('screens').doc(doc.id).delete();
      count++;
    }
  }
  console.log(`Deleted ${count} screens from Firestore.`);
  
  if (fs.existsSync('screens.json')) {
      let screens = JSON.parse(fs.readFileSync('screens.json', 'utf8'));
      screens = screens.filter(s => s.approved !== false && !s.id.toLowerCase().includes('iphone'));
      fs.writeFileSync('screens.json', JSON.stringify(screens, null, 2));
      console.log('Cleaned screens.json');
  }
  process.exit(0);
}
clean();
