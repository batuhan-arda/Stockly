# 📈 Stockly Trading Platform

A full-stack real-time stock trading application built with ASP.NET Core 8.0 and Angular 19. Features live stock price updates, portfolio management, and automated async order processing with price cachcing.

### Dashboard Interface
![Dashboard](./photos/Ekran%20görüntüsü%202025-10-04%20185953.png)

## 🏗️ Architecture

### Backend Stack
- **Framework**: ASP.NET Core 8.0
- **Language**: C# 12
- **Database**: SQL Server
- **Real-time Communication**: SignalR
- **Authentication**: JWT with BCrypt password hashing
- **Architecture Pattern**: Repository pattern with service layer

### Frontend Stack
- **Framework**: Angular 19.2.0
- **Language**: TypeScript 5.7.2
- **UI Components**: Standalone components
- **Charts**: Chart.js 4.5.0
- **Real-time**: SignalR client (@microsoft/signalr 9.0.6)
- **State Management**: RxJS 7.8.0

## 🚀 Getting Started

### Prerequisites

- .NET 8.0 SDK
- Node.js 18+ and npm
- SQL Server
- Visual Studio 2022 or VS Code

The application will be available at `https://localhost:5117`

### Portfolio Interface
![Portfolio](./photos/Ekran%20görüntüsü%202025-10-04%20190102.png)

## 📁 Project Structure

```
dotnetproject/
├── clientapp/                          # Angular Frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/            # UI Components
│   │   │   │   ├── login.component.ts
│   │   │   │   ├── register.component.ts
│   │   │   │   ├── dashboard.component.ts
│   │   │   │   ├── portfolio.component.ts
│   │   │   │   ├── transactions.component.ts
│   │   │   │   └── wallet.component.ts
│   │   │   ├── services/              # Business Logic
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── stock.service.ts
│   │   │   │   ├── portfolio.service.ts
│   │   │   │   ├── transactions.service.ts
│   │   │   │   └── wallet.service.ts
│   │   │   ├── guards/                # Route Protection
│   │   │   │   └── auth.guard.ts
│   │   │   ├── models/                # TypeScript Interfaces
│   │   │   │   └── auth.models.ts
│   │   │   └── app.routes.ts          # Routing Configuration
│   │   └── index.html
│   └── package.json
│
├── dotnetproject/                      # ASP.NET Core Backend
│   ├── Controllers/                    # API Endpoints
│   │   ├── AuthController.cs
│   │   ├── StocksController.cs
│   │   ├── TradingController.cs
│   │   ├── PortfolioController.cs
│   │   ├── TransactionsController.cs
│   │   └── WalletController.cs
│   ├── Services/                       # Business Logic
│   │   ├── JWTService.cs
│   │   ├── TradingService.cs
│   │   ├── OrderProcessingService.cs
│   │   ├── StockPriceService.cs
│   │   ├── PriceCacheService.cs
│   │   └── RateLimitService.cs
│   ├── Repositories/                   # Data Access Layer
│   │   ├── ITradingRepository.cs
│   │   └── TradingRepository.cs
│   ├── Models/                         # Data Models
│   │   ├── Users.cs
│   │   ├── StockInfo.cs
│   │   ├── TradingModels.cs
│   │   ├── Wallet.cs
│   │   └── WalletModels.cs
│   ├── Hubs/                          # SignalR Hubs
│   │   └── StockHub.cs
│   ├── Sql Connection/                # Database
│   │   ├── SqlDataAccess.cs
│   │   └── DatabaseSetup.sql
│   ├── Program.cs                     # Application Entry Point
│   └── appsettings.json              # Configuration
│
└── build-angular.bat                  # Build Script
```

### Login Page Overview
![Login](./photos/Ekran%20görüntüsü%202025-10-04%20185905.png)

### 🔐 Authentication Flow

1. **Registration**
   - User submits username, email, and password
   - Password is hashed using BCrypt (cost factor: 12)
   - User record created in database with initial $10,000 wallet balance
   - JWT token generated and returned

2. **Login**
   - User submits email and password
   - Password verified against BCrypt hash
   - JWT token generated with 7-day expiration
   - Token stored in localStorage and used for subsequent requests

3. **Authorization**
   - `AuthInterceptor` automatically attaches JWT token to all HTTP requests
   - Backend validates token on protected endpoints
   - `AuthGuard` protects frontend routes from unauthorized access

### Transaction History
![Transaction](./photos/Ekran%20görüntüsü%202025-10-04%20190116.png)

