---
title: BoundedLruCache Cache Utility
description: A thread-safe LRU cache implementation with capacity limits and an optional segment strategy
---

`BoundedLruCache<TKey, TValue>` is a thread-safe LRU (Least Recently Used) cache implementation with capacity limits and an optional segment strategy.

## Namespace

```csharp
using MiCake.Util.Cache;
```

## Constructor

```csharp
public BoundedLruCache(
    int maxSize = 1000,           // Maximum number of cache entries
    int? segments = null,          // Number of segments (to improve concurrency performance)
    bool useLockFreeApproximation = false  // Whether to use the lock-free approximation algorithm
)
```

**Parameter description:**
- `maxSize`: the maximum number of cache entries. When this number is exceeded, the least recently used items are removed
- `segments`: the number of segments, used to improve concurrency performance. Small caches (< 16) automatically use a single segment
- `useLockFreeApproximation`: whether to use the lock-free approximation algorithm, suitable for high-concurrency scenarios

## Core Methods

### GetOrAdd - Get or Add a Cache Item

```csharp
var cache = new BoundedLruCache<string, Product>(maxSize: 500);

var product = cache.GetOrAdd("product-1", key => 
{
    // Executed on a cache miss
    return LoadProductFromDatabase(key);
});

// Async version
var product = await cache.GetOrAdd("product-1", async key =>
{
    return await LoadProductFromDatabaseAsync(key);
});
```

### TryGetValue - Try to Get a Cache Item

```csharp
if (cache.TryGetValue("product-1", out var product))
{
    Console.WriteLine($"Cache hit: {product.Name}");
}
else
{
    Console.WriteLine("Cache miss");
}
```

### AddOrUpdate - Add or Update a Cache Item

```csharp
// Add a new item or update an existing one
cache.AddOrUpdate("product-1", newProduct);
```

### Remove - Remove a Cache Item

```csharp
bool removed = cache.Remove("product-1");
if (removed)
{
    Console.WriteLine("Cache item removed");
}
```

### Clear - Clear the Cache

```csharp
cache.Clear();
```

## Properties

| Property | Description |
|----------|-------------|
| `Count` | The current number of cache items |
| `MaxSize` | The maximum capacity |

## Usage Examples

### Basic Usage

```csharp
// Create a cache instance
var cache = new BoundedLruCache<int, Product>(maxSize: 1000);

// Get or add
var product = cache.GetOrAdd(productId, id => 
    _repository.FindAsync(id).Result);

// Check whether it exists
if (cache.TryGetValue(productId, out var cachedProduct))
{
    return cachedProduct;
}

// Dispose after use
cache.Dispose();
```

### High-Concurrency Scenarios

```csharp
// Use segments and the lock-free approximation algorithm to improve performance
var cache = new BoundedLruCache<string, Product>(
    maxSize: 10000,
    segments: 4,              // 4 segments
    useLockFreeApproximation: true
);

// Thread-safe cache operations
Parallel.For(0, 1000, i =>
{
    var product = cache.GetOrAdd($"product-{i}", key =>
    {
        return new Product { Id = i, Name = $"Product {i}" };
    });
});
```

### Using in a Service

```csharp
public class ProductService : IScopedService
{
    private readonly BoundedLruCache<int, Product> _cache;
    private readonly IRepository<Product, int> _repository;
    
    public ProductService(IRepository<Product, int> repository)
    {
        _repository = repository;
        _cache = new BoundedLruCache<int, Product>(maxSize: 500);
    }
    
    public async Task<Product> GetProduct(int id)
    {
        return await _cache.GetOrAdd(id, async productId =>
        {
            var product = await _repository.FindAsync(productId);
            if (product == null)
                throw new NotFoundException("Product", productId);
            return product;
        });
    }
    
    public void InvalidateCache(int productId)
    {
        _cache.Remove(productId);
    }
    
    public void ClearCache()
    {
        _cache.Clear();
    }
}
```

### Registering as a Singleton

```csharp
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // Register as a singleton
        context.Services.AddSingleton(sp => 
            new BoundedLruCache<string, CachedData>(maxSize: 1000));
        
        base.ConfigureServices(context);
    }
}
```

### Cache Invalidation Strategy

