import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Workbook } from 'exceljs';
import { MtnExcelService } from './mtn-excel.service';

describe('MtnExcelService', () => {
  const service = new MtnExcelService();

  it('reads xlsx rows when same msisdn has different plan_id values', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtn-excel-'));
    const filePath = path.join(dir, 'subs.xlsx');
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet('Sheet1');
    sheet.addRow(['misdn', 'plan_id']);
    sheet.addRow(['26876521776', '26801220000007221']);
    sheet.addRow(['26876521776', '26801220000007222']);
    sheet.addRow(['26876521776', '26801220000007223']);
    await workbook.xlsx.writeFile(filePath);

    const rows = await service.readSubscriptionRowsFromFile(filePath);
    fs.rmSync(dir, { recursive: true, force: true });

    expect(rows).toEqual([
      { msisdn: '26876521776', planId: '26801220000007221' },
      { msisdn: '26876521776', planId: '26801220000007222' },
      { msisdn: '26876521776', planId: '26801220000007223' },
    ]);
  });
});
