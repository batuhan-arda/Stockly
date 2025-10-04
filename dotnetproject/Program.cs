using dotnetproject.SqlConnection;
using dotnetproject.Services;
using dotnetproject.Hubs;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Register SQL Connection Services
builder.Services.AddScoped<ISqlConnectionService, SqlConnectionService>();
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<DatabaseInitializer>();

// Register HttpClient for external API calls
builder.Services.AddHttpClient();

// Add SignalR
builder.Services.AddSignalR();

// Register shared price cache service
builder.Services.AddSingleton<IPriceCacheService, PriceCacheService>();
// Register background service for stock price updates
builder.Services.AddHostedService<StockPriceService>();

// Register order processing background service
builder.Services.AddHostedService<OrderProcessingService>();

// JWT Authentication (using extension method)
builder.Services.AddJwtAuthentication(builder.Configuration);

// Register JWT Service
builder.Services.AddScoped<JwtService>();

// Register Trading Services and Repositories
builder.Services.AddScoped<dotnetproject.Repositories.ITradingRepository, dotnetproject.Repositories.TradingRepository>();
builder.Services.AddScoped<dotnetproject.Services.ITradingService, dotnetproject.Services.TradingService>();

// Register Rate Limiting
builder.Services.AddCustomRateLimiting();

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200") // Angular dev server
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Required for SignalR
    });
});

// Swagger with JWT support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo 
    { 
        Title = "Stock Trading Platform API", 
        Version = "v1",
        Description = "Real-time stock trading platform with live price updates, portfolio management, and automated order processing. Features JWT authentication, SignalR real-time communication, and background services for order execution."
    });
    
    // Add JWT Authentication to Swagger
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below. Example: 'Bearer eyJhbGciOiJIUzI1NiIs...'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });
    
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header
            },
            new string[] {}
        }
    });
});

var app = builder.Build();

// Initialize database and stored procedures
using (var scope = app.Services.CreateScope())
{
    var dbInitializer = scope.ServiceProvider.GetRequiredService<DatabaseInitializer>();
    await dbInitializer.InitializeDatabaseAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Stock Trading Platform API V1");
        c.RoutePrefix = "swagger";
    });
}

app.UseHttpsRedirection();

// Enable CORS
app.UseCors();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// Map SignalR hub
app.MapHub<StockHub>("/stockHub");

app.MapFallbackToFile("index.html");

app.Run();
