import { BadRequestException, Injectable } from '@nestjs/common';
import { Cell, Workbook } from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { normalizeMtnPlanId } from './mtn-plan.util';

const MSISDN_HEADER_NAMES = [
  'msisdn',
  'misdn',
  'phone',
  'mobile',
  'number',
  'phonenumber',
  'msisdn_number',
  'subscriber',
];

const PLAN_ID_HEADER_NAMES = [
  'plan_id',
  'planid',
  'plan',
  'subscription_id',
  'subscriptionid',
];

export type MtnSubscriptionRow = {
  msisdn: string;
  planId: string;
};

@Injectable()
export class MtnExcelService {
  async readSubscriptionRowsFromFile(
    filePath: string,
  ): Promise<MtnSubscriptionRow[]> {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!['.xlsx', '.csv'].includes(ext)) {
      throw new BadRequestException(
        'Only .xlsx and .csv files are supported',
      );
    }

    const rows = await this.readSheetRows(filePath, ext);
    if (!rows.length) {
      throw new BadRequestException('Excel sheet is empty');
    }

    const layout = this.resolveColumnLayout(rows);
    if (layout.planIdColIndex < 0) {
      throw new BadRequestException(
        'Excel must include a plan_id column (headers: misdn, plan_id)',
      );
    }

    const seen = new Set<string>();
    const subscriptionRows: MtnSubscriptionRow[] = [];

    for (let i = layout.startRow; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;

      const rawMsisdn = row[layout.msisdnColIndex];
      const normalized = this.normalizeMsisdn(rawMsisdn);
      if (!normalized) continue;

      const planId = this.normalizePlanId(row[layout.planIdColIndex]);
      if (!planId) {
        throw new BadRequestException(
          `Row ${i + 1}: plan_id is required for msisdn ${normalized}`,
        );
      }

      const rowKey = `${normalized}|${planId}`;
      if (seen.has(rowKey)) continue;

      seen.add(rowKey);
      subscriptionRows.push({ msisdn: normalized, planId });
    }

    if (!subscriptionRows.length) {
      throw new BadRequestException('No valid MSISDN values found in file');
    }

    return subscriptionRows;
  }

  private async readSheetRows(
    filePath: string,
    ext: string,
  ): Promise<string[][]> {
    const workbook = new Workbook();
    if (ext === '.csv') {
      await workbook.csv.readFile(filePath);
    } else {
      await workbook.xlsx.readFile(filePath);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) {
      throw new BadRequestException('Excel file has no sheets');
    }

    const colCount = Math.max(sheet.columnCount, 1);
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      for (let i = 1; i <= colCount; i++) {
        cells.push(this.cellToString(row.getCell(i)));
      }
      rows.push(cells);
    });

    return rows;
  }

  private cellToString(cell: Cell): string {
    const value = cell.value;
    if (value === undefined || value === null) return '';
    if (typeof value === 'object' && 'text' in value && value.text != null) {
      return String(value.text);
    }
    if (typeof value === 'object' && 'result' in value) {
      return String(value.result ?? '');
    }
    if (cell.text) return String(cell.text);
    return String(value);
  }

  private resolveColumnLayout(rows: string[][]): {
    startRow: number;
    msisdnColIndex: number;
    planIdColIndex: number;
  } {
    const headerRow = rows[0].map((c) => String(c ?? '').trim());
    const headerLower = headerRow.map((h) => h.toLowerCase());

    const msisdnCol = headerLower.findIndex((h) =>
      MSISDN_HEADER_NAMES.includes(h),
    );
    const planIdCol = headerLower.findIndex((h) =>
      PLAN_ID_HEADER_NAMES.includes(h),
    );

    if (msisdnCol < 0) {
      throw new BadRequestException(
        'Excel must include a msisdn column (headers: misdn, plan_id)',
      );
    }

    return { startRow: 1, msisdnColIndex: msisdnCol, planIdColIndex: planIdCol };
  }

  private normalizeMsisdn(value: unknown): string | null {
    if (value === undefined || value === null) return null;

    let s = String(value).trim();
    if (!s) return null;

    if (/^[\d.]+e\+?\d+$/i.test(s)) {
      const n = Number(s);
      if (!Number.isNaN(n) && Number.isFinite(n)) {
        s = String(Math.trunc(n));
      }
    }

    s = s.replace(/[^\d+]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    s = s.replace(/\D/g, '');

    if (s.length < 8 || s.length > 20) return null;
    return s;
  }

  private normalizePlanId(value: unknown): string | null {
    return normalizeMtnPlanId(value);
  }
}
