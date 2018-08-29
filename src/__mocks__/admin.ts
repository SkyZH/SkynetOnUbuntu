const firebaseMock = require('firebase-mock');

export const mock = true;

const mockdatabase = new firebaseMock.MockFirebase();
export default new firebaseMock.MockFirebaseSdk(
  (path: string) => {
    return path ? mockdatabase.child(path) : mockdatabase;
  },
  null,
  () => new firebaseMock.MockFirestore(),
  null,
  null
);
