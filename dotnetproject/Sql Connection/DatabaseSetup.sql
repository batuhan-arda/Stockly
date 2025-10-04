-- Create Users table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        Username NVARCHAR(50) NOT NULL UNIQUE,
        Email NVARCHAR(100) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL
    );
END
GO

-- Create Wallets table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Wallets' AND xtype='U')
BEGIN
    CREATE TABLE Wallets (
        UserId INT PRIMARY KEY,
        Balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        FOREIGN KEY (UserId) REFERENCES Users(Id)
    );
END
GO

-- Stored procedure to get user by email
CREATE OR ALTER PROCEDURE sp_GetUserByEmail
    @Email NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT Id, Username, Email, PasswordHash
    FROM Users
    WHERE Email = @Email;
END
GO

-- Stored procedure to get user by ID
CREATE OR ALTER PROCEDURE sp_GetUserById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT Id, Username, Email, PasswordHash
    FROM Users
    WHERE Id = @UserId;
END
GO

-- Stored procedure to create a new user
CREATE OR ALTER PROCEDURE sp_CreateUser
    @Username NVARCHAR(50),
    @Email NVARCHAR(100),
    @PasswordHash NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        INSERT INTO Users (Username, Email, PasswordHash)
        VALUES (@Username, @Email, @PasswordHash);
        
        SELECT SCOPE_IDENTITY() as NewUserId;
    END TRY
    BEGIN CATCH
        SELECT 0 as NewUserId;
    END CATCH
END
GO

-- Stored procedure to check if username exists
CREATE OR ALTER PROCEDURE sp_CheckUserExistsByUsername
    @Username NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM Users WHERE Username = @Username)
        SELECT CAST(1 AS BIT) as UserExists;
    ELSE
        SELECT CAST(0 AS BIT) as UserExists;
END
GO

-- Stored procedure to check if email exists
CREATE OR ALTER PROCEDURE sp_CheckUserExistsByEmail
    @Email NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    
    IF EXISTS (SELECT 1 FROM Users WHERE Email = @Email)
        SELECT CAST(1 AS BIT) as UserExists;
    ELSE
        SELECT CAST(0 AS BIT) as UserExists;
END
GO

-- Create Stocks table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Stocks' AND xtype='U')
BEGIN
    CREATE TABLE Stocks (
        StockId INT IDENTITY(1,1) PRIMARY KEY,
        Symbol NVARCHAR(10) NOT NULL UNIQUE,
        CompanyName NVARCHAR(255) NOT NULL
    );
END
GO

-- Create BuyOrders table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='BuyOrders' AND xtype='U')
BEGIN
    CREATE TABLE BuyOrders (
        BuyOrderId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        StockId INT NOT NULL,
        Quantity DECIMAL(18,8) NOT NULL,
        PricePerUnit DECIMAL(18,2) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        Status NVARCHAR(20) DEFAULT 'OPEN',
        FOREIGN KEY (UserId) REFERENCES Users(Id),
        FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
    );
END
GO

-- Create SellOrders table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='SellOrders' AND xtype='U')
BEGIN
    CREATE TABLE SellOrders (
        SellOrderId INT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        StockId INT NOT NULL,
        Quantity DECIMAL(18,8) NOT NULL,
        PricePerUnit DECIMAL(18,2) NOT NULL,
        CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
        Status NVARCHAR(20) DEFAULT 'OPEN',
        FOREIGN KEY (UserId) REFERENCES Users(Id),
        FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
    );
END
GO

-- Create Holdings table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Holdings' AND xtype='U')
BEGIN
    CREATE TABLE Holdings (
        UserId INT NOT NULL,
        StockId INT NOT NULL,
        QuantityOwned DECIMAL(18,8) NOT NULL DEFAULT 0,
        PRIMARY KEY (UserId, StockId),
        FOREIGN KEY (UserId) REFERENCES Users(Id),
        FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
    );
END
GO

-- Create Transactions table
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Transactions' AND xtype='U')
BEGIN
    CREATE TABLE Transactions (
        TransactionId INT IDENTITY(1,1) PRIMARY KEY,
        BuyerUserId INT NOT NULL,
        StockId INT NOT NULL,
        Quantity DECIMAL(18,8) NOT NULL,
        PricePerUnit DECIMAL(18,2) NOT NULL,
        Timestamp DATETIME2 DEFAULT GETUTCDATE(),
        FOREIGN KEY (BuyerUserId) REFERENCES Users(Id),
        FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
    );
