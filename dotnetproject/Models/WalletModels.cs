using System.ComponentModel.DataAnnotations;

namespace dotnetproject.Models
{
    public class WalletTransactionRequest
    {
        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Amount must be greater than 0")]
        public decimal Amount { get; set; }
    }
}
