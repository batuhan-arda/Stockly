using dotnetproject.Models;

namespace dotnetproject.Repositories
{
    public interface ITradingRepository
    {
        Task<Stock?> GetStockBySymbolAsync(string symbol);
        Task<Stock?> GetStockByIdAsync(int stockId);
        
        Task<int> CreateBuyOrderAsync(int userId, int stockId, decimal quantity, decimal pricePerUnit);
        Task<int> CreateSellOrderAsync(int userId, int stockId, decimal quantity, decimal pricePerUnit);
        Task<List<OrderResponse>> GetUserOrdersAsync(int userId);
        Task<bool> CancelOrderAsync(int orderId, string orderType, int userId);
        
        Task<List<BuyOrder>> GetActiveBuyOrdersAsync();
        Task<List<SellOrder>> GetActiveSellOrdersAsync();
        Task<BuyOrder?> GetBuyOrderByIdAsync(int orderId);
        Task<SellOrder?> GetSellOrderByIdAsync(int orderId);
        Task UpdateOrderStatusAsync(string orderType, int orderId, string status);
        
        Task<List<HoldingResponse>> GetUserHoldingsAsync(int userId);
        Task<decimal> GetUserHoldingQuantityAsync(int userId, int stockId);
        Task UpdateHoldingsAsync(int userId, int stockId, decimal quantityChange);
        
        Task<int> ExecuteTransactionAsync(int buyerUserId, int stockId, decimal quantity, decimal pricePerUnit, int? buyOrderId = null, int? sellOrderId = null);
        Task<int> CreateTransactionAsync(int buyerUserId, int stockId, decimal quantity, decimal pricePerUnit);
        Task<List<TransactionResponse>> GetUserTransactionsAsync(int userId, int pageSize = 50, int pageNumber = 1);
        Task<List<TransactionResponse>> GetUserActivityAsync(int userId, int pageSize = 50, int pageNumber = 1);
        
        Task<decimal> GetUserBalanceAsync(int userId);
        Task<decimal> UpdateUserBalanceAsync(int userId, decimal amount, bool isDebit = false);
        Task<bool> CheckSufficientBalanceAsync(int userId, decimal requiredAmount);
    }
}