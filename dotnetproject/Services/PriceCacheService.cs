using System.Collections.Concurrent;

namespace dotnetproject.Services
{
    public class PriceCacheEntry
    {
        public decimal Price { get; set; }
        public DateTime LastUpdated { get; set; }
    }

    public interface IPriceCacheService
    {
        decimal? GetCachedPrice(string symbol);
        void UpdatePrice(string symbol, decimal price);
        bool IsPriceFresh(string symbol, TimeSpan maxAge);
        Task<decimal?> GetCurrentPriceAsync(string symbol, TimeSpan? maxAge = null);
        void RequestPriceUpdate(string symbol);
    }

    public class PriceCacheService : IPriceCacheService
    {
        private readonly ConcurrentDictionary<string, PriceCacheEntry> _priceCache = new();
        private readonly ConcurrentQueue<string> _updateQueue = new();
        private readonly ConcurrentDictionary<string, TaskCompletionSource<decimal?>> _pendingRequests = new();
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger<PriceCacheService> _logger;
        private readonly Timer _queueProcessor;
        private readonly SemaphoreSlim _processingLock = new(1, 1);
        
        // Default freshness: 30 seconds for real-time trading
        private static readonly TimeSpan DefaultMaxAge = TimeSpan.FromSeconds(30);

        public PriceCacheService(IHttpClientFactory httpClientFactory, ILogger<PriceCacheService> logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            
            // Process queue every 10 seconds to avoid rate limits
            _queueProcessor = new Timer(ProcessUpdateQueue, null, TimeSpan.FromSeconds(10), TimeSpan.FromSeconds(10));
        }

        public decimal? GetCachedPrice(string symbol)
        {
            return _priceCache.TryGetValue(symbol, out var entry) ? entry.Price : null;
        }

        public void UpdatePrice(string symbol, decimal price)
        {
            _priceCache[symbol] = new PriceCacheEntry 
            { 
                Price = price, 
                LastUpdated = DateTime.UtcNow 
            };

            // Complete any pending requests for this symbol
            if (_pendingRequests.TryRemove(symbol, out var tcs))
            {
                tcs.SetResult(price);
            }
        }

        public bool IsPriceFresh(string symbol, TimeSpan maxAge)
        {
            if (_priceCache.TryGetValue(symbol, out var entry))
            {
                return DateTime.UtcNow - entry.LastUpdated <= maxAge;
            }
            return false;
        }

        public async Task<decimal?> GetCurrentPriceAsync(string symbol, TimeSpan? maxAge = null)
        {
            var effectiveMaxAge = maxAge ?? DefaultMaxAge;

            // Check if we have fresh cached data
            if (IsPriceFresh(symbol, effectiveMaxAge))
            {
                return GetCachedPrice(symbol);
            }

            // Check if there's already a pending request for this symbol
            if (_pendingRequests.TryGetValue(symbol, out var existingTcs))
            {
                try
                {
                    return await existingTcs.Task.WaitAsync(TimeSpan.FromSeconds(30));
                }
                catch (TimeoutException)
                {
                    _logger.LogWarning($"Timeout waiting for price update for {symbol}");
                    return GetCachedPrice(symbol); // Return stale data if available
                }
            }

            // Create new pending request
            var tcs = new TaskCompletionSource<decimal?>();
            if (_pendingRequests.TryAdd(symbol, tcs))
            {
                // Queue the symbol for update
                RequestPriceUpdate(symbol);

                try
                {
                    return await tcs.Task.WaitAsync(TimeSpan.FromSeconds(30));
                }
                catch (TimeoutException)
                {
                    _logger.LogWarning($"Timeout waiting for price update for {symbol}");
                    _pendingRequests.TryRemove(symbol, out _);
                    return GetCachedPrice(symbol); // Return stale data if available
                }
            }

            // Fallback to cached data
            return GetCachedPrice(symbol);
        }

        public void RequestPriceUpdate(string symbol)
        {
            _updateQueue.Enqueue(symbol);
        }

        private async void ProcessUpdateQueue(object? state)
        {
            if (!_processingLock.Wait(100)) // Don't block if already processing
                return;

            try
            {
                var symbolsToUpdate = new HashSet<string>();
                
                // Collect unique symbols from queue (deduplication)
                while (_updateQueue.TryDequeue(out var symbol) && symbolsToUpdate.Count < 10) // Limit batch size
                {
                    symbolsToUpdate.Add(symbol);
                }

                if (symbolsToUpdate.Count == 0)
                    return;

                _logger.LogInformation($"Processing {symbolsToUpdate.Count} price update requests: {string.Join(", ", symbolsToUpdate)}");

                // Process each symbol with delay to respect rate limits
                foreach (var symbol in symbolsToUpdate)
                {
                    await UpdatePriceFromApi(symbol);
                    
                    // Small delay between requests to avoid hitting rate limits
                    if (symbolsToUpdate.Count > 1)
                    {
                        await Task.Delay(2000); // 2 seconds between API calls
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing price update queue");
            }
            finally
            {
                _processingLock.Release();
            }
        }

        private async Task UpdatePriceFromApi(string symbol)
        {
            try
            {
                using var httpClient = _httpClientFactory.CreateClient();
                httpClient.DefaultRequestHeaders.Add("User-Agent", 
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");

                var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d";
                
                var response = await httpClient.GetAsync(url);
                
                // Handle rate limiting gracefully
                if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
                {
                    _logger.LogWarning($"Rate limited for {symbol}. Will retry later.");
                    
                    // Complete pending request with cached data if available
                    if (_pendingRequests.TryRemove(symbol, out var tcs))
                    {
                        tcs.SetResult(GetCachedPrice(symbol));
                    }
                    return;
                }

                response.EnsureSuccessStatusCode();
                var json = await response.Content.ReadAsStringAsync();
                
                using var jsonDoc = System.Text.Json.JsonDocument.Parse(json);
                var result = jsonDoc.RootElement.GetProperty("chart").GetProperty("result")[0];
                var meta = result.GetProperty("meta");
                
                if (meta.TryGetProperty("regularMarketPrice", out var priceElement))
                {
                    var price = priceElement.GetDecimal();
                    UpdatePrice(symbol, price);
                    _logger.LogDebug($"Updated price for {symbol}: ${price:F2}");
                }
                else
                {
                    _logger.LogWarning($"No price data found for {symbol}");
                    
                    // Complete pending request with cached data if available
                    if (_pendingRequests.TryRemove(symbol, out var tcs))
                    {
                        tcs.SetResult(GetCachedPrice(symbol));
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching price for {symbol}");
                
                // Complete pending request with cached data if available
                if (_pendingRequests.TryRemove(symbol, out var tcs))
                {
                    tcs.SetResult(GetCachedPrice(symbol));
                }
            }
        }

        public void Dispose()
        {
            _queueProcessor?.Dispose();
            _processingLock?.Dispose();
        }
    }
} 