### 📊 Stock Price System

#### Real-time Price Updates
```
StockPriceService (Background Service)
    ↓ Every 5 seconds
Generates random price fluctuations
    ↓
Updates PriceCacheService
    ↓
Broadcasts via SignalR Hub
    ↓
Angular components receive updates
    ↓
UI refreshes automatically
```

#### Price Caching
- **In-Memory Cache**: `PriceCacheService` stores current prices
- **Fast Lookups**: O(1) access time using ConcurrentDictionary
- **Automatic Updates**: Background service refreshes every 5 seconds
- **Thread-Safe**: Concurrent access from multiple requests

#### How Price Caching Works

```csharp
// PriceCacheService.cs
public class PriceCacheService
{
    private readonly ConcurrentDictionary<string, decimal> _priceCache;
    
    // Store price in cache
    public void UpdatePrice(string symbol, decimal price)
    {
        _priceCache.AddOrUpdate(symbol, price, (key, oldValue) => price);
    }
    
    // Retrieve price from cache (O(1) operation)
    public decimal GetPrice(string symbol)
    {
        return _priceCache.TryGetValue(symbol, out var price) ? price : 0;
    }
    
    // Get all cached prices
    public Dictionary<string, decimal> GetAllPrices()
    {
        return _priceCache.ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
    }
}
```

**Benefits:**
- **Performance**: No database queries for price lookups during trading operations
- **Consistency**: All services use the same price data
- **Real-time**: Prices updated every 5 seconds by background service
- **Scalability**: Handles thousands of concurrent requests efficiently

### Dashboard with Indicators
![Trading](./photos/Ekran%20görüntüsü%202025-10-04%20190013.png)

### 💰 Trading System

#### Order Placement Flow

1. **User Initiates Trade**
   - Selects stock symbol
   - Enters quantity and price
   - Submits buy/sell order

2. **Validation** (TradingService)
   - Check user has sufficient funds (buy) or shares (sell)
   - Validate price is within 5% of current market price
   - Verify quantity > 0

3. **Order Creation**
   - Order stored in database with "Pending" status
   - User's balance reserved/locked for buy orders
   - Transaction logged

4. **Background Processing**
   - `OrderProcessingService` runs every 30 seconds
   - Fetches all pending orders
   - Executes orders at current market price
   - Updates user holdings and balances
   - Changes order status to "Filled"

#### Buy Order Process

When a user places a **buy order**, the following steps occur:

```csharp
// 1. Validate user has sufficient balance
var userBalance = await repository.GetUserBalanceAsync(userId);
var totalCost = quantity * pricePerUnit;
if (userBalance < totalCost)
    throw new InvalidOperationException("Insufficient funds");

// 2. Get current market price from cache
var currentPrice = priceCacheService.GetPrice(symbol);

// 3. Validate order price is within 5% of market price
var priceDifference = Math.Abs(pricePerUnit - currentPrice) / currentPrice;
if (priceDifference > 0.05)
    throw new InvalidOperationException("Price too far from market price");

// 4. Create buy order in database
var order = new BuyOrder
{
    UserId = userId,
    StockId = stockId,
    Quantity = quantity,
    PricePerUnit = pricePerUnit,
    Status = "OPEN",
    CreatedAt = DateTime.UtcNow
};
await repository.CreateBuyOrderAsync(order);

// 5. Reserve funds (deduct from available balance)
await repository.UpdateUserBalanceAsync(userId, userBalance - totalCost);

// 6. Order will be executed by OrderProcessingService within 30 seconds
```

**Buy Order Execution (Background Service):**
```csharp
// OrderProcessingService executes the order
var currentPrice = priceCache.GetPrice(order.Symbol);

// 1. Create or update holding
var holding = await repository.GetHoldingAsync(order.UserId, order.StockId);
if (holding == null)
{
    // First time buying this stock
    holding = new Holding
    {
        UserId = order.UserId,
        StockId = order.StockId,
        QuantityOwned = order.Quantity
    };
    await repository.CreateHoldingAsync(holding);
}
else
{
    // Add to existing holding
    holding.QuantityOwned += order.Quantity;
    await repository.UpdateHoldingAsync(holding);
}

// 2. Create transaction record
await repository.CreateTransactionAsync(new Transaction
{
    BuyerUserId = order.UserId,
    StockId = order.StockId,
    Quantity = order.Quantity,
    PricePerUnit = currentPrice,
    Timestamp = DateTime.UtcNow
});

// 3. Mark order as filled
order.Status = "FILLED";
await repository.UpdateBuyOrderAsync(order);
```

