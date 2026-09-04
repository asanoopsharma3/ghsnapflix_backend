import {
  generateMtnRequestTransactionId,
  generateUniqueMtnRequestTransactionIds,
} from './mtn-transaction-id.util';
import { MTN_REQUEST_TRANSACTION_ID_LENGTH } from './mtn.constants';

describe('mtn-transaction-id.util', () => {
  it('generates 8-char ids alternating character then digit', () => {
    const id = generateMtnRequestTransactionId();
    expect(id).toHaveLength(MTN_REQUEST_TRANSACTION_ID_LENGTH);
    expect(id).toMatch(/^[a-z][0-9][a-z][0-9][a-z][0-9][a-z][0-9]$/);
  });

  it('generates unique ids for a batch', () => {
    const ids = generateUniqueMtnRequestTransactionIds(100);
    expect(ids).toHaveLength(100);
    expect(new Set(ids).size).toBe(100);
  });
});