```csharp
public class CacheService
{
    private readonly BoundedLruCache<string, CachedItem> _cache;
    
    public CacheService()
    {
        _cache = new BoundedLruCache<string, CachedItem>(maxSize: 1000);
    }
    
    public CachedItem GetOrCreate(string key, TimeSpan expiration)
    {
        return _cache.GetOrAdd(key, k =>
        {
            var item = new CachedItem
            {
                Data = LoadData(k),
                ExpiresAt = DateTime.UtcNow.Add(expiration)
            };
            return item;
        });
    }
    
    public void RemoveExpired()
    {
        // Periodically clean up expired items
        // Note: BoundedLruCache does not support built-in expiration, this needs to be implemented manually
    }
}
```

## How LRU Works

The LRU (Least Recently Used) algorithm automatically removes the least recently accessed cache items:

```
Cache capacity: 3

1. Add A → [A]
2. Add B → [B, A]
3. Add C → [C, B, A]
4. Access A → [A, C, B]  // A is moved to the front
5. Add D → [D, A, C]  // B is removed (least recently used)
```

## Segment Strategy

When the cache capacity is large, using segments can reduce lock contention:

```csharp
// No segments (suitable for small caches)
var smallCache = new BoundedLruCache<string, int>(maxSize: 100);

// 4 segments (suitable for medium caches)
var mediumCache = new BoundedLruCache<string, int>(
    maxSize: 1000,
    segments: 4
);

// 8 segments (suitable for large caches)
var largeCache = new BoundedLruCache<string, int>(
    maxSize: 10000,
    segments: 8
);
```

## Best Practices

### 1. Set the Capacity Reasonably

```csharp
// ✅ Correct: set the capacity based on actual requirements
var cache = new BoundedLruCache<int, Product>(
    maxSize: EstimateRequiredCapacity()
);

// ❌ Wrong: capacity too small causes frequent eviction
var cache = new BoundedLruCache<int, Product>(maxSize: 10);

// ❌ Wrong: capacity too large consumes too much memory
var cache = new BoundedLruCache<int, Product>(maxSize: 1000000);
```

### 2. Register as a Singleton

```csharp
// ✅ Correct: register as a singleton in the DI container
services.AddSingleton<BoundedLruCache<string, CachedData>>(sp =>
    new BoundedLruCache<string, CachedData>(maxSize: 1000));

// ❌ Wrong: create a new instance every time
services.AddScoped<BoundedLruCache<string, CachedData>>(sp =>
    new BoundedLruCache<string, CachedData>(maxSize: 1000));
```

### 3. Release Resources Promptly

```csharp
// ✅ Correct: use using or call Dispose manually
using (var cache = new BoundedLruCache<int, Data>(maxSize: 100))
{
    // Use the cache
}

// Or
var cache = new BoundedLruCache<int, Data>(maxSize: 100);
try
{
    // Use the cache
}
finally
{
    cache.Dispose();
}
```

### 4. Cache Data That Doesn't Change Frequently

```csharp
// ✅ Suitable for caching
- Configuration data
- Dictionary data
- Product information
- Basic user information

// ❌ Not suitable for caching
- Real-time data
- Frequently updated data
- Large objects (> 1MB)
```

### 5. Idempotent Factories in Lock-Free Mode

```csharp
// ⚠️ In lock-free mode, the factory method may be called multiple times
var cache = new BoundedLruCache<int, Product>(
    maxSize: 1000,
    useLockFreeApproximation: true
);

// ✅ Correct: use an idempotent factory
cache.GetOrAdd(id, k => _repository.Find(k)); // multiple calls return the same result

// ❌ Wrong: a non-idempotent factory
cache.GetOrAdd(id, k => 
{
    var product = new Product();
    product.Id = GenerateNewId(); // generates a different ID on each call
    return product;
});
```

## Performance Considerations

| Scenario | Configuration suggestion |
|----------|--------------------------|
| Small cache (< 100) | Default configuration is fine |
| Medium cache (100-1000) | segments: 2-4 |
| Large cache (> 1000) | segments: 4-8 |
| Extremely high concurrency | useLockFreeApproximation: true |

## Important Notes

1. **Capacity limit**: when the cache is full, the least recently accessed items are automatically removed
2. **Segment strategy**: small caches (maxSize < 16) use a single segment to guarantee deterministic LRU semantics
3. **Lock-free mode**: the factory method may be called multiple times, it is recommended to use an idempotent factory
4. **Thread safety**: all operations are thread-safe
5. **Memory management**: release cache instances that are no longer used promptly
