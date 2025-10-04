using dotnetproject.Models;
using dotnetproject.Repositories;
using dotnetproject.SqlConnection;
using Microsoft.Data.SqlClient;
using System.Data;

namespace dotnetproject.Repositories
{
    public class TradingRepository : ITradingRepository
    {
        private readonly ISqlConnectionService _sqlConnectionService;

        public TradingRepository(ISqlConnectionService sqlConnectionService)
        {
            _sqlConnectionService = sqlConnectionService;
        }

        public async Task<Stock?> GetStockBySymbolAsync(string symbol)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_GetStockBySymbol", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@Symbol", symbol);
            
            using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new Stock
                {
                    StockId = reader.GetInt32("StockId"),
                    Symbol = reader.GetString("Symbol"),
                    CompanyName = reader.GetString("CompanyName")
                };
            }
            return null;
        }

        public async Task<int> CreateBuyOrderAsync(int userId, int stockId, decimal quantity, decimal pricePerUnit)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_CreateBuyOrder", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            command.Parameters.AddWithValue("@StockId", stockId);
            command.Parameters.AddWithValue("@Quantity", quantity);
            command.Parameters.AddWithValue("@PricePerUnit", pricePerUnit);
            
            var result = await command.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        public async Task<int> CreateSellOrderAsync(int userId, int stockId, decimal quantity, decimal pricePerUnit)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_CreateSellOrder", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            command.Parameters.AddWithValue("@StockId", stockId);
            command.Parameters.AddWithValue("@Quantity", quantity);
            command.Parameters.AddWithValue("@PricePerUnit", pricePerUnit);
            
            var result = await command.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        public async Task<List<OrderResponse>> GetUserOrdersAsync(int userId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_GetUserOrders", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            
            var orders = new List<OrderResponse>();
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                orders.Add(new OrderResponse
                {
                    OrderId = reader.GetInt32("OrderId"),
                    OrderType = reader.GetString("OrderType"),
                    Quantity = reader.GetDecimal("Quantity"),
                    PricePerUnit = reader.GetDecimal("PricePerUnit"),
                    CreatedAt = reader.GetDateTime("CreatedAt"),
                    Status = reader.GetString("Status")
                });
            }
            return orders;
        }

        public async Task<bool> CancelOrderAsync(int orderId, string orderType, int userId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_CancelOrder", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@OrderId", orderId);
            command.Parameters.AddWithValue("@OrderType", orderType);
            command.Parameters.AddWithValue("@UserId", userId);
            
            using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return reader.GetInt32("RowsAffected") > 0;
            }
            return false;
        }

        public async Task<List<HoldingResponse>> GetUserHoldingsAsync(int userId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_GetUserHoldings", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            
            var holdings = new List<HoldingResponse>();
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                holdings.Add(new HoldingResponse
                {
                    Symbol = reader.GetString("Symbol"),
                    CompanyName = reader.GetString("CompanyName"),
                    QuantityOwned = reader.GetDecimal("QuantityOwned"),
                    AveragePrice = reader.GetDecimal("AveragePrice"),
                    CurrentPrice = 0 // Will be populated by service layer with real-time price
                });
            }
            return holdings;
        }

        public async Task<decimal> GetUserHoldingQuantityAsync(int userId, int stockId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("SELECT ISNULL(QuantityOwned, 0) FROM Holdings WHERE UserId = @UserId AND StockId = @StockId", connection);
            
            command.Parameters.AddWithValue("@UserId", userId);
            command.Parameters.AddWithValue("@StockId", stockId);
            
            var result = await command.ExecuteScalarAsync();
            return result == null ? 0 : Convert.ToDecimal(result);
        }

        public async Task<int> ExecuteTransactionAsync(int buyerUserId, int stockId, decimal quantity, decimal pricePerUnit, int? buyOrderId = null, int? sellOrderId = null)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_ExecuteTransaction", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@BuyerUserId", buyerUserId);
            command.Parameters.AddWithValue("@StockId", stockId);
            command.Parameters.AddWithValue("@Quantity", quantity);
            command.Parameters.AddWithValue("@PricePerUnit", pricePerUnit);
            command.Parameters.AddWithValue("@BuyOrderId", buyOrderId.HasValue ? (object)buyOrderId.Value : DBNull.Value);
            command.Parameters.AddWithValue("@SellOrderId", sellOrderId.HasValue ? (object)sellOrderId.Value : DBNull.Value);
            
            var result = await command.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        public async Task<List<TransactionResponse>> GetUserTransactionsAsync(int userId, int pageSize = 50, int pageNumber = 1)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("sp_GetUserTransactions", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            command.Parameters.AddWithValue("@PageSize", pageSize);
            command.Parameters.AddWithValue("@PageNumber", pageNumber);
            
            var transactions = new List<TransactionResponse>();
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                transactions.Add(new TransactionResponse
                {
                    TransactionId = reader.GetInt32("TransactionId"),
                    TransactionType = reader.GetString("TransactionType"),
                    Symbol = reader.GetString("Symbol"),
                    CompanyName = reader.GetString("CompanyName"),
                    Quantity = reader.GetDecimal("Quantity"),
                    PricePerUnit = reader.GetDecimal("PricePerUnit"),
                    Timestamp = reader.GetDateTime("Timestamp")
                });
            }
            return transactions;
        }

        public async Task<decimal> GetUserBalanceAsync(int userId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("GetUserBalance", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            
            var result = await command.ExecuteScalarAsync();
            return result != null && result != DBNull.Value ? Convert.ToDecimal(result) : 0.00m;
        }
        
        public async Task<decimal> UpdateUserBalanceAsync(int userId, decimal amount, bool isDebit = false)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("UpdateUserBalance", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            command.Parameters.AddWithValue("@Amount", amount);
            command.Parameters.AddWithValue("@IsDebit", isDebit);
            
            var result = await command.ExecuteScalarAsync();
            return result != null && result != DBNull.Value ? Convert.ToDecimal(result) : 0.00m;
        }
        
        public async Task<bool> CheckSufficientBalanceAsync(int userId, decimal requiredAmount)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("CheckSufficientBalance", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@UserId", userId);
            command.Parameters.AddWithValue("@RequiredAmount", requiredAmount);
            
            using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return reader.GetInt32("HasSufficientBalance") == 1;
            }
            return false;
        }

        // New methods for order processing
        public async Task<Stock?> GetStockByIdAsync(int stockId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("SELECT StockId, Symbol, CompanyName FROM Stocks WHERE StockId = @StockId", connection);
            command.Parameters.AddWithValue("@StockId", stockId);
            
            using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new Stock
                {
                    StockId = reader.GetInt32("StockId"),
                    Symbol = reader.GetString("Symbol"),
                    CompanyName = reader.GetString("CompanyName")
                };
            }
            return null;
        }

        public async Task<List<BuyOrder>> GetActiveBuyOrdersAsync()
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("SELECT * FROM BuyOrders WHERE Status IN ('Active', 'OPEN') ORDER BY CreatedAt", connection);
            
            var orders = new List<BuyOrder>();
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                orders.Add(new BuyOrder
                {
                    BuyOrderId = Convert.ToInt32(reader["BuyOrderId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    StockId = Convert.ToInt32(reader["StockId"]),
                    Quantity = Convert.ToDecimal(reader["Quantity"]),
                    PricePerUnit = Convert.ToDecimal(reader["PricePerUnit"]),
                    CreatedAt = reader.GetDateTime("CreatedAt"),
                    Status = reader.GetString("Status")
                });
            }
            
            return orders;
        }

        public async Task<List<SellOrder>> GetActiveSellOrdersAsync()
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("SELECT * FROM SellOrders WHERE Status IN ('Active', 'OPEN') ORDER BY CreatedAt", connection);
            
            var orders = new List<SellOrder>();
            using var reader = await command.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                orders.Add(new SellOrder
                {
                    SellOrderId = Convert.ToInt32(reader["SellOrderId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    StockId = Convert.ToInt32(reader["StockId"]),
                    Quantity = Convert.ToDecimal(reader["Quantity"]),
                    PricePerUnit = Convert.ToDecimal(reader["PricePerUnit"]),
                    CreatedAt = reader.GetDateTime("CreatedAt"),
                    Status = reader.GetString("Status")
                });
            }
            return orders;
        }

        public async Task<BuyOrder?> GetBuyOrderByIdAsync(int orderId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("SELECT * FROM BuyOrders WHERE BuyOrderId = @OrderId", connection);
            command.Parameters.AddWithValue("@OrderId", orderId);
            
            using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new BuyOrder
                {
                    BuyOrderId = Convert.ToInt32(reader["BuyOrderId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    StockId = Convert.ToInt32(reader["StockId"]),
                    Quantity = Convert.ToDecimal(reader["Quantity"]),
                    PricePerUnit = Convert.ToDecimal(reader["PricePerUnit"]),
                    CreatedAt = reader.GetDateTime("CreatedAt"),
                    Status = reader.GetString("Status")
                };
            }
            return null;
        }

        public async Task<SellOrder?> GetSellOrderByIdAsync(int orderId)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand("SELECT * FROM SellOrders WHERE SellOrderId = @OrderId", connection);
            command.Parameters.AddWithValue("@OrderId", orderId);
            
            using var reader = await command.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                return new SellOrder
                {
                    SellOrderId = Convert.ToInt32(reader["SellOrderId"]),
                    UserId = Convert.ToInt32(reader["UserId"]),
                    StockId = Convert.ToInt32(reader["StockId"]),
                    Quantity = Convert.ToDecimal(reader["Quantity"]),
                    PricePerUnit = Convert.ToDecimal(reader["PricePerUnit"]),
                    CreatedAt = reader.GetDateTime("CreatedAt"),
                    Status = reader.GetString("Status")
                };
            }
            return null;
        }

        public async Task UpdateOrderStatusAsync(string orderType, int orderId, string status)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            string tableName = orderType.Equals("Buy", StringComparison.OrdinalIgnoreCase) ? "BuyOrders" : "SellOrders";
            string idColumn = orderType.Equals("Buy", StringComparison.OrdinalIgnoreCase) ? "BuyOrderId" : "SellOrderId";
            
            using var command = new SqlCommand($"UPDATE {tableName} SET Status = @Status WHERE {idColumn} = @OrderId", connection);
            command.Parameters.AddWithValue("@Status", status);
            command.Parameters.AddWithValue("@OrderId", orderId);
            
            await command.ExecuteNonQueryAsync();
        }

        public async Task UpdateHoldingsAsync(int userId, int stockId, decimal quantityChange)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            
            // Check if holding exists
            using var checkCommand = new SqlCommand("SELECT QuantityOwned FROM Holdings WHERE UserId = @UserId AND StockId = @StockId", connection);
            checkCommand.Parameters.AddWithValue("@UserId", userId);
            checkCommand.Parameters.AddWithValue("@StockId", stockId);
            
            var existingQuantity = await checkCommand.ExecuteScalarAsync();
            
            if (existingQuantity == null)
            {
                // Create new holding (for buy orders)
                if (quantityChange > 0)
                {
                    using var insertCommand = new SqlCommand("INSERT INTO Holdings (UserId, StockId, QuantityOwned) VALUES (@UserId, @StockId, @Quantity)", connection);
                    insertCommand.Parameters.AddWithValue("@UserId", userId);
                    insertCommand.Parameters.AddWithValue("@StockId", stockId);
                    insertCommand.Parameters.AddWithValue("@Quantity", quantityChange);
                    await insertCommand.ExecuteNonQueryAsync();
                }
            }
            else
            {
                // Update existing holding
                var newQuantity = Convert.ToDecimal(existingQuantity) + quantityChange;
                
                if (newQuantity <= 0)
                {
                    // Remove holding if quantity is 0 or negative
                    using var deleteCommand = new SqlCommand("DELETE FROM Holdings WHERE UserId = @UserId AND StockId = @StockId", connection);
                    deleteCommand.Parameters.AddWithValue("@UserId", userId);
                    deleteCommand.Parameters.AddWithValue("@StockId", stockId);
                    await deleteCommand.ExecuteNonQueryAsync();
                }
                else
                {
                    // Update quantity
                    using var updateCommand = new SqlCommand("UPDATE Holdings SET QuantityOwned = @NewQuantity WHERE UserId = @UserId AND StockId = @StockId", connection);
                    updateCommand.Parameters.AddWithValue("@NewQuantity", newQuantity);
                    updateCommand.Parameters.AddWithValue("@UserId", userId);
                    updateCommand.Parameters.AddWithValue("@StockId", stockId);
                    await updateCommand.ExecuteNonQueryAsync();
                }
            }
        }

        public async Task<int> CreateTransactionAsync(int buyerUserId, int stockId, decimal quantity, decimal pricePerUnit)
        {
            using var connection = await _sqlConnectionService.CreateConnectionAsync();
            using var command = new SqlCommand(@"
                INSERT INTO Transactions (BuyerUserId, StockId, Quantity, PricePerUnit, Timestamp) 
                VALUES (@BuyerUserId, @StockId, @Quantity, @PricePerUnit, @Timestamp);
                SELECT SCOPE_IDENTITY();", connection);
            
            command.Parameters.AddWithValue("@BuyerUserId", buyerUserId);
            command.Parameters.AddWithValue("@StockId", stockId);
            command.Parameters.AddWithValue("@Quantity", quantity);
            command.Parameters.AddWithValue("@PricePerUnit", pricePerUnit);
            command.Parameters.AddWithValue("@Timestamp", DateTime.UtcNow);
            
            var result = await command.ExecuteScalarAsync();
            return Convert.ToInt32(result);
        }

        public async Task<List<TransactionResponse>> GetUserActivityAsync(int userId, int pageSize = 50, int pageNumber = 1)
        {
            var allActivity = new List<TransactionResponse>();
            
            using (var connection = await _sqlConnectionService.CreateConnectionAsync())
            {
                using var transactionCommand = new SqlCommand(@"
                    SELECT 
                        t.TransactionId,
                        'Completed' as Status,
                        CASE WHEN t.Quantity < 0 THEN 'Sell' ELSE 'Buy' END as TransactionType,
                        s.Symbol,
                        s.CompanyName,
                        ABS(t.Quantity) as Quantity,
                        t.PricePerUnit,
                        t.Timestamp
                    FROM Transactions t
                    INNER JOIN Stocks s ON t.StockId = s.StockId
                    WHERE t.BuyerUserId = @UserId
                    ORDER BY t.Timestamp DESC", connection);
                
                transactionCommand.Parameters.AddWithValue("@UserId", userId);
                
                using var transactionReader = await transactionCommand.ExecuteReaderAsync();
                while (await transactionReader.ReadAsync())
                {
                    allActivity.Add(new TransactionResponse
                    {
                        TransactionId = transactionReader.GetInt32("TransactionId"),
                        TransactionType = transactionReader.GetString("TransactionType"),
                        Symbol = transactionReader.GetString("Symbol"),
                        CompanyName = transactionReader.GetString("CompanyName"),
                        Quantity = transactionReader.GetDecimal("Quantity"),
                        PricePerUnit = transactionReader.GetDecimal("PricePerUnit"),
                        Timestamp = transactionReader.GetDateTime("Timestamp"),
                        Status = transactionReader.GetString("Status")
                    });
                }
            }
            
            using (var connection = await _sqlConnectionService.CreateConnectionAsync())
            {
                using var buyOrderCommand = new SqlCommand(@"
                    SELECT 
                        b.BuyOrderId,
                        b.Status,
                        'Buy' as TransactionType,
                        s.Symbol,
                        s.CompanyName,
                        b.Quantity,
                        b.PricePerUnit,
                        b.CreatedAt
                    FROM BuyOrders b
                    INNER JOIN Stocks s ON b.StockId = s.StockId
                    WHERE b.UserId = @UserId AND b.Status IN ('OPEN', 'CANCELLED')
                    ORDER BY b.CreatedAt DESC", connection);
                
                buyOrderCommand.Parameters.AddWithValue("@UserId", userId);
                
                using var buyOrderReader = await buyOrderCommand.ExecuteReaderAsync();
                while (await buyOrderReader.ReadAsync())
                {
                    allActivity.Add(new TransactionResponse
                    {
                        TransactionId = buyOrderReader.GetInt32("BuyOrderId"), // Using order ID as transaction ID for UI
                        TransactionType = buyOrderReader.GetString("TransactionType"),
                        Symbol = buyOrderReader.GetString("Symbol"),
                        CompanyName = buyOrderReader.GetString("CompanyName"),
                        Quantity = buyOrderReader.GetDecimal("Quantity"),
                        PricePerUnit = buyOrderReader.GetDecimal("PricePerUnit"),
                        Timestamp = buyOrderReader.GetDateTime("CreatedAt"),
                        Status = buyOrderReader.GetString("Status") == "OPEN" ? "Pending" : "Cancelled"
                    });
                }
            }
            
            using (var connection = await _sqlConnectionService.CreateConnectionAsync())
            {
                using var sellOrderCommand = new SqlCommand(@"
                    SELECT 
                        s.SellOrderId,
                        s.Status,
                        'Sell' as TransactionType,
                        st.Symbol,
                        st.CompanyName,
                        s.Quantity,
                        s.PricePerUnit,
                        s.CreatedAt
                    FROM SellOrders s
                    INNER JOIN Stocks st ON s.StockId = st.StockId
                    WHERE s.UserId = @UserId AND s.Status IN ('OPEN', 'CANCELLED')
                    ORDER BY s.CreatedAt DESC", connection);
                
                sellOrderCommand.Parameters.AddWithValue("@UserId", userId);
                
                using var sellOrderReader = await sellOrderCommand.ExecuteReaderAsync();
                while (await sellOrderReader.ReadAsync())
                {
                    allActivity.Add(new TransactionResponse
                    {
                        TransactionId = sellOrderReader.GetInt32("SellOrderId"), // Using order ID as transaction ID for UI
                        TransactionType = sellOrderReader.GetString("TransactionType"),
                        Symbol = sellOrderReader.GetString("Symbol"),
                        CompanyName = sellOrderReader.GetString("CompanyName"),
                        Quantity = sellOrderReader.GetDecimal("Quantity"),
                        PricePerUnit = sellOrderReader.GetDecimal("PricePerUnit"),
                        Timestamp = sellOrderReader.GetDateTime("CreatedAt"),
                        Status = sellOrderReader.GetString("Status") == "OPEN" ? "Pending" : "Cancelled"
                    });
                }
            }
            
            // Sort all activity by timestamp descending and apply pagination
            var sortedActivity = allActivity
                .OrderByDescending(a => a.Timestamp)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToList();
            
            return sortedActivity;
        }
    }
}