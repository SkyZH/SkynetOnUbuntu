jest.mock('../src/admin');

import admin from '../src/admin';
import { Cache } from '../src/cache';
import * as moment from 'moment';

test('Should get promise', async() => {
  const db = admin.database().ref('/Test_Mon');
  db.autoFlush();
  const loc = db.child('CPU');
  const cache = new Cache(db);
  await cache.getPromise(loc, {
    id: `${moment('2018/08/01 09:00:00').unix()}`,
    table: 'hour',
    data: 23333
  });
  const result = await loc.child('hour').child(`${moment('2018/08/01 09:00:00').unix()}`).once('value');
  const data = result.val();
  expect(data.timestamp).toEqual(moment('2018/08/01 09:00:00').unix());
  expect(data.data).toBe(23333);
});

test('should respect policy', async() => {
  const db = admin.database().ref('/Test_Mon');
  const cache = new Cache(db);
  const result = await cache.get_key('233', { cacheOnly: true });
  expect(result).toBe(null);
});

test('should set cache', async() => {
  const db = admin.database().ref('/Test_Mon');
  const cache = new Cache(db);
  await cache.cacheSet('memory-hour-233', 120, 233);
  const data = await cache.proxyGet('memory', 'hour', '233');
  expect(data).toBe(233);
});

test('should use database', async () => {
  const db = admin.database().ref('/Test_Mon');
  db.autoFlush();
  const loc = db.child('CPU');
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
