using Microsoft.AspNetCore.SignalR;

namespace dotnetproject.Hubs
{
    public class StockHub : Hub
    {
        private static readonly Dictionary<string, HashSet<string>> _symbolSubscriptions = new();
        private static readonly object _lock = new object();

        public async Task JoinStockGroup(string symbol)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"stock_{symbol}");
            
            lock (_lock)
            {
                if (!_symbolSubscriptions.ContainsKey(symbol))
                {
                    _symbolSubscriptions[symbol] = new HashSet<string>();
                }
                _symbolSubscriptions[symbol].Add(Context.ConnectionId);
            }
            
            // Notify the stock service that this symbol is now active
            await Clients.Others.SendAsync("SymbolActivated", symbol);
        }

        public async Task LeaveStockGroup(string symbol)
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"stock_{symbol}");
            
            bool shouldDeactivate = false;
            
            lock (_lock)
            {
                if (_symbolSubscriptions.ContainsKey(symbol))
                {
                    _symbolSubscriptions[symbol].Remove(Context.ConnectionId);
                    
                    // If no more subscribers, remove the symbol
                    if (_symbolSubscriptions[symbol].Count == 0)
                    {
                        _symbolSubscriptions.Remove(symbol);
                        shouldDeactivate = true;
                    }
                }
            }
            
            // Send notification outside the lock
            if (shouldDeactivate)
            {
                await Clients.Others.SendAsync("SymbolDeactivated", symbol);
            }
        }

        public static HashSet<string> GetActiveSymbols()
        {
            lock (_lock)
            {
                return new HashSet<string>(_symbolSubscriptions.Keys);
            }
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var symbolsToRemove = new List<string>();
            
            lock (_lock)
            {
                // Remove this connection from all symbol subscriptions
                foreach (var kvp in _symbolSubscriptions)
                {
                    kvp.Value.Remove(Context.ConnectionId);
                    if (kvp.Value.Count == 0)
                    {
                        symbolsToRemove.Add(kvp.Key);
                    }
                }
                
                // Remove symbols with no subscribers
                foreach (var symbol in symbolsToRemove)
                {
                    _symbolSubscriptions.Remove(symbol);
                }
            }
            
            // Send notifications outside the lock
            foreach (var symbol in symbolsToRemove)
            {
                await Clients.Others.SendAsync("SymbolDeactivated", symbol);
            }
            
            await base.OnDisconnectedAsync(exception);
        }
    }
}
