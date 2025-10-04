using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace dotnetproject.Models
{
    public class User
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public string Username { get; set; }
        public string Email { get; set; }
        public string PasswordHash { get; set; } 
    }

    public class RegisterRequest
    {
        [Required]
        public string Username { get; set; }
        [EmailAddress]
        public string Email { get; set; }
        [MinLength(3)]
        public string Password { get; set; }
    }

    public class LoginRequest
    {
        [EmailAddress]
        public string Email { get; set; }
        [MinLength(3)]
        public string Password { get; set; }
    }

}

