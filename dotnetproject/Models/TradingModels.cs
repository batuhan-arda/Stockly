using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace dotnetproject.Models
{
    public class Stock
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int StockId { get; set; }
        
        [Required]
        [StringLength(10)]
        public string Symbol { get; set; } = null!;
        
        [Required]
        [StringLength(255)]
        public string CompanyName { get; set; } = null!;
    }

    public class BuyOrder
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int BuyOrderId { get; set; }
        
        [Required]
        public int UserId { get; set; }
        
        [Required]
        public int StockId { get; set; }
        
        [Required]
        [Column(TypeName = "decimal(18,8)")]
        public decimal Quantity { get; set; }
        
        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PricePerUnit { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        [StringLength(20)]
        public string Status { get; set; } = "Active";
        
        public virtual User User { get; set; } = null!;
        public virtual Stock Stock { get; set; } = null!;
    }

    public class SellOrder
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int SellOrderId { get; set; }
        
        [Required]
        public int UserId { get; set; }
        
        [Required]
        public int StockId { get; set; }
        
        [Required]
        [Column(TypeName = "decimal(18,8)")]
        public decimal Quantity { get; set; }
        
        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PricePerUnit { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        [StringLength(20)]
        public string Status { get; set; } = "Active";
        
        public virtual User User { get; set; } = null!;
        public virtual Stock Stock { get; set; } = null!;
    }

    public class Holdings
    {
        [Required]
        public int UserId { get; set; }
        
        [Required]
        public int StockId { get; set; }
        
        [Required]
        [Column(TypeName = "decimal(18,8)")]
        public decimal QuantityOwned { get; set; }
        
        public virtual User User { get; set; } = null!;
        public virtual Stock Stock { get; set; } = null!;
    }

    public class Transaction
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int TransactionId { get; set; }
        
        [Required]
        public int BuyerUserId { get; set; }
        
        [Required]
        public int StockId { get; set; }
        
        [Required]
        [Column(TypeName = "decimal(18,8)")]
        public decimal Quantity { get; set; }
        
        [Required]
        [Column(TypeName = "decimal(18,2)")]
        public decimal PricePerUnit { get; set; }
        
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        
        public virtual User Buyer { get; set; } = null!;
        public virtual User Seller { get; set; } = null!;
        public virtual Stock Stock { get; set; } = null!;
    }

    public class CreateOrderRequest
    {
        [Required]
        [StringLength(10)]
        public string Symbol { get; set; } = null!;
        
        [Required]
        [Range(0.00000001, double.MaxValue, ErrorMessage = "Quantity must be greater than 0")]
        public decimal Quantity { get; set; }
        
        [Required]
        [Range(0.01, double.MaxValue, ErrorMessage = "Price must be greater than 0")]
        public decimal PricePerUnit { get; set; }
    }

    public class OrderResponse
    {
        public int OrderId { get; set; }
        public string OrderType { get; set; } = null!;
        public string Symbol { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public decimal Quantity { get; set; }
        public decimal PricePerUnit { get; set; }
        public decimal TotalValue => Quantity * PricePerUnit;
        public DateTime CreatedAt { get; set; }
        public string Status { get; set; } = null!;
    }

    public class HoldingResponse
    {
        public string Symbol { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public decimal QuantityOwned { get; set; }
        public decimal AveragePrice { get; set; }
        public decimal CurrentPrice { get; set; }
        public decimal TotalValue => QuantityOwned * CurrentPrice;
        public decimal GainLoss => (CurrentPrice - AveragePrice) * QuantityOwned;
        public decimal GainLossPercentage => AveragePrice > 0 ? ((CurrentPrice - AveragePrice) / AveragePrice) * 100 : 0;
    }

    public class TransactionResponse
    {
        public int TransactionId { get; set; }
        public string TransactionType { get; set; } = null!;
        public string Symbol { get; set; } = null!;
        public string CompanyName { get; set; } = null!;
        public decimal Quantity { get; set; }
        public decimal PricePerUnit { get; set; }
        public decimal TotalValue => Quantity * PricePerUnit;
        public DateTime Timestamp { get; set; }
        public string Status { get; set; } = "Completed";
    }

    public class PortfolioSummary
    {
        public decimal TotalValue { get; set; }
        public decimal TotalGainLoss { get; set; }
        public decimal TotalGainLossPercentage { get; set; }
        public List<HoldingResponse> Holdings { get; set; } = new List<HoldingResponse>();
    }

    public class MarketOrderRequest
    {
        [Required]
        [StringLength(10)]
        public string Symbol { get; set; } = null!;
        
        [Required]
        [Range(0.00000001, double.MaxValue, ErrorMessage = "Quantity must be greater than 0")]
        public decimal Quantity { get; set; }
        
        [Required]
        public string OrderType { get; set; } = null!;
    }

    public class CancelOrderRequest
    {
        [Required]
        public int OrderId { get; set; }
        
        [Required]
        public string OrderType { get; set; } = null!; // "Buy" or "Sell"
    }
}