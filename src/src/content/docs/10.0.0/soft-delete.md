---
title: 软删除支持
description: 了解 MiCake 的软删除功能，实现逻辑删除而非物理删除，便于数据恢复和审计
slug: 10.0.0/soft-delete
---

MiCake 提供了软删除功能，允许您标记数据为已删除而不是真正从数据库中删除，便于数据恢复和审计。

## 什么是软删除？

软删除（Soft Delete）是一种逻辑删除方式，不会真正从数据库中删除记录，而是通过一个标记字段（如 `IsDeleted`）来标识该记录已被删除。

**优点：**

* 数据可恢复
* 保留完整的数据历史
* 便于审计和追踪
* 满足某些行业的数据保留要求

## 启用软删除

:::note
软删除功能需要在配置中显式启用，默认情况下是关闭的。
:::

### 配置软删除

使用 `UseAudit` 方法启用软删除功能：

```csharp
// 使用 AddMiCakeWithDefault
services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
{
    options.AuditConfig = audit =>
    {
        audit.UseSoftDeletion = true;  // 启用软删除
    };
});

// 或使用 Builder 方式
var builder = services.AddMiCake<MyAppModule>();
builder.UseEFCore<MyDbContext>();
builder.UseAudit(opts => 
{
    opts.UseSoftDeletion = true;  // 启用软删除
});
```

### 实现软删除接口

实现 `ISoftDeletable` 接口：

```csharp
using MiCake.Audit.SoftDeletion;

public class Product : AggregateRoot<int>, ISoftDeletable
{
    public string Name { get; private set; }
    public decimal Price { get; private set; }
    
    // 软删除标记
    public bool IsDeleted { get; set; }

    private Product() { }

    public static Product Create(string name, decimal price)
    {
        return new Product
        {
            Name = name,
            Price = price,
            IsDeleted = false // 默认未删除
        };
    }
}
```

### 结合审计功能

可以同时使用软删除和审计功能：

```csharp
using MiCake.Audit;
using MiCake.Audit.SoftDeletion;

// 使用组合接口
public class Order : AggregateRoot<int>, IAuditableWithSoftDeletion
{
    public string OrderNumber { get; private set; }
    
    // 审计字段
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // 软删除字段
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    private Order() { }
}

// 或分别实现
public class Product : AggregateRoot<int>, IHasAuditTimestamps, ISoftDeletable
{
    public string Name { get; private set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
}
```

### 记录删除时间

实现 `IHasDeletedAt` 接口可以记录删除时间：

```csharp
using MiCake.Audit.SoftDeletion;

public class Article : AggregateRoot<int>, ISoftDeletable, IHasDeletedAt
{
    public string Title { get; private set; }
    public string Content { get; private set; }
    
    // 软删除标记
    public bool IsDeleted { get; set; }
    
    // 删除时间
    public DateTime? DeletedAt { get; set; }
}
```

## 软删除操作

### 删除实体

```csharp
[HttpDelete("{id}")]
public async Task<IActionResult> DeleteProduct(int id)
{
    var product = await _productRepository.FindAsync(id);
    if (product == null)
        return NotFound();

    // 软删除（不会真正删除）
    await _productRepository.DeleteAsync(product);
    await _productRepository.SaveChangesAsync();

    // 数据库中 IsDeleted 字段会被设置为 true
    // 如果实现了 IHasDeletedAt，DeletedAt 会被设置为当前时间

    return Ok();
}
```

### 查询过滤

MiCake 会自动过滤已软删除的数据：

```csharp
// 自动过滤已删除的产品
public async Task<List<Product>> GetAllProducts()
{
    // 只返回 IsDeleted = false 的产品
    return await _productRepository.Query()
        .ToListAsync();
}

// 查询指定产品
public async Task<Product?> GetProduct(int id)
{
    // 只有未删除的产品才能被查到
    return await _productRepository.FindAsync(id);
}
```

## 工作原理

### DbContext 配置

MiCake 会自动为实现 `ISoftDeletable` 接口的实体配置查询过滤器：

```csharp
using MiCake.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

public class MyDbContext : MiCakeDbContext
{
    public DbSet<Product> Products { get; set; }
    public DbSet<Order> Orders { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // 应用 MiCake 约定（包括软删除过滤器）
        modelBuilder.UseMiCakeConventions();
    }
}
```

:::tip
`UseMiCakeConventions()` 方法会自动为实现 `ISoftDeletable` 的实体配置全局查询过滤器，无需手动配置。
:::

### 全局查询过滤器

MiCake 自动为所有实现 `ISoftDeletable` 的实体添加全局查询过滤器：

```csharp
// MiCake 内部实现（无需手动添加）
modelBuilder.Entity<Product>()
    .HasQueryFilter(e => !e.IsDeleted);

modelBuilder.Entity<Order>()
    .HasQueryFilter(e => !e.IsDeleted);
```

