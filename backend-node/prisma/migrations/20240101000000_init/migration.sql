-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "PaperTradeStatus" AS ENUM ('PENDING', 'ACTIVE', 'TARGET_HIT', 'STOP_LOSS_HIT', 'MANUALLY_CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BacktestStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "capital" DECIMAL(65,30) NOT NULL DEFAULT 100000,
    "risk_per_trade_pct" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "max_daily_loss_pct" DECIMAL(65,30) NOT NULL DEFAULT 3,
    "max_trades_per_day" INTEGER NOT NULL DEFAULT 5,
    "default_timeframe" TEXT NOT NULL DEFAULT '15m',
    "preferred_market_type" TEXT NOT NULL DEFAULT 'intraday',
    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "theory_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "theory_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "market_type" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_setups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "strategy_id" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "market_bias" TEXT NOT NULL,
    "setup_type" TEXT NOT NULL,
    "entry_zone" JSONB NOT NULL,
    "stop_loss" DECIMAL(65,30) NOT NULL,
    "target1" DECIMAL(65,30) NOT NULL,
    "target2" DECIMAL(65,30) NOT NULL,
    "risk_reward" DECIMAL(65,30) NOT NULL,
    "position_size" INTEGER NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "rules_passed" JSONB NOT NULL,
    "rules_failed" JSONB NOT NULL,
    "theory_references" JSONB NOT NULL,
    "reasoning" TEXT NOT NULL,
    "invalidation_condition" TEXT NOT NULL,
    "raw_analysis" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "trade_setups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "strategy_id" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "from_date" TIMESTAMP(3) NOT NULL,
    "to_date" TIMESTAMP(3) NOT NULL,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "winning_trades" INTEGER NOT NULL DEFAULT 0,
    "losing_trades" INTEGER NOT NULL DEFAULT 0,
    "win_rate" DECIMAL(65,30),
    "avg_rr" DECIMAL(65,30),
    "max_drawdown" DECIMAL(65,30),
    "net_pnl" DECIMAL(65,30),
    "status" "BacktestStatus" NOT NULL DEFAULT 'PENDING',
    "result_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backtests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_trades" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "setup_id" TEXT,
    "strategy_id" TEXT,
    "symbol" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "entry_price" DECIMAL(65,30) NOT NULL,
    "stop_loss" DECIMAL(65,30) NOT NULL,
    "target1" DECIMAL(65,30) NOT NULL,
    "target2" DECIMAL(65,30) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "capital_used" DECIMAL(65,30) NOT NULL,
    "status" "PaperTradeStatus" NOT NULL DEFAULT 'PENDING',
    "exit_price" DECIMAL(65,30),
    "pnl" DECIMAL(65,30),
    "notes" TEXT,
    "entry_at" TIMESTAMP(3),
    "exit_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "paper_trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_journal" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "paper_trade_id" TEXT,
    "symbol" TEXT NOT NULL,
    "setup_type" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "pnl" DECIMAL(65,30),
    "notes" TEXT,
    "mistakes" JSONB,
    "emotion_tags" JSONB,
    "screenshot_url" TEXT,
    "ai_review" TEXT,
    "lessons_learned" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trade_journal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "broker_connections" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "broker_name" TEXT NOT NULL,
    "api_key_encrypted" TEXT,
    "api_secret_encrypted" TEXT,
    "access_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "broker_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "users" ADD CONSTRAINT "users_email_key" UNIQUE ("email");
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_key" UNIQUE ("user_id");
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_setup_id_key" UNIQUE ("setup_id");
ALTER TABLE "trade_journal" ADD CONSTRAINT "trade_journal_paper_trade_id_key" UNIQUE ("paper_trade_id");

-- Indexes
CREATE INDEX "theory_documents_user_id_idx" ON "theory_documents"("user_id");
CREATE INDEX "strategies_user_id_idx" ON "strategies"("user_id");
CREATE INDEX "trade_setups_user_id_idx" ON "trade_setups"("user_id");
CREATE INDEX "backtests_user_id_idx" ON "backtests"("user_id");
CREATE INDEX "paper_trades_user_id_idx" ON "paper_trades"("user_id");
CREATE INDEX "trade_journal_user_id_idx" ON "trade_journal"("user_id");
CREATE INDEX "broker_connections_user_id_idx" ON "broker_connections"("user_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- Foreign keys
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "theory_documents" ADD CONSTRAINT "theory_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trade_setups" ADD CONSTRAINT "trade_setups_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_setup_id_fkey" FOREIGN KEY ("setup_id") REFERENCES "trade_setups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "paper_trades" ADD CONSTRAINT "paper_trades_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trade_journal" ADD CONSTRAINT "trade_journal_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trade_journal" ADD CONSTRAINT "trade_journal_paper_trade_id_fkey" FOREIGN KEY ("paper_trade_id") REFERENCES "paper_trades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
