import * as fs from 'fs';
import * as path from 'path';
import { MTN_UPLOAD_DIR } from './mtn.constants';

export function ensureMtnUploadDir(): string {
  const absolute = path.isAbsolute(MTN_UPLOAD_DIR)
    ? MTN_UPLOAD_DIR
    : path.join(process.cwd(), MTN_UPLOAD_DIR);
  fs.mkdirSync(absolute, { recursive: true });
  return absolute;
}

/** Store path relative to project root, e.g. storage/uploads/mtn/file.xlsx */
export function toRelativeStoragePath(absolutePath: string): string {
  const relative = path.relative(process.cwd(), absolutePath);
  return relative.split(path.sep).join('/');
}

export function resolveStoragePath(storedPath: string): string {
  if (path.isAbsolute(storedPath)) return storedPath;
  return path.join(process.cwd(), storedPath.replace(/\//g, path.sep));
}
