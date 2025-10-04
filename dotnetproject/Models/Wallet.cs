using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace dotnetproject.Models
{
    public class Wallet
    {
        [Key]
        public int UserId { get; set; }
        
        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; } = 0.00m;
        
        public User? User { get; set; }
    }
}