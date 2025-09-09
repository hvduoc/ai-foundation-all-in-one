import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from '../src/index.js';

test('basic stub should return OK', () => {
  assert.equal(main(), 'OK');
});