END
GO

-- Stored procedures for trading operations

-- Get stock by symbol
CREATE OR ALTER PROCEDURE sp_GetStockBySymbol
    @Symbol NVARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON;
    SELECT StockId, Symbol, CompanyName FROM Stocks WHERE Symbol = @Symbol;
END
GO

-- Create buy order
CREATE OR ALTER PROCEDURE sp_CreateBuyOrder
    @UserId INT,
    @StockId INT,
    @Quantity DECIMAL(18,8),
    @PricePerUnit DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO BuyOrders (UserId, StockId, Quantity, PricePerUnit)
    VALUES (@UserId, @StockId, @Quantity, @PricePerUnit);
    
    SELECT SCOPE_IDENTITY() as NewOrderId;
END
GO

-- Create sell order
CREATE OR ALTER PROCEDURE sp_CreateSellOrder
    @UserId INT,
    @StockId INT,
    @Quantity DECIMAL(18,8),
    @PricePerUnit DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Check if user has enough holdings
    DECLARE @CurrentHoldings DECIMAL(18,8) = 0;
    SELECT @CurrentHoldings = ISNULL(QuantityOwned, 0) 
    FROM Holdings 
    WHERE UserId = @UserId AND StockId = @StockId;
    
    IF @CurrentHoldings >= @Quantity
    BEGIN
        INSERT INTO SellOrders (UserId, StockId, Quantity, PricePerUnit)
        VALUES (@UserId, @StockId, @Quantity, @PricePerUnit);
        
        SELECT SCOPE_IDENTITY() as NewOrderId;
    END
    ELSE
    BEGIN
        SELECT -1 as NewOrderId; -- Insufficient holdings
    END
END
GO

-- Get user orders
CREATE OR ALTER PROCEDURE sp_GetUserOrders
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 'Buy' as OrderType, BuyOrderId as OrderId, StockId, Quantity, PricePerUnit, CreatedAt, Status
    FROM BuyOrders 
    WHERE UserId = @UserId AND Status = 'OPEN'
    
    UNION ALL
    
    SELECT 'Sell' as OrderType, SellOrderId as OrderId, StockId, Quantity, PricePerUnit, CreatedAt, Status
    FROM SellOrders 
    WHERE UserId = @UserId AND Status = 'OPEN'
    
    ORDER BY CreatedAt DESC;
END
GO

-- Get user holdings with average price calculation
CREATE OR ALTER PROCEDURE sp_GetUserHoldings
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        h.StockId,
        s.Symbol, 
        s.CompanyName, 
        h.QuantityOwned,
        COALESCE(
            (SELECT SUM(t.Quantity * t.PricePerUnit) / SUM(t.Quantity)
             FROM Transactions t 
             WHERE t.BuyerUserId = @UserId 
             AND t.StockId = h.StockId), 
            0
        ) as AveragePrice
    FROM Holdings h
    INNER JOIN Stocks s ON h.StockId = s.StockId
    WHERE h.UserId = @UserId AND h.QuantityOwned > 0;
END
GO

-- Get user transactions
CREATE OR ALTER PROCEDURE sp_GetUserTransactions
    @UserId INT,
    @PageSize INT = 50,
    @PageNumber INT = 1
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT t.TransactionId, t.BuyerUserId, 
           s.Symbol, s.CompanyName, t.Quantity, t.PricePerUnit, t.Timestamp,
           CASE 
               WHEN t.Quantity > 0 THEN 'Buy'
               ELSE 'Sell'
           END as TransactionType
    FROM Transactions t
    INNER JOIN Stocks s ON t.StockId = s.StockId
    WHERE t.BuyerUserId = @UserId
    ORDER BY t.Timestamp DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO

