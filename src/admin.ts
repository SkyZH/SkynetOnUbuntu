import * as admin from 'firebase-admin';

const serviceAccount = require('../data/firebase.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://skyzh-30755.firebaseio.com',
});

export default admin;
