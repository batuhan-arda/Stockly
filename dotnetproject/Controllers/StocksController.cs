using Microsoft.AspNetCore.Mvc;
using System.Net.Http;
using System.Threading.Tasks;
using System.Text.Json;
using dotnetproject.Services;
using dotnetproject.Models;
using dotnetproject.SqlConnection;

namespace dotnetproject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StocksController : ControllerBase
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IPriceCacheService _priceCache;
        private readonly ISqlConnectionService _sqlConnection;

        public StocksController(IHttpClientFactory httpClientFactory, IPriceCacheService priceCache, ISqlConnectionService sqlConnection)
        {
            _httpClientFactory = httpClientFactory;
            _priceCache = priceCache;
            _sqlConnection = sqlConnection;
        }

        [HttpGet("available")]
        public async Task<IActionResult> GetAvailableStocks([FromQuery] string? search = null)
        {
            try
            {
                using var connection = await _sqlConnection.CreateConnectionAsync();
                var command = connection.CreateCommand();
                
                if (string.IsNullOrWhiteSpace(search))
                {
                    command.CommandText = "SELECT Symbol, CompanyName as Name, ISNULL(Category, 'Other') as Category FROM Stocks ORDER BY Symbol";
                }
                else
                {
                    command.CommandText = @"
                        SELECT Symbol, CompanyName as Name, ISNULL(Category, 'Other') as Category 
                        FROM Stocks 
                        WHERE Symbol LIKE @Search 
                           OR CompanyName LIKE @Search 
                           OR Category LIKE @Search
                        ORDER BY Symbol";
                    command.Parameters.AddWithValue("@Search", $"%{search}%");
                }

                var stocks = new List<StockInfo>();
                using var reader = await command.ExecuteReaderAsync();
                
                while (await reader.ReadAsync())
                {
                    stocks.Add(new StockInfo
                    {
                        Symbol = reader.GetString(0),
                        Name = reader.GetString(1),
                        Category = reader.GetString(2)
                    });
                }

                return Ok(stocks.Take(50)); // Limit to 50 results
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Failed to load stocks from database", details = ex.Message });
            }
        }

        [HttpGet("price/{symbol}/{range}")]
        public async Task<IActionResult> GetStockPrice(string symbol, string range)
        {
            // Validate range (Yahoo valid: 1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            var validRanges = new[] { "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max" };
            if (!validRanges.Contains(range))
                return BadRequest($"Invalid range. Valid values: {string.Join(", ", validRanges)}");

            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range={range}";
            var client = _httpClientFactory.CreateClient();
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36");
            var response = await client.SendAsync(request);
            if (!response.IsSuccessStatusCode)
                return StatusCode((int)response.StatusCode, "Failed to fetch stock data");

            var json = await response.Content.ReadAsStringAsync();
            return Content(json, "application/json");
        }

        [HttpGet("current/{symbol}")]
        public async Task<IActionResult> GetCurrentPrice(string symbol)
        {
            try
            {
                // Use centralized cache with 60-second freshness for API calls
                var cachedPrice = await _priceCache.GetCurrentPriceAsync(symbol, TimeSpan.FromSeconds(60));
                if (cachedPrice.HasValue)
                {
                    // Get cached price for previous close calculation (if available)
                    var previousClose = _priceCache.GetCachedPrice(symbol) ?? cachedPrice.Value;
                    var change = cachedPrice.Value - previousClose;
                    var changePercent = previousClose > 0 ? ((change / previousClose) * 100) : 0;

                    return Ok(new { 
                        symbol = symbol.ToUpper(),
                        price = (double)cachedPrice.Value,
                        previousClose = (double)previousClose,
                        change = (double)change,
                        changePercent = changePercent,
                        timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                        source = "cache"
                    });
                }

                return StatusCode(503, new { error = "Price data temporarily unavailable. Please try again later." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}
