import fs from "fs";
const path = "src/lib/firebaseStore.ts";
let code = fs.readFileSync(path, "utf8");

const addition = `
export async function getSingleScreenFirestore(screenId: string): Promise<ScreenDevice | null> {
  if (!db) return null;
  try {
    const d = await getDoc(doc(db, 'screens', screenId));
    if (d.exists()) {
      return d.data() as ScreenDevice;
    }
    return null;
  } catch (err) {
    console.error('getSingleScreenFirestore error:', err);
    return null;
  }
}
`;

code = code + addition;
fs.writeFileSync(path, code);
