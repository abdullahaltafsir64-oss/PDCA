import { PDCARecord } from "../types";
import { db, auth, collection, doc, setDoc, query, orderBy, where, onSnapshot } from "../firebase";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const COLLECTION_NAME = "pdca_records";

export function subscribeToRecords(uid: string, callback: (records: PDCARecord[]) => void) {
  const q = query(
    collection(db, COLLECTION_NAME), 
    where("authorUid", "==", uid)
  );
  
  return onSnapshot(q, (snapshot) => {
    const records = snapshot.docs.map(doc => doc.data() as PDCARecord);
    callback(records);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
  });
}

export async function saveRecord(record: PDCARecord): Promise<void> {
  if (!auth.currentUser) throw new Error("User must be authenticated to save records");
  
  const recordWithAuthor = {
    ...record,
    authorUid: auth.currentUser.uid
  };

  try {
    // Use the record's custom ID as document ID for consistency
    await setDoc(doc(db, COLLECTION_NAME, record.id), recordWithAuthor);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${record.id}`);
  }
}
