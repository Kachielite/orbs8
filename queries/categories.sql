INSERT INTO category (name, description, icon, type, regex, created_at, updated_at)
VALUES
-- Transfers
('Peer-to-Peer Transfer', 'Money sent directly to individuals, friends, or family through bank transfer, P2P apps, or remittance services.', '👤', 'expense', '(IFO|TRANSFER|P2P|SEND|TO|TRF//FRM|BENEFICIARY|REVERSAL|REVSL|MOBILE\\s?MONEY|PERSONAL\\s?TRANSFER|PAYMENT\\s?TO|[A-Z]{2,}\\s+[A-Z]{2,}(\\s+[A-Z]{2,})?)', NOW(), NOW()),

-- Business & Subscriptions
('Business Payment', 'Payments made to businesses or merchants for goods and services, excluding subscriptions and utilities.', '🏢', 'expense', '(POS|WEB|PAYMENT|STORE|MERCHANT|SHOP|ONLINE)\\s+[@A-Z0-9_-]+', NOW(), NOW()),
('Subscriptions', 'Recurring payments to digital services like music, video streaming, SaaS tools, or online memberships.', '📺', 'expense', '(SPOTIFY|NETFLIX|APPLE|MICROSOFT|GOOGLE|YOUTUBE|DISNEY|SUBSCRIPTION|PLAN|PREMIUM|JETBRAINS|GITHUB)', NOW(), NOW()),

-- Lifestyle & Essentials
('Entertainment & Leisure', 'Expenses for movies, games, events, nightlife, or recreational activities.', '🎮', 'expense', '(MOVIE|CINEMA|CLUB|TICKET|EVENT|GAME|PLAYSTATION|STEAM)', NOW(), NOW()),
('Mobile & Internet', 'Payments for mobile top-ups, internet data, broadband, or telecom services.', '📱', 'expense', '(MTN|AIRTEL|GLO|9MOBILE|VODAFONE|SAFARICOM|TELKOM|RECHARGE|DATA|TOP\\s?UP|BUNDLE)', NOW(), NOW()),
('Utilities', 'Payments for electricity, water, gas, or similar household services.', '💡', 'expense', '(ELECTRIC|POWER|UTILITY|WATER|GAS|BILL|NEPA|KES|KPLC)', NOW(), NOW()),
('Groceries', 'Purchases from supermarkets, convenience stores, or grocery delivery apps.', '🛒', 'expense', '(SUPERMARKET|GROCERY|SHOPRITE|MARKET|DELIVERY|FOODCO|SUPERMART|GLOVO)', NOW(), NOW()),
('Retail & E-commerce', 'Purchases from physical or online retail stores (clothing, electronics, general shopping).', '🛍️', 'expense', '(JUMIA|AMAZON|ALIEXPRESS|SHEIN|EBAY|SHOP|STORE|BOUTIQUE|FASHION)', NOW(), NOW()),
('Dining & Food Delivery', 'Restaurant payments, cafés, takeaways, or online food delivery services.', '🍔', 'expense', '(EAT|CAFE|FOOD|RESTAURANT|DELIVERY|UBER\\s?EATS|JUMIA\\s?FOOD|DOORDASH|GLOVO)', NOW(), NOW()),

-- Transport & Travel
('Transport', 'Expenses on taxis, ride-hailing apps, buses, trains, or other local commuting.', '🚕', 'expense', '(UBER|BOLT|TAXI|BUS|TRAIN|FARE|RIDE)', NOW(), NOW()),
('Fuel & Auto', 'Spending on fuel, car maintenance, parking, or tolls.', '⛽', 'expense', '(FILLING\\s?STATION|FUEL|PETROL|OIL|AUTO|CAR|SERVICE|LUBRICANT|MECHANIC)', NOW(), NOW()),
('Travel', 'Flights, hotels, travel agencies, or vacation-related expenses.', '✈️', 'expense', '(FLIGHT|AIRWAYS|HOTEL|BOOKING|AGENCY|TRIP|VACATION|TRAVEL)', NOW(), NOW()),

-- Financial
('Bank Charges', 'Service fees, maintenance charges, card maintenance, ATM fees, or other bank-related deductions.', '🏦', 'expense', '(CHARGE|FEE|MAINTENANCE|ATM\\s?FEE|VAT|BANK\\s?FEE)', NOW(), NOW()),
('Currency Conversion', 'Debits from converting funds between currencies (FX transactions).', '💱', 'expense', '(FX|FOREX|CONVERSION|USD|GBP|EUR|EXCHANGE)', NOW(), NOW()),

-- Income
('Salary & Wages', 'Credits from salary, wages, or contract payments.', '💼', 'income', '(SALARY|PAYROLL|WAGES|HRPAY|INCOME|PAYMENT\\s?FROM|COMPENSATION|TAPPI)', NOW(), NOW()),
('Refunds & Reimbursements', 'Credits from refunds, cashback, or business reimbursements.', '↩️', 'income', '(REFUND|REVERSAL|CASHBACK|REV|REIMBURSE)', NOW(), NOW()),

-- Other Expenses
('Healthcare', 'Payments for hospitals, pharmacies, medical bills, or insurance.', '🏥', 'expense', '(HOSPITAL|PHARMACY|MEDICAL|CLINIC|HEALTH|INSURANCE|NHIS)', NOW(), NOW()),
('Education', 'Tuition fees, online courses, learning materials, or academic services.', '🎓', 'expense', '(SCHOOL|TUITION|COURSE|EDU|ACADEMY|E-LEARNING|TRAINING|BOOK)', NOW(), NOW()),
('Charity & Donations', 'Payments to charities, NGOs, religious contributions, or crowdfunding.', '🙏', 'expense', '(CHURCH|MOSQUE|CHARITY|DONATION|TITHE|FOUNDATION|NGO)', NOW(), NOW()),
('Cash Withdrawal', 'ATM withdrawals or cash taken directly from bank branches.', '💵', 'expense', '(ATM|CASH\\s?WITHDRAWAL|BRANCH)', NOW(), NOW()),

-- Fallback
('Uncategorized', 'Transactions that do not fit into any predefined category or require manual review.', '❓', 'expense', NULL, NOW(), NOW());