import { MtnExcelService } from './mtn-excel.service';

describe('MtnExcelService', () => {
  const service = new MtnExcelService();

  it('reads all rows when same msisdn has different plan_id values', () => {
    const rows = service.readSubscriptionRowsFromFile(
      'storage/uploads/mtn/1782407906065-ff14fd9d-d68f-4cc0-a5e7-a0da48161c0e.xlsx',
    );

    expect(rows).toHaveLength(3);
    expect(rows).toEqual([
      { msisdn: '26876521776', planId: '26801220000007221' },
      { msisdn: '26876521776', planId: '26801220000007222' },
      { msisdn: '26876521776', planId: '26801220000007223' },
    ]);
  });
});
