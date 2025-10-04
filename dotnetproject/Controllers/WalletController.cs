using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using dotnetproject.Services;
using dotnetproject.Models;
using System.Security.Claims;

namespace dotnetproject.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WalletController : ControllerBase
    {
        private readonly ITradingService _tradingService;
        private readonly ILogger<WalletController> _logger;

        public WalletController(ITradingService tradingService, ILogger<WalletController> logger)
        {
            _tradingService = tradingService;
            _logger = logger;
        }

        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance()
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId")?.Value;
                _logger.LogInformation($"GetBalance called. UserId claim: {userIdClaim}");
                
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    _logger.LogWarning("Invalid or missing UserId in token");
                    return Unauthorized("Invalid user ID");
                }

                _logger.LogInformation($"Getting balance for user ID: {userId}");
                var balance = await _tradingService.GetUserBalanceAsync(userId);
                _logger.LogInformation($"Retrieved balance: ${balance} for user {userId}");
                
                // If balance is 0, try to create a wallet with initial balance for existing users
                if (balance == 0)
                {
                    _logger.LogInformation($"Balance is 0 for user {userId}, attempting to create wallet with initial balance");
                    await _tradingService.UpdateUserBalanceAsync(userId, 10000.00m, false);
                    balance = await _tradingService.GetUserBalanceAsync(userId);
                    _logger.LogInformation($"After wallet creation, balance is now: ${balance} for user {userId}");
                }
                
                return Ok(new { Balance = balance });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting user balance");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost("deposit")]
        public async Task<IActionResult> Deposit([FromBody] WalletTransactionRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized("Invalid user ID");
                }

                if (request.Amount <= 0)
                {
                    return BadRequest("Amount must be greater than 0");
                }

                var newBalance = await _tradingService.UpdateUserBalanceAsync(userId, request.Amount, false);
                
                return Ok(new { 
                    Message = "Deposit successful", 
                    Amount = request.Amount,
                    NewBalance = newBalance 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing deposit");
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost("withdraw")]
        public async Task<IActionResult> Withdraw([FromBody] WalletTransactionRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst("UserId")?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized("Invalid user ID");
                }

                if (request.Amount <= 0)
                {
                    return BadRequest("Amount must be greater than 0");
                }

                // Check if user has sufficient balance
                var currentBalance = await _tradingService.GetUserBalanceAsync(userId);
                if (currentBalance < request.Amount)
                {
                    return BadRequest($"Insufficient balance. Available: ${currentBalance:F2}, Requested: ${request.Amount:F2}");
                }

                var newBalance = await _tradingService.UpdateUserBalanceAsync(userId, request.Amount, true);
                
                return Ok(new { 
                    Message = "Withdrawal successful", 
                    Amount = request.Amount,
                    NewBalance = newBalance 
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing withdrawal");
                return StatusCode(500, "Internal server error");
            }
        }
    }
}