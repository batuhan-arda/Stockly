using dotnetproject.Models;
using dotnetproject.Repositories;
using System.Text.Json;

namespace dotnetproject.Services
{
    public class OrderProcessingService : BackgroundService
    {
        private readonly ITradingRepository _tradingRepository;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IPriceCacheService _priceCache;
        private readonly ILogger<OrderProcessingService> _logger;
        private readonly IServiceScope _scope;

        public OrderProcessingService(
            IServiceProvider serviceProvider,
            IHttpClientFactory httpClientFactory,
            IPriceCacheService priceCache,
            ILogger<OrderProcessingService> logger)
        {
            _scope = serviceProvider.CreateScope();
            _tradingRepository = _scope.ServiceProvider.GetRequiredService<ITradingRepository>();
            _httpClientFactory = httpClientFactory;
            _priceCache = priceCache;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Order Processing Service started");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessPendingOrdersAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred while processing orders");
                }

                // Process orders every 30 seconds
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        public async Task ProcessPendingOrdersAsync()
        {
            try
            {
                _logger.LogInformation("Starting order processing cycle");

                // Get all active buy orders
                var activeBuyOrders = await _tradingRepository.GetActiveBuyOrdersAsync();
                var activeSellOrders = await _tradingRepository.GetActiveSellOrdersAsync();

                _logger.LogInformation($"Processing {activeBuyOrders.Count} buy orders and {activeSellOrders.Count} sell orders");

                // Process buy orders
                foreach (var order in activeBuyOrders)
                {
                    try
                    {
                        var stock = await _tradingRepository.GetStockByIdAsync(order.StockId);
                        if (stock == null) 
                        {
                            _logger.LogWarning($"Stock not found for order {order.BuyOrderId}, StockId: {order.StockId}");
                            continue;
                        }

                        // Get current price: try cache first, then fetch live if missing
                        decimal? cachedPrice = _priceCache.GetCachedPrice(stock.Symbol);
                        decimal currentPrice;
                        if (!cachedPrice.HasValue)
                        {
                            _logger.LogInformation($"No cached price found for {stock.Symbol}, fetching live price for buy order {order.BuyOrderId}");
                            currentPrice = await GetCurrentStockPriceAsync(stock.Symbol);
                            if (currentPrice <= 0)
                            {
                                _logger.LogInformation($"Failed to fetch live price for {stock.Symbol}, skipping buy order {order.BuyOrderId}");
                                continue;
                            }
                            _priceCache.UpdatePrice(stock.Symbol, currentPrice);
                        }
                        else
                        {
                            currentPrice = cachedPrice.Value;
                        }
                        
                        _logger.LogInformation($"Buy Order {order.BuyOrderId}: {stock.Symbol} - Current Price: ${currentPrice:F2}, Limit Price: ${order.PricePerUnit:F2}");
                        
                        if (order.PricePerUnit >= currentPrice && currentPrice > 0)
                        {
                            _logger.LogInformation($"Executing buy order {order.BuyOrderId}: {stock.Symbol} at ${order.PricePerUnit:F2} (order price >= market price ${currentPrice:F2})");
                            await ExecuteBuyOrderAsync(order, order.PricePerUnit);
                        }
                        else
                        {
                            _logger.LogInformation($"Buy order {order.BuyOrderId} waiting - Order price ${order.PricePerUnit:F2} < Current price ${currentPrice:F2}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error processing buy order {order.BuyOrderId}");
                    }
                }

                // Process sell orders
                foreach (var order in activeSellOrders)
                {
                    try
                    {
                        var stock = await _tradingRepository.GetStockByIdAsync(order.StockId);
                        if (stock == null) continue;

                        // Get current price: try cache first, then fetch live if missing
                        decimal? cachedPrice = _priceCache.GetCachedPrice(stock.Symbol);
                        decimal currentPrice;
                        if (!cachedPrice.HasValue)
                        {
                            _logger.LogInformation($"No cached price found for {stock.Symbol}, fetching live price for sell order {order.SellOrderId}");
                            currentPrice = await GetCurrentStockPriceAsync(stock.Symbol);
                            if (currentPrice <= 0)
                            {
                                _logger.LogInformation($"Failed to fetch live price for {stock.Symbol}, skipping sell order {order.SellOrderId}");
                                continue;
                            }
                            _priceCache.UpdatePrice(stock.Symbol, currentPrice);
                        }
                        else
                        {
                            currentPrice = cachedPrice.Value;
                        }
                        
                        _logger.LogInformation($"Sell Order {order.SellOrderId}: {stock.Symbol} - Current Price: ${currentPrice:F2}, Limit Price: ${order.PricePerUnit:F2}");
                        
                        if (order.PricePerUnit <= currentPrice && currentPrice > 0)
                        {
                            // Check if user has sufficient holdings before executing sell order
                            var userHoldings = await _tradingRepository.GetUserHoldingQuantityAsync(order.UserId, order.StockId);
                            if (userHoldings >= order.Quantity)
                            {
                                _logger.LogInformation($"Executing sell order {order.SellOrderId}: {stock.Symbol} at ${order.PricePerUnit:F2} (order price <= market price ${currentPrice:F2})");
                                await ExecuteSellOrderAsync(order, order.PricePerUnit);
                            }
                            else
                            {
                                _logger.LogWarning($"Sell order {order.SellOrderId} cancelled - Insufficient holdings. Has {userHoldings}, needs {order.Quantity}");
                                await _tradingRepository.UpdateOrderStatusAsync("Sell", order.SellOrderId, "CANCELLED");
                            }
                        }
                        else
                        {
                            _logger.LogInformation($"Sell order {order.SellOrderId} waiting - Order price ${order.PricePerUnit:F2} > Current price ${currentPrice:F2}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, $"Error processing sell order {order.SellOrderId}");
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in ProcessPendingOrdersAsync");
            }
        }

        private async Task ExecuteBuyOrderAsync(BuyOrder order, decimal executionPrice)
        {
            try
            {
                var totalCost = order.Quantity * executionPrice;
                
                // Verify user still has sufficient balance
                var currentBalance = await _tradingRepository.GetUserBalanceAsync(order.UserId);
                if (currentBalance < totalCost)
                {
                    _logger.LogWarning($"Buy order {order.BuyOrderId} cancelled - insufficient balance. Required: ${totalCost}, Available: ${currentBalance}");
                    await _tradingRepository.UpdateOrderStatusAsync("Buy", order.BuyOrderId, "Cancelled");
                    return;
                }

                try
                {
                    await _tradingRepository.UpdateUserBalanceAsync(order.UserId, -totalCost);

                    await _tradingRepository.UpdateHoldingsAsync(order.UserId, order.StockId, order.Quantity);

                    await _tradingRepository.CreateTransactionAsync(
                        buyerUserId: order.UserId,
                        stockId: order.StockId,
                        quantity: order.Quantity,
                        pricePerUnit: executionPrice
                    );

                    await _tradingRepository.UpdateOrderStatusAsync("Buy", order.BuyOrderId, "FILLED");
                    
                    _logger.LogInformation($"Buy order {order.BuyOrderId} executed successfully: {order.Quantity} shares at ${executionPrice}");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Failed to execute buy order {order.BuyOrderId}");
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error executing buy order {order.BuyOrderId}");
            }
        }

        private async Task ExecuteSellOrderAsync(SellOrder order, decimal executionPrice)
        {
            try
            {
                var totalProceeds = order.Quantity * executionPrice;
                
                // Verify user still has sufficient holdings
                var currentHoldings = await _tradingRepository.GetUserHoldingQuantityAsync(order.UserId, order.StockId);
                if (currentHoldings < order.Quantity)
                {
                    _logger.LogWarning($"Sell order {order.SellOrderId} cancelled - insufficient holdings. Required: {order.Quantity}, Available: {currentHoldings}");
                    await _tradingRepository.UpdateOrderStatusAsync("Sell", order.SellOrderId, "Cancelled");
                    return;
                }

                try
                {
                    await _tradingRepository.UpdateHoldingsAsync(order.UserId, order.StockId, -order.Quantity);

                    await _tradingRepository.UpdateUserBalanceAsync(order.UserId, totalProceeds);

                    await _tradingRepository.CreateTransactionAsync(
                        buyerUserId: order.UserId,
                        stockId: order.StockId,
                        quantity: -order.Quantity,
                        pricePerUnit: executionPrice
                    );

                    await _tradingRepository.UpdateOrderStatusAsync("Sell", order.SellOrderId, "FILLED");
                    
                    _logger.LogInformation($"Sell order {order.SellOrderId} executed successfully: {order.Quantity} shares at ${executionPrice}"); 
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Failed to execute sell order {order.SellOrderId}");
                    throw;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error executing sell order {order.SellOrderId}");
            }
        }

        private async Task<decimal> GetCurrentStockPriceAsync(string symbol)
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

        public override void Dispose()
        {
            _scope?.Dispose();
            base.Dispose();
        }
    }
}