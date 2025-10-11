-- Truncate transaction, account, and bank tables
-- Note: This will delete all data in these tables and reset auto-increment IDs
-- Run with caution!

-- Disable foreign key checks temporarily (PostgreSQL)
SET session_replication_role = 'replica';

-- Truncate tables in order (child tables first to avoid FK constraints)
TRUNCATE TABLE "transaction" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "account" RESTART IDENTITY CASCADE;
TRUNCATE TABLE "bank" RESTART IDENTITY CASCADE;

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Verify the tables are empty
SELECT COUNT(*) as transaction_count FROM "transaction";
SELECT COUNT(*) as account_count FROM "account";
SELECT COUNT(*) as bank_count FROM "bank";

