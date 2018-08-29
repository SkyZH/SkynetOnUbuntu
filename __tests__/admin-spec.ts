jest.mock('../src/admin');

import admin from '../src/admin';
import * as _admin from '../src/admin';

test('Should have mock', () => {
  expect(admin).toBeTruthy();
  expect(_admin.mock).toBeTruthy();
});