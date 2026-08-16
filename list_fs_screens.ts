import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

let credential;
if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  credential = cert(JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON));
} else {
  const serviceAccountPath = './serviceAccountKey.json';
  if (fs.existsSync(serviceAccountPath)) {
    credential = cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')));
  } else {
    console.warn("No credentials");
    process.exit(1);
  }
}

initializeApp({ credential });
const configData = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const databaseId = configData.firestoreDatabaseId || '(default)';
const db = getFirestore(databaseId);

async function list() {
  const snap = await db.collection('screens').get();
  console.log(`Firestore total screens: ${snap.size}`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id}, Name: ${data.name}, approved: ${data.approved}, groupId: ${data.groupId}`);
  });
  
  const gSnap = await db.collection('groups').get();
  console.log(`Firestore total groups: ${gSnap.size}`);
  gSnap.forEach(d => {
    const data = d.data();
    console.log(`GroupID: ${d.id}, Name: ${data.name}, Code: ${data.code}`);
  });
  process.exit(0);
}
list();
