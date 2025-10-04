using dotnetproject.Models;
using dotnetproject.Repositories;
using System.Text.Json;

namespace dotnetproject.Services
{
    public interface ITradingService
    {
        Task<OrderResponse> CreateBuyOrderAsync(int userId, CreateOrderRequest request);
        Task<OrderResponse> CreateSellOrderAsync(int userId, CreateOrderRequest request);
        Task<TransactionResponse> ExecuteMarketOrderAsync(int userId, MarketOrderRequest request);
        Task<List<OrderResponse>> GetUserOrdersAsync(int userId);
        Task<bool> CancelOrderAsync(int userId, CancelOrderRequest request);
        Task<PortfolioSummary> GetPortfolioSummaryAsync(int userId);
        Task<List<TransactionResponse>> GetTransactionHistoryAsync(int userId, int pageSize = 50, int pageNumber = 1);
        Task<List<TransactionResponse>> GetAllUserActivityAsync(int userId, int pageSize = 50, int pageNumber = 1);
        Task<decimal> GetCurrentStockPriceAsync(string symbol);
        Task<decimal> GetUserBalanceAsync(int userId);
        Task<decimal> UpdateUserBalanceAsync(int userId, decimal amount, bool isDebit = false);
    }

    public class TradingService : ITradingService
    {
        private readonly ITradingRepository _tradingRepository;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<TradingService> _logger;
        private readonly IPriceCacheService _priceCache;

        public TradingService(ITradingRepository tradingRepository, IHttpClientFactory httpClientFactory, ILogger<TradingService> logger, IPriceCacheService priceCache)
        {
            _tradingRepository = tradingRepository;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _priceCache = priceCache;
        }

        public async Task<OrderResponse> CreateBuyOrderAsync(int userId, CreateOrderRequest request)
        {
            var stock = await _tradingRepository.GetStockBySymbolAsync(request.Symbol);
            if (stock == null)
            {
                throw new ArgumentException($"Stock symbol '{request.Symbol}' not found");
            }

            var totalCost = request.Quantity * request.PricePerUnit;
            
            // Check if user has sufficient balance
            var hasSufficientBalance = await _tradingRepository.CheckSufficientBalanceAsync(userId, totalCost);
            if (!hasSufficientBalance)
            {
                var currentBalance = await _tradingRepository.GetUserBalanceAsync(userId);
                throw new InvalidOperationException($"Insufficient balance. Required: ${totalCost:F2}, Available: ${currentBalance:F2}");
            }

            var orderId = await _tradingRepository.CreateBuyOrderAsync(userId, stock.StockId, request.Quantity, request.PricePerUnit);
            
            if (orderId <= 0)
            {
                throw new InvalidOperationException("Failed to create buy order");
            }

            return new OrderResponse
            {
                OrderId = orderId,
                OrderType = "Buy",
                Symbol = stock.Symbol,
                CompanyName = stock.CompanyName,
                Quantity = request.Quantity,
                PricePerUnit = request.PricePerUnit,
                CreatedAt = DateTime.UtcNow,
                Status = "Active"
            };
        }

        public async Task<OrderResponse> CreateSellOrderAsync(int userId, CreateOrderRequest request)
        {
            var stock = await _tradingRepository.GetStockBySymbolAsync(request.Symbol);
            if (stock == null)
            {
                throw new ArgumentException($"Stock symbol '{request.Symbol}' not found");
            }

            // Check if user has enough holdings
            var currentHoldings = await _tradingRepository.GetUserHoldingQuantityAsync(userId, stock.StockId);
            if (currentHoldings < request.Quantity)
            {
                throw new InvalidOperationException($"Insufficient holdings. You own {currentHoldings} shares but trying to sell {request.Quantity} shares");
            }

            var orderId = await _tradingRepository.CreateSellOrderAsync(userId, stock.StockId, request.Quantity, request.PricePerUnit);
            
            if (orderId <= 0)
            {
                throw new InvalidOperationException("Failed to create sell order");
            }

            return new OrderResponse
            {
                OrderId = orderId,
                OrderType = "Sell",
                Symbol = stock.Symbol,
                CompanyName = stock.CompanyName,
                Quantity = request.Quantity,
                PricePerUnit = request.PricePerUnit,
                CreatedAt = DateTime.UtcNow,
                Status = "Active"
            };
        }