#### Sell Order Process

When a user places a **sell order**, the following steps occur:

```csharp
// 1. Validate user owns enough shares
var holding = await repository.GetHoldingAsync(userId, stockId);
if (holding == null || holding.QuantityOwned < quantity)
    throw new InvalidOperationException("Insufficient shares to sell");

// 2. Get current market price from cache
var currentPrice = priceCacheService.GetPrice(symbol);

// 3. Validate order price is within 5% of market price
var priceDifference = Math.Abs(pricePerUnit - currentPrice) / currentPrice;
if (priceDifference > 0.05)
    throw new InvalidOperationException("Price too far from market price");

// 4. Create sell order in database
var order = new SellOrder
{
    UserId = userId,
    StockId = stockId,
    Quantity = quantity,
    PricePerUnit = pricePerUnit,
    Status = "OPEN",
    CreatedAt = DateTime.UtcNow
};
await repository.CreateSellOrderAsync(order);

// 5. Reserve shares (mark them as pending sale)
// Shares remain in holding but are locked until order executes or cancels

// 6. Order will be executed by OrderProcessingService within 30 seconds
```

**Sell Order Execution (Background Service):**
```csharp
// OrderProcessingService executes the order
var currentPrice = priceCache.GetPrice(order.Symbol);
var proceeds = order.Quantity * currentPrice;

// 1. Reduce or remove holding
var holding = await repository.GetHoldingAsync(order.UserId, order.StockId);
holding.QuantityOwned -= order.Quantity;

if (holding.QuantityOwned <= 0)
{
    // Sold all shares - remove holding
    await repository.DeleteHoldingAsync(order.UserId, order.StockId);
}
else
{
    // Partial sale - update holding
    await repository.UpdateHoldingAsync(holding);
}

// 2. Add proceeds to user balance
var currentBalance = await repository.GetUserBalanceAsync(order.UserId);
await repository.UpdateUserBalanceAsync(order.UserId, currentBalance + proceeds);

// 3. Create transaction record
await repository.CreateTransactionAsync(new Transaction
{
    BuyerUserId = order.UserId,
    StockId = order.StockId,
    Quantity = -order.Quantity,  // Negative for sell
    PricePerUnit = currentPrice,
    Timestamp = DateTime.UtcNow
});

// 4. Mark order as filled
order.Status = "FILLED";
await repository.UpdateSellOrderAsync(order);
```

#### User Balance Updates

The system maintains user balance through multiple operations:

**1. Initial Balance**
```csharp
// On registration
user.Balance = 10000.00m;  // Starting balance
await repository.CreateUserAsync(user);

// Also creates wallet entry
await repository.CreateWalletAsync(new Wallet
{
    UserId = user.Id,
    Balance = 10000.00m
});
```

**2. Buy Order Impact**
```csharp
// When buy order is placed
var totalCost = quantity * pricePerUnit;
user.Balance -= totalCost;  // Funds reserved immediately
// Actual purchase happens when order is filled (within 30s)
```

**3. Sell Order Impact**
```csharp
// When sell order is filled
var proceeds = quantity * executionPrice;
user.Balance += proceeds;  // Funds added to balance
```

**4. Wallet Deposits**
```csharp
// User deposits funds
user.Balance += depositAmount;
await repository.UpdateUserBalanceAsync(userId, user.Balance);
```

**5. Wallet Withdrawals**
```csharp
// User withdraws funds (must have sufficient available balance)
if (user.Balance >= withdrawAmount)
{
    user.Balance -= withdrawAmount;
    await repository.UpdateUserBalanceAsync(userId, user.Balance);
}
```

#### Order Status Lifecycle

Orders go through the following status transitions:

```
OPEN → FILLED
  ↓
CANCELLED (if user cancels before execution)
```

**Status Meanings:**
- **OPEN**: Order placed, waiting for background service to execute
- **FILLED**: Order successfully executed, holdings/balance updated
- **CANCELLED**: Order cancelled by user before execution
- **Active**: Legacy status (treated as OPEN)

#### Real-time Updates

The system provides real-time updates to users through multiple channels:

**1. Stock Price Updates (via SignalR)**
```typescript
// Frontend receives updates every 5 seconds
this.hubConnection.on('ReceiveStockUpdate', (update) => {
    // Update displayed prices in real-time
    this.stockPrices[update.symbol] = update.price;
    this.updateCharts();
});
```

