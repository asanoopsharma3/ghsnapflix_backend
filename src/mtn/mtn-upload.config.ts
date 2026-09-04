import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { ensureMtnUploadDir } from './mtn-storage.util';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

export const mtnExcelUploadOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ensureMtnUploadDir());
    },
    filename: (_req, file, cb) => {
      const safeExt = extname(file.originalname).toLowerCase();
      const name = `${Date.now()}-${randomUUID()}${safeExt}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    const ext = extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      cb(
        new BadRequestException(
          'Only .xlsx, .xls, and .csv files are allowed',
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};
