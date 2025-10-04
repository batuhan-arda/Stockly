using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace dotnetproject.Services
{
    public static class RateLimitingConfig
    {
        public static IServiceCollection AddCustomRateLimiting(this IServiceCollection services)
        {
            services.AddRateLimiter(options =>
            {
                // Login-specific policy (pre log in)
                options.AddPolicy("LoginRegisterPolicy", context =>
                    RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 10,                // 10 requests
                            Window = TimeSpan.FromMinutes(1), // per 1 minute
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        }));

                // User-level policy (logged in)
                options.AddPolicy("UserPolicy", context =>
                {
                    var userId = context.User?.FindFirst("UserId")?.Value ?? "anonymous";
                    return RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: userId,
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 100,               // 100 requests
                            Window = TimeSpan.FromMinutes(1), // per 1 minutes
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });

                // Trading-specific policy (more restrictive for financial operations)
                options.AddPolicy("TradingPolicy", context =>
                {
                    var userId = context.User?.FindFirst("UserId")?.Value ?? "anonymous";
                    return RateLimitPartition.GetFixedWindowLimiter(
                        partitionKey: $"trading_{userId}",
                        factory: _ => new FixedWindowRateLimiterOptions
                        {
                            PermitLimit = 30,                // 30 trading operations
                            Window = TimeSpan.FromMinutes(1), // per 1 minute
                            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                            QueueLimit = 0
                        });
                });

                // On Too Many Requests, Send 429 instead of 503
                options.OnRejected = async (context, token) =>
                {
                    context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                    context.HttpContext.Response.ContentType = "application/json";

                    await context.HttpContext.Response.WriteAsync(
                        "{\"error\": \"Too many requests. Please wait before retrying.\"}",
                        token);
                };


            });

            return services;
        }
    }
}