**2. Balance Updates (via BalanceStreamService)**
```typescript
// Frontend polls for balance updates
this.balanceService.getBalance().subscribe(balance => {
    this.currentBalance = balance;
});
```

**3. Order Execution Notifications**
```typescript
// After placing order, user sees pending status
// Background service executes within 30 seconds
// User can refresh to see updated holdings and balance
```

#### Order Processing Logic

```csharp
// OrderProcessingService.cs
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        // 1. Fetch pending orders
        var orders = await repository.GetPendingOrdersAsync();
        
        // 2. Process each order
        foreach (var order in orders)
        {
            var currentPrice = priceCache.GetPrice(order.Symbol);
            
            if (order.OrderType == "Buy")
            {
                // Execute buy: create/update holding
                await tradingService.ExecuteBuyOrderAsync(order, currentPrice);
            }
            else
            {
                // Execute sell: reduce holding
                await tradingService.ExecuteSellOrderAsync(order, currentPrice);
            }
        }
        
        // 3. Wait 30 seconds
        await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
    }
}
```

#### Holdings Calculation
- **Quantity Owned**: Sum of all buy orders - sum of all sell orders (per stock)
- **Average Buy Price**: Weighted average of purchase prices
- **Current Value**: Quantity × Current Market Price
- **Total Gain/Loss**: (Current Value - Total Cost) / Total Cost × 100%
- **Unrealized P&L**: Current Value - (Quantity × Average Buy Price)

#### Performance Metrics
```typescript
// Portfolio calculations
totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
totalGain = holdings.reduce((sum, h) => sum + h.unrealizedPL, 0);
totalGainPercent = (totalGain / totalCost) * 100;
bestPerformer = holdings.sort((a, b) => b.gainPercent - a.gainPercent)[0];
```

### 💳 Wallet System

![Wallet System](./photos/Ekran%20görüntüsü%202025-10-04%20190139.png)

#### Balance Management
- **Initial Balance**: $10,000 upon registration
- **Deposit**: Add funds to wallet (instant)
- **Withdraw**: Remove funds (requires sufficient balance)
- **Reserved Funds**: Buy orders lock funds until executed or cancelled
- **Available Balance**: Total Balance - Reserved Funds

#### Transaction Flow
```
User Request (Deposit/Withdraw)
    ↓
WalletController validates amount
    ↓
TradingService updates balance
    ↓
Database transaction committed
    ↓
Balance updated in UI via BalanceStreamService
```

### 📡 Real-time Communication (SignalR)

#### Connection Flow
```typescript
// Frontend: dashboard.component.ts
private connection = new signalR.HubConnectionBuilder()
    .withUrl('http://localhost:5117/stockHub')
    .withAutomaticReconnect()
    .build();

// Subscribe to price updates
this.connection.on('ReceiveStockUpdate', (data: StockUpdate) => {
    this.stockPriceSubject.next(data);
});
```

#### Backend Broadcasting
```csharp
// StockPriceService.cs
await hubContext.Clients.All.SendAsync(
    "ReceiveStockUpdate",
    new {
        symbol = stock.Symbol,
        price = newPrice,
        change = changePercent,
        timestamp = DateTime.UtcNow
    }
);
```

### 🔒 Security Features

#### Password Security
- **Hashing Algorithm**: BCrypt with cost factor 12
- **Salt**: Automatically generated per password
- **Verification**: Constant-time comparison to prevent timing attacks

#### JWT Token Structure
```json
{
  "sub": "user@example.com",
  "userId": "12345",
  "email": "user@example.com",
  "exp": 1735689600,
  "iss": "StockTradingAPI",
  "aud": "StockTradingClient"
}
```

#### API Rate Limiting
- **Default**: 100 requests per minute per IP
- **Authentication Endpoints**: 10 requests per minute per IP
- **Implementation**: In-memory tracking with sliding window
- **Response**: 429 Too Many Requests when exceeded

### 🗄️ Database Schema

#### Key Tables

**Users**
```sql
CREATE TABLE Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(50) NOT NULL UNIQUE,
    Email NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL
);
```

**Wallets**
```sql
CREATE TABLE Wallets (
    UserId INT PRIMARY KEY,
    Balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);
```

**Stocks**
```sql
CREATE TABLE Stocks (
    StockId INT IDENTITY(1,1) PRIMARY KEY,
    Symbol NVARCHAR(10) NOT NULL UNIQUE,
    CompanyName NVARCHAR(255) NOT NULL,
    Category NVARCHAR(255) NOT NULL
);
```

