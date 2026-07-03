import { z } from 'zod';

export const reprocessSchema = z.object({});

export const ALLOWED_MIME_TYPES = ['application/pdf', 'text/plain'];
export const MAX_FILE_SIZE_MB = 20;
