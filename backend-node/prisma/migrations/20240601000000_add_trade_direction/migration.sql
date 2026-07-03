-- CreateEnum
CREATE TYPE "TradeDirection" AS ENUM ('LONG', 'SHORT');

-- AlterTable
ALTER TABLE "paper_trades" ADD COLUMN "direction" "TradeDirection" NOT NULL DEFAULT 'LONG';
