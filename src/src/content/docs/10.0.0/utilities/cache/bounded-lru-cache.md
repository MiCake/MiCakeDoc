---
title: BoundedLruCache 缓存工具
description: 线程安全的 LRU 缓存实现，具有容量限制和可选的分段策略
slug: 10.0.0/utilities/cache/bounded-lru-cache
---

`BoundedLruCache<TKey, TValue>` 是一个线程安全的 LRU（Least Recently Used）缓存实现，具有容量限制和可选的分段策略。

## 命名空间

```csharp
using MiCake.Util.Cache;
```

## 构造函数

```csharp
public BoundedLruCache(
    int maxSize = 1000,           // 最大缓存条目数
    int? segments = null,          // 分段数（用于提高并发性能）
    bool useLockFreeApproximation = false  // 是否使用无锁近似算法
)
```

**参数说明：**

* `maxSize`: 最大缓存条目数，超过此数量时最久未使用的项会被移除
* `segments`: 分段数，用于提高并发性能。小缓存（\< 16）自动使用单段
* `useLockFreeApproximation`: 是否使用无锁近似算法，适合高并发场景

## 核心方法

### GetOrAdd - 获取或添加缓存项

```csharp
var cache = new BoundedLruCache<string, Product>(maxSize: 500);

var product = cache.GetOrAdd("product-1", key => 
{
    // 缓存未命中时执行
    return LoadProductFromDatabase(key);
});

// 异步版本
var product = await cache.GetOrAdd("product-1", async key =>
{
    return await LoadProductFromDatabaseAsync(key);
});
```

### TryGetValue - 尝试获取缓存项

```csharp
if (cache.TryGetValue("product-1", out var product))
{
    Console.WriteLine($"缓存命中: {product.Name}");
}
else
{
    Console.WriteLine("缓存未命中");
}
```

### AddOrUpdate - 添加或更新缓存项

```csharp
// 添加新项或更新已存在的项
cache.AddOrUpdate("product-1", newProduct);
```

### Remove - 移除缓存项

```csharp
bool removed = cache.Remove("product-1");
if (removed)
{
    Console.WriteLine("缓存项已移除");
}
```

### Clear - 清空缓存

```csharp
cache.Clear();
```

## 属性

| 属性 | 说明 |
|------|------|
| `Count` | 当前缓存项数量 |
| `MaxSize` | 最大容量 |

## 使用示例

### 基本用法

```csharp
// 创建缓存实例
var cache = new BoundedLruCache<int, Product>(maxSize: 1000);

// 获取或添加
var product = cache.GetOrAdd(productId, id => 
    _repository.FindAsync(id).Result);

// 检查是否存在
if (cache.TryGetValue(productId, out var cachedProduct))
{
    return cachedProduct;
}

// 使用完毕后释放
cache.Dispose();
```

### 高并发场景

```csharp
// 使用分段和无锁近似算法提高性能
var cache = new BoundedLruCache<string, Product>(
    maxSize: 10000,
    segments: 4,              // 4 个分段
    useLockFreeApproximation: true
);

// 并发安全的缓存操作
Parallel.For(0, 1000, i =>
{
    var product = cache.GetOrAdd($"product-{i}", key =>
    {
        return new Product { Id = i, Name = $"Product {i}" };
    });
});
```

### 在服务中使用

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

### 注册为单例

```csharp
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // 注册为单例
        context.Services.AddSingleton(sp => 
            new BoundedLruCache<string, CachedData>(maxSize: 1000));
        
        base.ConfigureServices(context);
    }
}
```

### 缓存失效策略

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
        // 定期清理过期项
        // 注意：BoundedLruCache 不支持内置过期，需要手动实现
    }
}
```

## LRU 工作原理

LRU（Least Recently Used）算法会自动移除最久未访问的缓存项：

```
缓存容量：3

1. 添加 A → [A]
2. 添加 B → [B, A]
3. 添加 C → [C, B, A]
4. 访问 A → [A, C, B]  // A 被移到最前面
5. 添加 D → [D, A, C]  // B 被移除（最久未使用）
```

## 分段策略

当缓存容量较大时，使用分段可以减少锁竞争：

```csharp
// 不分段（适合小缓存）
var smallCache = new BoundedLruCache<string, int>(maxSize: 100);

// 4 段（适合中等缓存）
var mediumCache = new BoundedLruCache<string, int>(
    maxSize: 1000,
    segments: 4
);

// 8 段（适合大缓存）
var largeCache = new BoundedLruCache<string, int>(
    maxSize: 10000,
    segments: 8
);
```

## 最佳实践

### 1. 合理设置容量

```csharp
// ✅ 正确：根据实际需求设置容量
var cache = new BoundedLruCache<int, Product>(
    maxSize: EstimateRequiredCapacity()
);

// ❌ 错误：容量过小导致频繁换出
var cache = new BoundedLruCache<int, Product>(maxSize: 10);

// ❌ 错误：容量过大占用过多内存
var cache = new BoundedLruCache<int, Product>(maxSize: 1000000);
```

### 2. 注册为单例

```csharp
// ✅ 正确：在 DI 容器中注册为单例
services.AddSingleton<BoundedLruCache<string, CachedData>>(sp =>
    new BoundedLruCache<string, CachedData>(maxSize: 1000));

// ❌ 错误：每次创建新实例
services.AddScoped<BoundedLruCache<string, CachedData>>(sp =>
    new BoundedLruCache<string, CachedData>(maxSize: 1000));
```

### 3. 及时释放资源

```csharp
// ✅ 正确：使用 using 或手动 Dispose
using (var cache = new BoundedLruCache<int, Data>(maxSize: 100))
{
    // 使用缓存
}

// 或
var cache = new BoundedLruCache<int, Data>(maxSize: 100);
try
{
    // 使用缓存
}
finally
{
    cache.Dispose();
}
```

### 4. 适合缓存不经常变化的数据

```csharp
// ✅ 适合缓存
- 配置数据
- 字典数据
- 产品信息
- 用户基本信息

// ❌ 不适合缓存
- 实时数据
- 频繁更新的数据
- 大对象（> 1MB）
```

### 5. 无锁模式下的幂等工厂

```csharp
// ⚠️ 无锁模式下，工厂方法可能被多次调用
var cache = new BoundedLruCache<int, Product>(
    maxSize: 1000,
    useLockFreeApproximation: true
);

// ✅ 正确：使用幂等工厂
cache.GetOrAdd(id, k => _repository.Find(k)); // 多次调用结果相同

// ❌ 错误：非幂等工厂
cache.GetOrAdd(id, k => 
{
    var product = new Product();
    product.Id = GenerateNewId(); // 每次调用生成不同 ID
    return product;
});
```

## 性能考虑

| 场景 | 配置建议 |
|------|----------|
| 小缓存（\< 100） | 默认配置即可 |
| 中等缓存（100-1000） | segments: 2-4 |
| 大缓存（> 1000） | segments: 4-8 |
| 极高并发 | useLockFreeApproximation: true |

## 注意事项

1. **容量限制**：当缓存满时，最久未访问的项会被自动移除
2. **分段策略**：小缓存（maxSize \< 16）使用单段以保证确定性 LRU 语义
3. **无锁模式**：工厂方法可能被多次调用，建议使用幂等工厂
4. **线程安全**：所有操作都是线程安全的
5. **内存管理**：及时释放不再使用的缓存实例
