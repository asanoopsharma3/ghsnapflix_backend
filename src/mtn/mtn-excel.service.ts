import { BadRequestException, Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
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
  readSubscriptionRowsFromFile(filePath: string): MtnSubscriptionRow[] {
    if (!fs.existsSync(filePath)) {
      throw new BadRequestException(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      throw new BadRequestException(
        'Only .xlsx, .xls, and .csv files are supported',
      );
    }

    const workbook = XLSX.readFile(filePath, { cellDates: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Excel file has no sheets');
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

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

  private resolveColumnLayout(rows: (string | number)[][]): {
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