-- Execute transaction (match orders)
CREATE OR ALTER PROCEDURE sp_ExecuteTransaction
    @BuyerUserId INT,
    @StockId INT,
    @Quantity DECIMAL(18,8),
    @PricePerUnit DECIMAL(18,2),
    @BuyOrderId INT = NULL,
    @SellOrderId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    
    BEGIN TRY
        -- Create transaction record
        INSERT INTO Transactions (BuyerUserId, StockId, Quantity, PricePerUnit)
        VALUES (@BuyerUserId, @StockId, @Quantity, @PricePerUnit);
        
        -- Update buyer holdings (positive quantity = buy, negative = sell)
        IF EXISTS (SELECT 1 FROM Holdings WHERE UserId = @BuyerUserId AND StockId = @StockId)
        BEGIN
            UPDATE Holdings 
            SET QuantityOwned = QuantityOwned + @Quantity
            WHERE UserId = @BuyerUserId AND StockId = @StockId;
        END
        ELSE
        BEGIN
            INSERT INTO Holdings (UserId, StockId, QuantityOwned)
            VALUES (@BuyerUserId, @StockId, @Quantity);
        END
        
        -- Update/Complete orders
        IF @BuyOrderId IS NOT NULL
        BEGIN
            UPDATE BuyOrders SET Status = 'Completed' WHERE BuyOrderId = @BuyOrderId;
        END
        
        IF @SellOrderId IS NOT NULL
        BEGIN
            UPDATE SellOrders SET Status = 'Completed' WHERE SellOrderId = @SellOrderId;
        END
        
        COMMIT TRANSACTION;
        SELECT SCOPE_IDENTITY() as TransactionId;
        
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        SELECT -1 as TransactionId;
    END CATCH
END
GO

-- Cancel order
CREATE OR ALTER PROCEDURE sp_CancelOrder
    @OrderId INT,
    @OrderType NVARCHAR(10), -- 'Buy' or 'Sell'
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @OrderType = 'Buy'
    BEGIN
        UPDATE BuyOrders 
        SET Status = 'CANCELLED' 
        WHERE BuyOrderId = @OrderId AND UserId = @UserId AND Status = 'OPEN';
        
        SELECT @@ROWCOUNT as RowsAffected;
    END
    ELSE IF @OrderType = 'Sell'
    BEGIN
        UPDATE SellOrders 
        SET Status = 'CANCELLED' 
        WHERE SellOrderId = @OrderId AND UserId = @UserId AND Status = 'OPEN';
        
        SELECT @@ROWCOUNT as RowsAffected;
    END
END
GO

-- Stored Procedure: Get User Balance
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'GetUserBalance')
DROP PROCEDURE GetUserBalance
GO

CREATE PROCEDURE GetUserBalance
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT Balance 
    FROM Wallets 
    WHERE UserId = @UserId
END
GO

-- Stored Procedure: Update User Balance
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'UpdateUserBalance')
DROP PROCEDURE UpdateUserBalance
GO

CREATE PROCEDURE UpdateUserBalance
    @UserId INT,
    @Amount DECIMAL(18,2),
    @IsDebit BIT = 0 -- 0 for credit (add), 1 for debit (subtract)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Ensure wallet exists for user
    IF NOT EXISTS (SELECT 1 FROM Wallets WHERE UserId = @UserId)
    BEGIN
        INSERT INTO Wallets (UserId, Balance) VALUES (@UserId, 0.00)
    END
    
    -- Update balance
    IF @IsDebit = 1
    BEGIN
        UPDATE Wallets 
        SET Balance = Balance - @Amount
        WHERE UserId = @UserId
    END
    ELSE
    BEGIN
        UPDATE Wallets 
        SET Balance = Balance + @Amount
        WHERE UserId = @UserId
    END
    
    -- Return updated balance
    SELECT Balance FROM Wallets WHERE UserId = @UserId
END
GO

-- Stored Procedure: Check Sufficient Balance
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'CheckSufficientBalance')
DROP PROCEDURE CheckSufficientBalance
GO

CREATE PROCEDURE CheckSufficientBalance
    @UserId INT,
    @RequiredAmount DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @CurrentBalance DECIMAL(18,2) = 0.00
    
    -- Get current balance
    SELECT @CurrentBalance = ISNULL(Balance, 0.00) 
    FROM Wallets 
    WHERE UserId = @UserId
    
    -- Return 1 if sufficient, 0 if not
    IF @CurrentBalance >= @RequiredAmount
        SELECT 1 AS HasSufficientBalance, @CurrentBalance AS CurrentBalance
    ELSE
        SELECT 0 AS HasSufficientBalance, @CurrentBalance AS CurrentBalance
END
GO

-- Initialize default wallet balances for existing users
INSERT INTO Wallets (UserId, Balance)
SELECT Id, 10000.00 
FROM Users 
WHERE Id NOT IN (SELECT UserId FROM Wallets);
GO
