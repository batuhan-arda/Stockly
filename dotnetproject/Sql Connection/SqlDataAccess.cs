using dotnetproject.Models;
using Microsoft.Data.SqlClient;
using System.Data;

namespace dotnetproject.SqlConnection
{
    // SQL Connection Service Interface and Implementation
    public interface ISqlConnectionService
    {
        Task<Microsoft.Data.SqlClient.SqlConnection> CreateConnectionAsync();
    }

    public class SqlConnectionService : ISqlConnectionService
    {
        private readonly string _connectionString;

        public SqlConnectionService(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection") 
                ?? throw new ArgumentNullException("DefaultConnection not found in configuration");
        }

        public async Task<Microsoft.Data.SqlClient.SqlConnection> CreateConnectionAsync()
        {
            var connection = new Microsoft.Data.SqlClient.SqlConnection(_connectionString);
            await connection.OpenAsync();
            return connection;
        }
    }

    // User Repository Interface and Implementation
    public interface IUserRepository
    {
        Task<User?> GetUserByEmailAsync(string email);
        Task<bool> CreateUserAsync(User user);
        Task<bool> UserExistsByUsernameAsync(string username);
        Task<bool> UserExistsByEmailAsync(string email);
    }

    public class UserRepository : IUserRepository
    {
        private readonly ISqlConnectionService _connectionService;

        public UserRepository(ISqlConnectionService connectionService)
        {
            _connectionService = connectionService;
        }

        public async Task<User?> GetUserByEmailAsync(string email)
        {
            using var connection = await _connectionService.CreateConnectionAsync();
            
            var command = new SqlCommand("sp_GetUserByEmail", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@Email", email);
            
            using var reader = await command.ExecuteReaderAsync();
            
            if (await reader.ReadAsync())
            {
                return new User
                {
                    Id = reader.GetInt32("Id"),
                    Username = reader.GetString("Username"),
                    Email = reader.GetString("Email"),
                    PasswordHash = reader.GetString("PasswordHash")
                };
            }
            
            return null;
        }

        public async Task<bool> CreateUserAsync(User user)
        {
            using var connection = await _connectionService.CreateConnectionAsync();
            
            var command = new SqlCommand("sp_CreateUser", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@Username", user.Username);
            command.Parameters.AddWithValue("@Email", user.Email);
            command.Parameters.AddWithValue("@PasswordHash", user.PasswordHash);
            
            var result = await command.ExecuteScalarAsync();
            return result != null && Convert.ToInt32(result) > 0;
        }

        public async Task<bool> UserExistsByUsernameAsync(string username)
        {
            using var connection = await _connectionService.CreateConnectionAsync();
            
            var command = new SqlCommand("sp_CheckUserExistsByUsername", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@Username", username);
            
            var result = await command.ExecuteScalarAsync();
            return Convert.ToBoolean(result);
        }

        public async Task<bool> UserExistsByEmailAsync(string email)
        {
            using var connection = await _connectionService.CreateConnectionAsync();
            
            var command = new SqlCommand("sp_CheckUserExistsByEmail", connection)
            {
                CommandType = CommandType.StoredProcedure
            };
            
            command.Parameters.AddWithValue("@Email", email);
            
            var result = await command.ExecuteScalarAsync();
            return Convert.ToBoolean(result);
        }
    }

    // Database Initializer
    public class DatabaseInitializer
    {
        private readonly ISqlConnectionService _connectionService;
        private readonly IWebHostEnvironment _environment;

        public DatabaseInitializer(ISqlConnectionService connectionService, IWebHostEnvironment environment)
        {
            _connectionService = connectionService;
            _environment = environment;
        }

        public async Task InitializeDatabaseAsync()
        {
            var sqlFilePath = Path.Combine(_environment.ContentRootPath, "Sql Connection", "DatabaseSetup.sql");
            
            if (!File.Exists(sqlFilePath))
            {
                throw new FileNotFoundException($"SQL setup file not found.");
            }

            var sqlScript = await File.ReadAllTextAsync(sqlFilePath);
            
            using var connection = await _connectionService.CreateConnectionAsync();
            
            // Split by GO statements and execute each batch separately
            var batches = sqlScript.Split(new[] { "\nGO\n", "\nGO\r\n", "\r\nGO\r\n", "\r\nGO\n" }, 
                StringSplitOptions.RemoveEmptyEntries);
            
            foreach (var batch in batches)
            {
                if (!string.IsNullOrWhiteSpace(batch))
                {
                    using var command = new SqlCommand(batch.Trim(), connection);
                    await command.ExecuteNonQueryAsync();
                }
            }
        }
    }
}
