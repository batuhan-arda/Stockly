-- Update/Insert stock data with categories
-- First, add Category column if it doesn't exist
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Stocks' AND COLUMN_NAME = 'Category')
BEGIN
    ALTER TABLE Stocks ADD Category NVARCHAR(50) NULL;
END
GO

-- Update existing stocks with categories
UPDATE Stocks SET Category = 'Technology' WHERE Symbol IN ('AAPL', 'GOOGL', 'MSFT', 'NVDA', 'INTC', 'AMD', 'CSCO', 'ORCL', 'IBM', 'ADBE', 'CRM');
UPDATE Stocks SET Category = 'Automotive' WHERE Symbol = 'TSLA';
UPDATE Stocks SET Category = 'E-commerce' WHERE Symbol IN ('AMZN', 'BABA', 'SHOP');
UPDATE Stocks SET Category = 'Social Media' WHERE Symbol = 'META';
UPDATE Stocks SET Category = 'Entertainment' WHERE Symbol IN ('NFLX', 'DIS');
UPDATE Stocks SET Category = 'Aerospace' WHERE Symbol = 'BA';
UPDATE Stocks SET Category = 'Banking' WHERE Symbol = 'JPM';
UPDATE Stocks SET Category = 'Financial Services' WHERE Symbol IN ('V', 'PYPL', 'SQ');
UPDATE Stocks SET Category = 'Healthcare' WHERE Symbol = 'JNJ';
UPDATE Stocks SET Category = 'Consumer Goods' WHERE Symbol = 'PG';
UPDATE Stocks SET Category = 'Beverages' WHERE Symbol IN ('KO', 'PEP');
UPDATE Stocks SET Category = 'Energy' WHERE Symbol IN ('XOM', 'CVX');
UPDATE Stocks SET Category = 'Retail' WHERE Symbol IN ('WMT', 'TGT', 'HD');
UPDATE Stocks SET Category = 'Food & Beverage' WHERE Symbol IN ('MCD', 'SBUX');
UPDATE Stocks SET Category = 'Apparel' WHERE Symbol = 'NKE';
UPDATE Stocks SET Category = 'Transportation' WHERE Symbol IN ('UBER', 'LYFT');
UPDATE Stocks SET Category = 'Travel' WHERE Symbol = 'ABNB';

-- Insert additional stocks if they don't exist
IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'DIS')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('DIS', 'The Walt Disney Company', 'Entertainment');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'BA')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('BA', 'Boeing Company', 'Aerospace');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'JPM')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('JPM', 'JPMorgan Chase & Co.', 'Banking');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'V')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('V', 'Visa Inc.', 'Financial Services');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'JNJ')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('JNJ', 'Johnson & Johnson', 'Healthcare');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'PG')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('PG', 'Procter & Gamble Co.', 'Consumer Goods');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'KO')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('KO', 'The Coca-Cola Company', 'Beverages');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'PEP')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('PEP', 'PepsiCo Inc.', 'Beverages');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'XOM')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('XOM', 'Exxon Mobil Corporation', 'Energy');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'CVX')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('CVX', 'Chevron Corporation', 'Energy');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'INTC')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('INTC', 'Intel Corporation', 'Technology');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'AMD')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('AMD', 'Advanced Micro Devices Inc.', 'Technology');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'CSCO')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('CSCO', 'Cisco Systems Inc.', 'Technology');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'ORCL')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('ORCL', 'Oracle Corporation', 'Technology');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'IBM')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('IBM', 'International Business Machines', 'Technology');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'BABA')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('BABA', 'Alibaba Group', 'E-commerce');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'WMT')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('WMT', 'Walmart Inc.', 'Retail');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'TGT')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('TGT', 'Target Corporation', 'Retail');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'HD')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('HD', 'The Home Depot Inc.', 'Retail');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'MCD')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('MCD', 'McDonald''s Corporation', 'Food & Beverage');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'SBUX')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('SBUX', 'Starbucks Corporation', 'Food & Beverage');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'NKE')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('NKE', 'Nike Inc.', 'Apparel');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'ADBE')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('ADBE', 'Adobe Inc.', 'Technology');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'CRM')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('CRM', 'Salesforce Inc.', 'Technology');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'PYPL')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('PYPL', 'PayPal Holdings Inc.', 'Financial Services');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'SQ')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('SQ', 'Block Inc.', 'Financial Services');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'SHOP')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('SHOP', 'Shopify Inc.', 'E-commerce');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'UBER')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('UBER', 'Uber Technologies Inc.', 'Transportation');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'LYFT')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('LYFT', 'Lyft Inc.', 'Transportation');

IF NOT EXISTS (SELECT * FROM Stocks WHERE Symbol = 'ABNB')
    INSERT INTO Stocks (Symbol, CompanyName, Category) VALUES ('ABNB', 'Airbnb Inc.', 'Travel');

GO

-- View all stocks
SELECT * FROM Stocks ORDER BY Symbol;
