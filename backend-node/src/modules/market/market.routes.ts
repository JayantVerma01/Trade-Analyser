import { Router } from 'express';
import { getCandles, getQuote, searchSymbols } from './market.controller';
import { authenticate } from '../../middleware/auth.middleware';

export const marketRouter = Router();

marketRouter.use(authenticate);
marketRouter.get('/candles', getCandles);
marketRouter.get('/quote',   getQuote);
marketRouter.get('/symbols', searchSymbols);