## 软删除最佳实践

### 1. 对重要数据启用软删除

```csharp
// ✅ 重要数据启用软删除
public class Order : AggregateRoot<int>, ISoftDeletable
{
    public bool IsDeleted { get; set; }
}

public class Customer : AggregateRoot<int>, ISoftDeletable
{
    public bool IsDeleted { get; set; }
}

// ⚠️ 日志等临时数据可以不使用软删除
public class ApplicationLog : Entity<int>
{
    // 不实现 ISoftDeletable，可以直接删除
}
```

### 2. 记录删除时间和删除人

```csharp
public interface IHasFullDeletion : ISoftDeletable, IHasDeletedAt
{
    int? DeleterId { get; set; }
}

public class Order : AggregateRoot<int>, IHasFullDeletion
{
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
    public int? DeleterId { get; set; }
}
```

### 3. 级联软删除

处理关联实体的软删除：

```csharp
public class Order : AggregateRoot<int>, ISoftDeletable
{
    private readonly List<OrderItem> _items = new();
    
    public bool IsDeleted { get; set; }
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    public void SoftDelete()
    {
        IsDeleted = true;
        
        // 级联软删除订单项
        foreach (var item in _items)
        {
            item.IsDeleted = true;
        }
    }
}

public class OrderItem : Entity<int>, ISoftDeletable
{
    public bool IsDeleted { get; set; }
}
```

### 4. 唯一性约束处理

对于有唯一性约束的字段，软删除后可能需要特殊处理：

```csharp
public class User : AggregateRoot<int>, ISoftDeletable
{
    public string Email { get; private set; }
    public bool IsDeleted { get; set; }

    // 在 DbContext 中配置唯一索引
}

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    // 方式 1：唯一索引包含 IsDeleted 字段
    modelBuilder.Entity<User>()
        .HasIndex(e => new { e.Email, e.IsDeleted })
        .IsUnique();

    // 方式 2：使用过滤的唯一索引（SQL Server）
    modelBuilder.Entity<User>()
        .HasIndex(e => e.Email)
        .IsUnique()
        .HasFilter("[IsDeleted] = 0");
}
```

### 5. 定期清理

定期清理长时间软删除的数据：

```csharp
public class DataCleanupService
{
    private readonly MyDbContext _dbContext;

    // 清理 30 天前软删除的数据
    public async Task CleanupOldDeletedData()
    {
        var thirtyDaysAgo = DateTime.UtcNow.AddDays(-30);

        var oldDeletedProducts = await _dbContext.Products
            .IgnoreQueryFilters()
            .Where(p => p.IsDeleted && p.DeletedAt < thirtyDaysAgo)
            .ToListAsync();

        _dbContext.Products.RemoveRange(oldDeletedProducts);
        await _dbContext.SaveChangesAsync();
    }
}
```

## 注意事项

1. **启用软删除**：软删除功能需要在配置中显式启用（`UseSoftDeletion = true`）
2. **查询过滤**：软删除的数据默认不会出现在查询结果中
3. **显式包含**：使用 `IgnoreQueryFilters()` 包含已删除数据
4. **唯一约束**：注意处理唯一性约束字段
5. **级联删除**：考虑关联实体的软删除处理
6. **定期清理**：建立定期清理机制，避免数据库膨胀
7. **权限控制**：恢复和永久删除操作应该有适当的权限控制
8. **约定配置**：确保在 DbContext 中调用 `modelBuilder.UseMiCakeConventions()` 以应用软删除过滤器

## 软删除接口对照表

| 接口 | 字段 | 说明 |
|------|------|------|
| `ISoftDeletable` | `bool IsDeleted` | 软删除标记 |
| `IHasDeletedAt` | `DateTime? DeletedAt` | 删除时间 |
| `IAuditableWithSoftDeletion` | 组合审计和软删除 | 包含 `CreatedAt`、`UpdatedAt`、`IsDeleted`、`DeletedAt` |

## 小结

MiCake 软删除功能特点：

* **逻辑删除**：标记删除而非物理删除，数据可恢复
* **配置简单**：实现接口并启用配置即可使用
* **自动过滤**：查询时自动过滤已删除数据
* **灵活控制**：可以使用 `IgnoreQueryFilters()` 包含已删除数据
* **审计集成**：与审计功能完美集成，记录删除时间
* **约定优于配置**：通过 `UseMiCakeConventions()` 自动应用配置

核心步骤：

1. 在配置中启用：`opts.UseSoftDeletion = true`
2. 实体实现接口：`ISoftDeletable` 或 `IAuditableWithSoftDeletion`
3. DbContext 配置：调用 `modelBuilder.UseMiCakeConventions()`
4. 使用 Repository 正常操作，软删除自动生效
