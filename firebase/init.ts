import admin from "firebase-admin";

export function initAdmin() {
  if (admin.apps && admin.apps.length) {
    return admin.app();
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Missing FIREBASE_SERVICE_ACCOUNT");
  }

  const json = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf8")
  );

  admin.initializeApp({
    credential: admin.credential.cert(json),
    projectId: json.project_id || process.env.FIREBASE_PROJECT_ID
  });

  return admin.app();
}

export function getFirestore() {
  return initAdmin().firestore();
}