**BuyOrders**
```sql
CREATE TABLE BuyOrders (
    BuyOrderId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    StockId INT NOT NULL,
    Quantity DECIMAL(18,8) NOT NULL CHECK (Quantity > 0),
    PricePerUnit DECIMAL(18,8) NOT NULL CHECK (PricePerUnit > 0),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    Status NVARCHAR(20) NOT NULL DEFAULT 'OPEN' 
        CHECK (Status IN ('OPEN', 'FILLED', 'CANCELLED', 'Active')),
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
);
```

**SellOrders**
```sql
CREATE TABLE SellOrders (
    SellOrderId INT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NOT NULL,
    StockId INT NOT NULL,
    Quantity DECIMAL(18,8) NOT NULL CHECK (Quantity > 0),
    PricePerUnit DECIMAL(18,8) NOT NULL CHECK (PricePerUnit > 0),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    Status NVARCHAR(20) NOT NULL DEFAULT 'OPEN' 
        CHECK (Status IN ('OPEN', 'FILLED', 'CANCELLED', 'Active')),
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
);
```

**Holdings**
```sql
CREATE TABLE Holdings (
    UserId INT NOT NULL,
    StockId INT NOT NULL,
    QuantityOwned DECIMAL(18,8) NOT NULL CHECK (QuantityOwned > 0),
    PRIMARY KEY (UserId, StockId),  -- Composite Primary Key
    FOREIGN KEY (UserId) REFERENCES Users(Id),
    FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
);
```

**Transactions**
```sql
CREATE TABLE Transactions (
    TransactionId INT IDENTITY(1,1) PRIMARY KEY,
    BuyerUserId INT NOT NULL,
    StockId INT NOT NULL,
    Quantity DECIMAL(18,8) NOT NULL,
    PricePerUnit DECIMAL(18,8) NOT NULL CHECK (PricePerUnit > 0),
    Timestamp DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    FOREIGN KEY (BuyerUserId) REFERENCES Users(Id),
    FOREIGN KEY (StockId) REFERENCES Stocks(StockId)
);
```

## 🔄 Background Services

### OrderProcessingService
- **Frequency**: Every 30 seconds
- **Purpose**: Execute pending buy/sell orders
- **Process**:
  1. Fetch all pending orders
  2. Get current market prices
  3. Execute orders at current price
  4. Update holdings and balances
  5. Mark orders as filled

### StockPriceService
- **Frequency**: Every 5 seconds
- **Purpose**: Update stock prices and broadcast to clients
- **Process**:
  1. Generate price fluctuations (±2% random)
  2. Update price cache
  3. Broadcast via SignalR
  4. Store in database for history

## 🧪 API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - Login and receive JWT token

### Stocks
- `GET /api/stocks` - Get all available stocks
- `GET /api/stocks/{symbol}` - Get specific stock details
- `GET /api/stocks/{symbol}/history` - Get price history

### Trading
- `POST /api/trading/buy` - Place buy order
- `POST /api/trading/sell` - Place sell order
- `GET /api/trading/orders` - Get user's orders
- `DELETE /api/trading/orders/{id}` - Cancel pending order

### Portfolio
- `GET /api/portfolio/holdings` - Get user's holdings
- `GET /api/portfolio/summary` - Get portfolio summary
- `GET /api/portfolio/performance` - Get performance metrics

### Transactions
- `GET /api/transactions` - Get transaction history
- `GET /api/transactions/{id}` - Get specific transaction

### Wallet
- `GET /api/wallet/balance` - Get current balance
- `POST /api/wallet/deposit` - Deposit funds
- `POST /api/wallet/withdraw` - Withdraw funds
- `GET /api/wallet/transactions` - Get wallet transaction history

## 🛠️ Configuration

### Backend Configuration (appsettings.json)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=...;Database=...;"
  },
  "JwtSettings": {
    "SecretKey": "your-secret-key-min-32-chars",
    "Issuer": "StockTradingAPI",
    "Audience": "StockTradingClient",
    "ExpiryInDays": 7
  },
  "RateLimiting": {
    "RequestsPerMinute": 100,
    "AuthRequestsPerMinute": 10
  },
  "StockPriceService": {
    "UpdateIntervalSeconds": 5
  },
  "OrderProcessingService": {
    "ProcessIntervalSeconds": 30
  }
}
```

## 📝 License

This project is licensed under the MIT License.

---

**Note**: This is a demonstration project. Stock prices are taken from yahoofinance live for educational purposes. Do not use for actual trading decisions.
