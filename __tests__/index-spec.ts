jest.mock('../src/admin');

import * as index from '../src/index';

test('Should have main available', () => {
  expect(index).toBeTruthy();
});
