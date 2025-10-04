using dotnetproject.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace dotnetproject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Require JWT authentication for all endpoints
    public class PortfolioController : ControllerBase
    {
        private readonly ITradingService _tradingService;
        private readonly ILogger<PortfolioController> _logger;

        public PortfolioController(ITradingService tradingService, ILogger<PortfolioController> logger)
        {
            _tradingService = tradingService;
            _logger = logger;
        }

        private int GetUserId()
        {
            var userIdClaim = User.FindFirst("UserId")?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                throw new UnauthorizedAccessException("Invalid user ID in token");
            }
            return userId;
        }

        /// <summary>
        /// Get user's complete portfolio summary including holdings, values, and performance
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetPortfolio()
        {
            try
            {
                var userId = GetUserId();
                var portfolio = await _tradingService.GetPortfolioSummaryAsync(userId);
                
                return Ok(new { 
                    success = true, 
                    portfolio,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching portfolio");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get user's holdings only (without performance calculations)
        /// </summary>
        [HttpGet("holdings")]
        public async Task<IActionResult> GetHoldings()
        {
            try
            {
                var userId = GetUserId();
                var portfolio = await _tradingService.GetPortfolioSummaryAsync(userId);
                
                return Ok(new { 
                    success = true, 
                    holdings = portfolio.Holdings,
                    totalValue = portfolio.TotalValue,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching holdings");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get portfolio performance metrics
        /// </summary>
        [HttpGet("performance")]
        public async Task<IActionResult> GetPerformance()
        {
            try
            {
                var userId = GetUserId();
                var portfolio = await _tradingService.GetPortfolioSummaryAsync(userId);
                
                var performance = new
                {
                    totalValue = portfolio.TotalValue,
                    totalGainLoss = portfolio.TotalGainLoss,
                    totalGainLossPercentage = portfolio.TotalGainLossPercentage,
                    holdingsCount = portfolio.Holdings.Count,
                    timestamp = DateTime.UtcNow
                };
                
                return Ok(new { success = true, performance });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching portfolio performance");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get real-time portfolio value (current market value of all holdings)
        /// </summary>
        [HttpGet("value")]
        public async Task<IActionResult> GetPortfolioValue()
        {
            try
            {
                var userId = GetUserId();
                var portfolio = await _tradingService.GetPortfolioSummaryAsync(userId);
                
                var value = new
                {
                    totalValue = portfolio.TotalValue,
                    holdings = portfolio.Holdings.Select(h => new
                    {
                        symbol = h.Symbol,
                        quantity = h.QuantityOwned,
                        currentPrice = h.CurrentPrice,
                        value = h.TotalValue
                    }).ToList(),
                    timestamp = DateTime.UtcNow
                };
                
                return Ok(new { success = true, value });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching portfolio value");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get portfolio diversity breakdown
        /// </summary>
        [HttpGet("diversity")]
        public async Task<IActionResult> GetPortfolioDiversity()
        {
            try
            {
                var userId = GetUserId();
                var portfolio = await _tradingService.GetPortfolioSummaryAsync(userId);
                
                if (portfolio.TotalValue == 0)
                {
                    return Ok(new { success = true, diversity = new List<object>(), message = "No holdings found" });
                }

                var diversity = portfolio.Holdings.Select(h => new
                {
                    symbol = h.Symbol,
                    companyName = h.CompanyName,
                    value = h.TotalValue,
                    percentage = Math.Round((h.TotalValue / portfolio.TotalValue) * 100, 2),
                    quantity = h.QuantityOwned,
                    currentPrice = h.CurrentPrice
                }).OrderByDescending(x => x.value).ToList();
                
                return Ok(new { 
                    success = true, 
                    diversity,
                    totalValue = portfolio.TotalValue,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching portfolio diversity");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }
    }
}