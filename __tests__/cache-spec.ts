jest.mock('../src/admin');

import admin from '../src/admin';
import { Cache } from '../src/cache';
import * as moment from 'moment';

test('Should get promise', async() => {
  const firestore = admin.firestore();
  firestore.autoFlush();
  const db = firestore.collection('Test_Mon');
  const loc = db.doc('CPU');
  const cache = new Cache(db);
  await cache.getPromise(loc, {
    id: `${moment('2018/08/01 09:00:00').unix()}`,
    table: 'hour',
    data: 23333
  });
  const result = await loc.collection('hour').doc(`${moment('2018/08/01 09:00:00').unix()}`).get();
  const data = result.data();
  expect(data.timestamp).toEqual(new Date('2018/08/01 09:00:00'));
  expect(data.data).toBe(23333);
});

test('should respect policy', async() => {
  const db = admin.firestore().collection('Test_Mon');
  const cache = new Cache(db);
  const result = await cache.get_key('233', { cacheOnly: true });
  expect(result).toBe(null);
});

test('should set cache', async() => {
  const db = admin.firestore().collection('Test_Mon');
  const cache = new Cache(db);
  await cache.cacheSet('memory-hour-233', 120, 233);
  const data = await cache.proxyGet('memory', 'hour', '233');
  expect(data).toBe(233);
});

test('should use database', async () => {
  const firestore = admin.firestore();
  firestore.autoFlush();
  const db = firestore.collection('Test_Mon');
  const loc = db.doc('CPU');
  const cache = new Cache(db);
  const id = moment('2018/08/01 09:00:00').unix();
  await cache.getPromise(loc, {
    id: `${id}`,
    table: 'hour',
    data: 23333
  });
  const result = await cache.proxyGet('cpu', 'hour', `${id}`);
  expect(result).toBe(23333);
});