        public async Task<TransactionResponse> ExecuteMarketOrderAsync(int userId, MarketOrderRequest request)
        {
            var stock = await _tradingRepository.GetStockBySymbolAsync(request.Symbol);
            if (stock == null)
            {
                throw new ArgumentException($"Stock symbol '{request.Symbol}' not found");
            }

            // Get current market price
            var currentPrice = await GetCurrentStockPriceAsync(request.Symbol);
            if (currentPrice <= 0)
            {
                throw new InvalidOperationException("Unable to fetch current market price");
            }

            var totalCost = request.Quantity * currentPrice;

            if (request.OrderType.Equals("Buy", StringComparison.OrdinalIgnoreCase))
            {
                var hasSufficientBalance = await _tradingRepository.CheckSufficientBalanceAsync(userId, totalCost);
                if (!hasSufficientBalance)
                {
                    var currentBalance = await _tradingRepository.GetUserBalanceAsync(userId);
                    throw new InvalidOperationException($"Insufficient balance. Required: ${totalCost:F2}, Available: ${currentBalance:F2}");
                }
            }

            if (request.OrderType.Equals("Sell", StringComparison.OrdinalIgnoreCase))
            {
                var currentHoldings = await _tradingRepository.GetUserHoldingQuantityAsync(userId, stock.StockId);
                if (currentHoldings < request.Quantity)
                {
                    throw new InvalidOperationException($"Insufficient holdings. You own {currentHoldings} shares but trying to sell {request.Quantity} shares");
                }
            }

            decimal quantity = request.OrderType.Equals("Sell", StringComparison.OrdinalIgnoreCase) 
                ? -request.Quantity
                : request.Quantity;

            var transactionId = await _tradingRepository.ExecuteTransactionAsync(
                userId, 
                stock.StockId, 
                quantity, 
                currentPrice
            );

            if (transactionId <= 0)
            {
                throw new InvalidOperationException("Failed to execute market order");
            }

            if (request.OrderType.Equals("Buy", StringComparison.OrdinalIgnoreCase))
            {
                await _tradingRepository.UpdateUserBalanceAsync(userId, totalCost, true);
            }
            else if (request.OrderType.Equals("Sell", StringComparison.OrdinalIgnoreCase))
            {
                await _tradingRepository.UpdateUserBalanceAsync(userId, totalCost, false);
            }

            return new TransactionResponse
            {
                TransactionId = transactionId,
                TransactionType = request.OrderType,
                Symbol = stock.Symbol,
                CompanyName = stock.CompanyName,
                Quantity = request.Quantity,
                PricePerUnit = currentPrice,
                Timestamp = DateTime.UtcNow
            };
        }

        public async Task<List<OrderResponse>> GetUserOrdersAsync(int userId)
        {
            var orders = await _tradingRepository.GetUserOrdersAsync(userId);
            return orders;
        }

        public async Task<bool> CancelOrderAsync(int userId, CancelOrderRequest request)
        {
            return await _tradingRepository.CancelOrderAsync(request.OrderId, request.OrderType, userId);
        }

        public async Task<PortfolioSummary> GetPortfolioSummaryAsync(int userId)
        {
            var holdings = await _tradingRepository.GetUserHoldingsAsync(userId);
            var summary = new PortfolioSummary();

            decimal totalCurrentValue = 0;
            decimal totalCostBasis = 0;

            foreach (var holding in holdings)
            {
                holding.CurrentPrice = await GetCurrentStockPriceAsync(holding.Symbol);
                
                var currentValue = holding.TotalValue;
                var costBasis = holding.QuantityOwned * holding.AveragePrice;
                
                totalCurrentValue += currentValue;
                totalCostBasis += costBasis;
            }

            summary.TotalValue = totalCurrentValue;
            summary.Holdings = holdings;
            
            summary.TotalGainLoss = totalCurrentValue - totalCostBasis;
            summary.TotalGainLossPercentage = totalCostBasis > 0 
                ? (summary.TotalGainLoss / totalCostBasis) * 100 
                : 0;

            return summary;
        }

        public async Task<List<TransactionResponse>> GetTransactionHistoryAsync(int userId, int pageSize = 50, int pageNumber = 1)
        {
            return await _tradingRepository.GetUserTransactionsAsync(userId, pageSize, pageNumber);
        }

        public async Task<List<TransactionResponse>> GetAllUserActivityAsync(int userId, int pageSize = 50, int pageNumber = 1)
        {
            return await _tradingRepository.GetUserActivityAsync(userId, pageSize, pageNumber);
        }

        public async Task<decimal> GetCurrentStockPriceAsync(string symbol)
        {
            try
            {
                // Use centralized cache with 30-second freshness for trading
                var cachedPrice = await _priceCache.GetCurrentPriceAsync(symbol, TimeSpan.FromSeconds(30));
                if (cachedPrice.HasValue)
                {
                    _logger.LogDebug($"Retrieved price for {symbol} from centralized cache: ${cachedPrice.Value:F2}");
                    return cachedPrice.Value;
                }

                _logger.LogWarning($"No price available for {symbol} from cache or API");
                return 0;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching current price for {symbol}");
                return 0;
            }
        }
        
        public async Task<decimal> GetUserBalanceAsync(int userId)
        {
            return await _tradingRepository.GetUserBalanceAsync(userId);
        }
        
        public async Task<decimal> UpdateUserBalanceAsync(int userId, decimal amount, bool isDebit = false)
        {
            return await _tradingRepository.UpdateUserBalanceAsync(userId, amount, isDebit);
        }
    }
}