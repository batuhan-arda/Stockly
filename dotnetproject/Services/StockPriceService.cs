using Microsoft.AspNetCore.SignalR;
using System.Text.Json;
using dotnetproject.Hubs;

namespace dotnetproject.Services
{
    public class StockPriceService : BackgroundService
    {
        private readonly IHubContext<StockHub> _hubContext;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<StockPriceService> _logger;
        private readonly IPriceCacheService _priceCache;
        private readonly Dictionary<string, decimal> _lastPrices = new();

        public StockPriceService(
            IHubContext<StockHub> hubContext, 
            IHttpClientFactory httpClientFactory,
            ILogger<StockPriceService> logger,
            IPriceCacheService priceCache)
        {
            _hubContext = hubContext;
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _priceCache = priceCache;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    // Get currently active symbols from the hub
                    var activeSymbols = StockHub.GetActiveSymbols();
                    
                    if (activeSymbols.Count > 0)
                    {
                        _logger.LogInformation($"Updating prices for {activeSymbols.Count} active symbols: {string.Join(", ", activeSymbols)}");
                        
                        foreach (var symbol in activeSymbols)
                        {
                            await UpdateStockPrice(symbol);
                            
                            // Add delay between symbols to avoid rate limiting
                            if (activeSymbols.Count > 1)
                            {
                                await Task.Delay(1000, stoppingToken); // 1 second between symbols
                            }
                        }
                    }
                    else
                    {
                        _logger.LogDebug("No active symbols to monitor");
                    }

                    // Wait 5 seconds before next update cycle
                    await Task.Delay(5000, stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error in stock price service");
                    await Task.Delay(10000, stoppingToken); // Wait 10 seconds on error
                }
            }
        }

        private async Task UpdateStockPrice(string symbol)
        {
            try
            {
                using var httpClient = _httpClientFactory.CreateClient();
                
                // Add user agent to look more like a browser
                httpClient.DefaultRequestHeaders.Add("User-Agent", 
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
                
                var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d";
                
                var response = await httpClient.GetAsync(url);
                
                // Handle rate limiting specifically
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    _logger.LogWarning($"Rate limited for {symbol}. Waiting longer before next request.");
                    return; // Skip this update, try again next cycle
                }
                
                response.EnsureSuccessStatusCode();
                var responseContent = await response.Content.ReadAsStringAsync();
                var data = JsonDocument.Parse(responseContent);

                var result = data.RootElement.GetProperty("chart").GetProperty("result")[0];
                var meta = result.GetProperty("meta");
                var currentPrice = meta.GetProperty("regularMarketPrice").GetDecimal();
                var previousClose = meta.GetProperty("previousClose").GetDecimal();
                var change = currentPrice - previousClose;
                var changePercent = (change / previousClose) * 100;

                // Check if price has changed since last update
                var hasChanged = !_lastPrices.ContainsKey(symbol) || _lastPrices[symbol] != currentPrice;
                
                if (hasChanged)
                {
                    _lastPrices[symbol] = currentPrice;
                    _priceCache.UpdatePrice(symbol, currentPrice); // Update shared cache

                    var priceUpdate = new
                    {
                        symbol,
                        price = currentPrice,
                        change,
                        changePercent,
                        timestamp = DateTimeOffset.UtcNow
                    };

                    // Send update to all clients subscribed to this symbol
                    await _hubContext.Clients.Group($"stock_{symbol}")
                        .SendAsync("ReceiveStockUpdate", priceUpdate);

                    _logger.LogInformation($"Sent price update for {symbol}: ${currentPrice:F2} (change: {change:+0.00;-0.00})");
                }
                else
                {
                    _logger.LogDebug($"No price change for {symbol}: ${currentPrice:F2}");
                }
            }
            catch (HttpRequestException ex) when (ex.Message.Contains("429"))
            {
                _logger.LogWarning($"Rate limited for {symbol}: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating price for {symbol}");
            }
        }
    }
}
