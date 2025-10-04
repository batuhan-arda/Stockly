using dotnetproject.Models;
using dotnetproject.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using System.Security.Claims;

namespace dotnetproject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Require JWT authentication for all endpoints
    public class TradingController : ControllerBase
    {
        private readonly ITradingService _tradingService;
        private readonly ILogger<TradingController> _logger;

        public TradingController(ITradingService tradingService, ILogger<TradingController> logger)
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
        /// Create a buy order (limit order)
        /// </summary>
        [HttpPost("buy")]
        [EnableRateLimiting("TradingPolicy")]
        public async Task<IActionResult> CreateBuyOrder([FromBody] CreateOrderRequest request)
        {
            try
            {
                var userId = GetUserId();
                var order = await _tradingService.CreateBuyOrderAsync(userId, request);
                
                _logger.LogInformation($"Buy order created: User {userId}, Symbol {request.Symbol}, Quantity {request.Quantity}, Price {request.PricePerUnit}");
                
                return Ok(new { success = true, order });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating buy order");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Create a sell order (limit order)
        /// </summary>
        [HttpPost("sell")]
        [EnableRateLimiting("TradingPolicy")]
        public async Task<IActionResult> CreateSellOrder([FromBody] CreateOrderRequest request)
        {
            try
            {
                var userId = GetUserId();
                var order = await _tradingService.CreateSellOrderAsync(userId, request);
                
                _logger.LogInformation($"Sell order created: User {userId}, Symbol {request.Symbol}, Quantity {request.Quantity}, Price {request.PricePerUnit}");
                
                return Ok(new { success = true, order });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating sell order");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Execute market order (immediate execution at current market price)
        /// </summary>
        [HttpPost("market")]
        [EnableRateLimiting("TradingPolicy")]
        public async Task<IActionResult> ExecuteMarketOrder([FromBody] MarketOrderRequest request)
        {
            try
            {
                var userId = GetUserId();
                var transaction = await _tradingService.ExecuteMarketOrderAsync(userId, request);
                
                _logger.LogInformation($"Market order executed: User {userId}, Symbol {request.Symbol}, Type {request.OrderType}, Quantity {request.Quantity}");
                
                return Ok(new { success = true, transaction });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { success = false, message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing market order");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get user's active orders
        /// </summary>
        [HttpGet("orders")]
        public async Task<IActionResult> GetUserOrders()
        {
            try
            {
                var userId = GetUserId();
                var orders = await _tradingService.GetUserOrdersAsync(userId);
                
                return Ok(new { success = true, orders });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user orders");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Cancel an existing order
        /// </summary>
        [HttpDelete("orders")]
        [EnableRateLimiting("TradingPolicy")]
        public async Task<IActionResult> CancelOrder([FromBody] CancelOrderRequest request)
        {
            try
            {
                var userId = GetUserId();
                var success = await _tradingService.CancelOrderAsync(userId, request);
                
                if (success)
                {
                    _logger.LogInformation($"Order cancelled: User {userId}, OrderId {request.OrderId}, Type {request.OrderType}");
                    return Ok(new { success = true, message = "Order cancelled successfully" });
                }
                else
                {
                    return BadRequest(new { success = false, message = "Order not found or cannot be cancelled" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling order");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get current market price for a symbol
        /// </summary>
        [HttpGet("price/{symbol}")]
        public async Task<IActionResult> GetCurrentPrice(string symbol)
        {
            try
            {
                var price = await _tradingService.GetCurrentStockPriceAsync(symbol);
                
                if (price > 0)
                {
                    return Ok(new { success = true, symbol, price, timestamp = DateTime.UtcNow });
                }
                else
                {
                    return NotFound(new { success = false, message = $"Price not found for symbol {symbol}" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching price for {symbol}");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }
    }
}