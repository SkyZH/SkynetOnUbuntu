const firebaseMock = require('firebase-mock');

export const mock = true;

export default new firebaseMock.MockFirebaseSdk(
  null,
  null,
  () => new firebaseMock.MockFirestore(),
  null,
  null
);
