using dotnetproject.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace dotnetproject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // Require JWT authentication for all endpoints
    public class TransactionsController : ControllerBase
    {
        private readonly ITradingService _tradingService;
        private readonly ILogger<TransactionsController> _logger;

        public TransactionsController(ITradingService tradingService, ILogger<TransactionsController> logger)
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
        /// Get user's transaction history with pagination
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetTransactions(
            [FromQuery] int pageSize = 50, 
            [FromQuery] int pageNumber = 1)
        {
            try
            {
                // Validate pagination parameters
                if (pageSize <= 0 || pageSize > 100)
                {
                    return BadRequest(new { success = false, message = "Page size must be between 1 and 100" });
                }
                
                if (pageNumber <= 0)
                {
                    return BadRequest(new { success = false, message = "Page number must be greater than 0" });
                }

                var userId = GetUserId();
                
                // Get combined transactions and orders
                var activities = await _tradingService.GetAllUserActivityAsync(userId, pageSize, pageNumber);
                
                return Ok(new { 
                    success = true, 
                    transactions = activities,
                    pagination = new
                    {
                        pageSize,
                        pageNumber,
                        itemCount = activities.Count
                    },
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching transactions");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get user's completed transaction history only (backward compatibility)
        /// </summary>
        [HttpGet("completed")]
        public async Task<IActionResult> GetCompletedTransactions(
            [FromQuery] int pageSize = 50, 
            [FromQuery] int pageNumber = 1)
        {
            try
            {
                // Validate pagination parameters
                if (pageSize <= 0 || pageSize > 100)
                {
                    return BadRequest(new { success = false, message = "Page size must be between 1 and 100" });
                }
                
                if (pageNumber <= 0)
                {
                    return BadRequest(new { success = false, message = "Page number must be greater than 0" });
                }

                var userId = GetUserId();
                var transactions = await _tradingService.GetTransactionHistoryAsync(userId, pageSize, pageNumber);
                
                return Ok(new { 
                    success = true, 
                    transactions,
                    pagination = new
                    {
                        pageSize,
                        pageNumber,
                        itemCount = transactions.Count
                    },
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching transactions");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get transactions filtered by symbol
        /// </summary>
        [HttpGet("symbol/{symbol}")]
        public async Task<IActionResult> GetTransactionsBySymbol(
            string symbol,
            [FromQuery] int pageSize = 50, 
            [FromQuery] int pageNumber = 1)
        {
            try
            {
                if (pageSize <= 0 || pageSize > 100)
                {
                    return BadRequest(new { success = false, message = "Page size must be between 1 and 100" });
                }
                
                if (pageNumber <= 0)
                {
                    return BadRequest(new { success = false, message = "Page number must be greater than 0" });
                }

                var userId = GetUserId();
                var allTransactions = await _tradingService.GetTransactionHistoryAsync(userId, pageSize * 10, 1); // Get more to filter
                
                var filteredTransactions = allTransactions
                    .Where(t => t.Symbol.Equals(symbol, StringComparison.OrdinalIgnoreCase))
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();
                
                return Ok(new { 
                    success = true, 
                    transactions = filteredTransactions,
                    filter = new { symbol },
                    pagination = new
                    {
                        pageSize,
                        pageNumber,
                        itemCount = filteredTransactions.Count
                    },
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching transactions for symbol {symbol}");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get transactions filtered by type (Buy/Sell)
        /// </summary>
        [HttpGet("type/{transactionType}")]
        public async Task<IActionResult> GetTransactionsByType(
            string transactionType,
            [FromQuery] int pageSize = 50, 
            [FromQuery] int pageNumber = 1)
        {
            try
            {
                if (!transactionType.Equals("Buy", StringComparison.OrdinalIgnoreCase) && 
                    !transactionType.Equals("Sell", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { success = false, message = "Transaction type must be 'Buy' or 'Sell'" });
                }

                if (pageSize <= 0 || pageSize > 100)
                {
                    return BadRequest(new { success = false, message = "Page size must be between 1 and 100" });
                }
                
                if (pageNumber <= 0)
                {
                    return BadRequest(new { success = false, message = "Page number must be greater than 0" });
                }

                var userId = GetUserId();
                var allTransactions = await _tradingService.GetTransactionHistoryAsync(userId, pageSize * 10, 1); // Get more to filter
                
                var filteredTransactions = allTransactions
                    .Where(t => t.TransactionType.Equals(transactionType, StringComparison.OrdinalIgnoreCase))
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();
                
                return Ok(new { 
                    success = true, 
                    transactions = filteredTransactions,
                    filter = new { transactionType },
                    pagination = new
                    {
                        pageSize,
                        pageNumber,
                        itemCount = filteredTransactions.Count
                    },
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error fetching transactions for type {transactionType}");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get transaction summary/statistics
        /// </summary>
        [HttpGet("summary")]
        public async Task<IActionResult> GetTransactionSummary()
        {
            try
            {
                var userId = GetUserId();
                var transactions = await _tradingService.GetTransactionHistoryAsync(userId, 1000, 1); // Get more for analysis
                
                var summary = new
                {
                    totalTransactions = transactions.Count,
                    buyTransactions = transactions.Count(t => t.TransactionType == "Buy"),
                    sellTransactions = transactions.Count(t => t.TransactionType == "Sell"),
                    totalVolume = transactions.Sum(t => t.TotalValue),
                    buyVolume = transactions.Where(t => t.TransactionType == "Buy").Sum(t => t.TotalValue),
                    sellVolume = transactions.Where(t => t.TransactionType == "Sell").Sum(t => t.TotalValue),
                    uniqueSymbols = transactions.Select(t => t.Symbol).Distinct().Count(),
                    mostTradedSymbol = transactions.GroupBy(t => t.Symbol)
                        .OrderByDescending(g => g.Count())
                        .FirstOrDefault()?.Key,
                    firstTransactionDate = transactions.OrderBy(t => t.Timestamp).FirstOrDefault()?.Timestamp,
                    lastTransactionDate = transactions.OrderByDescending(t => t.Timestamp).FirstOrDefault()?.Timestamp,
                    timestamp = DateTime.UtcNow
                };
                
                return Ok(new { success = true, summary });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching transaction summary");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        /// <summary>
        /// Get transactions within a date range
        /// </summary>
        [HttpGet("range")]
        public async Task<IActionResult> GetTransactionsByDateRange(
            [FromQuery] DateTime startDate,
            [FromQuery] DateTime endDate,
            [FromQuery] int pageSize = 50, 
            [FromQuery] int pageNumber = 1)
        {
            try
            {
                if (startDate >= endDate)
                {
                    return BadRequest(new { success = false, message = "Start date must be before end date" });
                }

                if (pageSize <= 0 || pageSize > 100)
                {
                    return BadRequest(new { success = false, message = "Page size must be between 1 and 100" });
                }
                
                if (pageNumber <= 0)
                {
                    return BadRequest(new { success = false, message = "Page number must be greater than 0" });
                }

                var userId = GetUserId();
                var allTransactions = await _tradingService.GetTransactionHistoryAsync(userId, pageSize * 10, 1); // Get more to filter
                
                var filteredTransactions = allTransactions
                    .Where(t => t.Timestamp >= startDate && t.Timestamp <= endDate)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();
                
                return Ok(new { 
                    success = true, 
                    transactions = filteredTransactions,
                    filter = new { startDate, endDate },
                    pagination = new
                    {
                        pageSize,
                        pageNumber,
                        itemCount = filteredTransactions.Count
                    },
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching transactions by date range");
                return StatusCode(500, new { success = false, message = "Internal server error" });
            }
        }

        [HttpPut("{transactionId}/cancel")]
        public async Task<IActionResult> CancelOrder(int transactionId)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, message = "Invalid user ID" });
                }

                // First, get the transaction to determine the order type
                var transactions = await _tradingService.GetTransactionHistoryAsync(userId);
                var transaction = transactions.FirstOrDefault(t => t.TransactionId == transactionId);
                
                if (transaction == null)
                {
                    return NotFound(new { success = false, message = "Transaction not found" });
                }

                var cancelRequest = new dotnetproject.Models.CancelOrderRequest
                {
                    OrderId = transactionId,
                    OrderType = transaction.TransactionType
                };

                var success = await _tradingService.CancelOrderAsync(userId, cancelRequest);
                if (!success)
                {
                    return BadRequest(new { success = false, message = "Unable to cancel order. Order may not exist, may not belong to you, or may already be executed/cancelled." });
                }

                return Ok(new { success = true, message = "Order cancelled successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling order {TransactionId} for user {UserId}", transactionId, User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
                return StatusCode(500, new { success = false, message = "An error occurred while cancelling the order" });
            }
        }

        [HttpGet("{transactionId}")]
        public async Task<IActionResult> GetTransactionById(int transactionId)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, message = "Invalid user ID" });
                }

                var transactions = await _tradingService.GetTransactionHistoryAsync(userId);
                var transaction = transactions.FirstOrDefault(t => t.TransactionId == transactionId);
                
                if (transaction == null)
                {
                    return NotFound(new { success = false, message = "Transaction not found" });
                }

                return Ok(new { success = true, transaction });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching transaction {TransactionId} for user {UserId}", transactionId, User.FindFirst(ClaimTypes.NameIdentifier)?.Value);
                return StatusCode(500, new { success = false, message = "An error occurred while fetching the transaction" });
            }
        }
    }
}