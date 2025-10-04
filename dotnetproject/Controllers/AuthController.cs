using dotnetproject.SqlConnection;
using dotnetproject.Models;
using dotnetproject.Services;
using dotnetproject.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _userRepository;
    private readonly ITradingRepository _tradingRepository;
    private readonly JwtService _jwtService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IUserRepository userRepository, ITradingRepository tradingRepository, JwtService jwtService, ILogger<AuthController> logger)
    {
        _userRepository = userRepository;
        _tradingRepository = tradingRepository;
        _jwtService = jwtService;
        _logger = logger;
    }

    [EnableRateLimiting("LoginRegisterPolicy")]
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        try
        {
            // Check if username already exists
            if (await _userRepository.UserExistsByUsernameAsync(request.Username))
            {
                return BadRequest("Username already exists");
            }

            // Check if email already exists
            if (await _userRepository.UserExistsByEmailAsync(request.Email))
            {
                return BadRequest("Email already exists");
            }

            var hashedPassword = BCrypt.Net.BCrypt.HashPassword(request.Password);

            var user = new User
            {
                Username = request.Username,
                Email = request.Email,
                PasswordHash = hashedPassword
            };

            var success = await _userRepository.CreateUserAsync(user);
            
            if (success)
            {
                // Get the created user to get the ID
                var createdUser = await _userRepository.GetUserByEmailAsync(request.Email);
                
                if (createdUser != null)
                {
                    // Create wallet with initial balance of $10,000
                    await _tradingRepository.UpdateUserBalanceAsync(createdUser.Id, 10000.00m, false);
                    _logger.LogInformation($"Created wallet for user {createdUser.Id} with initial balance $10,000");
                }
                
                return Ok("User registered successfully");
            }
            else
            {
                return StatusCode(500, "Failed to create user");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during user registration");
            return StatusCode(500, "An error occurred during registration");
        }
    }

    [EnableRateLimiting("LoginRegisterPolicy")]
    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var user = await _userRepository.GetUserByEmailAsync(request.Email);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Invalid email or password");

        var token = _jwtService.GenerateToken(user);

        return Ok(new { token });
    }
}
