---
title: Soft Delete Support
description: Learn about MiCake's soft delete feature, implementing logical deletion instead of physical deletion for easy data recovery and auditing
---

MiCake provides a soft delete feature that allows you to mark data as deleted instead of actually removing it from the database, making data recovery and auditing easy.

## What Is Soft Delete?

Soft Delete is a logical deletion approach that doesn't actually remove records from the database. Instead, it uses a marker field (such as `IsDeleted`) to indicate that a record has been deleted.

**Advantages:**
- Data can be recovered
- Complete data history is preserved
- Easy auditing and tracking
- Meets data retention requirements in certain industries

## Enabling Soft Delete

:::note
The soft delete feature must be explicitly enabled in the configuration; it is disabled by default.
:::

### Configuring Soft Delete

Use the `UseAudit` method to enable the soft delete feature:

```csharp
// Using AddMiCakeWithDefault
services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
{
    options.AuditConfig = audit =>
    {
        audit.UseSoftDeletion = true;  // Enable soft delete
    };
});

// Or use the Builder approach
var builder = services.AddMiCake<MyAppModule>();
builder.UseEFCore<MyDbContext>();
builder.UseAudit(opts => 
{
    opts.UseSoftDeletion = true;  // Enable soft delete
});
```

### Implementing the Soft Delete Interface

Implement the `ISoftDeletable` interface:

```csharp
using MiCake.Audit.SoftDeletion;

public class Product : AggregateRoot<int>, ISoftDeletable
{
    public string Name { get; private set; }
    public decimal Price { get; private set; }
    
    // Soft delete marker
    public bool IsDeleted { get; set; }

    private Product() { }

    public static Product Create(string name, decimal price)
    {
        return new Product
        {
            Name = name,
            Price = price,
            IsDeleted = false // Not deleted by default
        };
    }
}
```

### Combining with the Audit Feature

You can use soft delete and the audit feature together:

```csharp
using MiCake.Audit;
using MiCake.Audit.SoftDeletion;

// Using the combined interface
public class Order : AggregateRoot<int>, IAuditableWithSoftDeletion
{
    public string OrderNumber { get; private set; }
    
    // Audit fields
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // Soft delete fields
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }

    private Order() { }
}

// Or implement them separately
public class Product : AggregateRoot<int>, IHasAuditTimestamps, ISoftDeletable
{
    public string Name { get; private set; }
    
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
}
```

### Recording the Deletion Time

Implement the `IHasDeletedAt` interface to record the deletion time:

```csharp
using MiCake.Audit.SoftDeletion;

public class Article : AggregateRoot<int>, ISoftDeletable, IHasDeletedAt
{
    public string Title { get; private set; }
    public string Content { get; private set; }
    
    // Soft delete marker
    public bool IsDeleted { get; set; }
    
    // Deletion time
    public DateTime? DeletedAt { get; set; }
}
```

## Soft Delete Operations

### Deleting an Entity

```csharp
[HttpDelete("{id}")]
public async Task<IActionResult> DeleteProduct(int id)
{
    var product = await _productRepository.FindAsync(id);
    if (product == null)
        return NotFound();

    // Soft delete (not actually removed)
    await _productRepository.DeleteAsync(product);

    // Commit the unit of work (committed automatically at the request boundary in ASP.NET Core)
    await _unitOfWork.CommitAsync();

    // The IsDeleted field is set to true in the database
    // If IHasDeletedAt is implemented, DeletedAt is set to the current time

    return Ok();
}
```

### Query Filtering

MiCake automatically filters out soft-deleted data:

```csharp
// Automatically filters out deleted products
public async Task<List<Product>> GetAllProducts()
{
    // Only returns products where IsDeleted = false
    return await _productRepository.Query()
        .ToListAsync();
}

// Query a specific product
public async Task<Product?> GetProduct(int id)
{
    // Only non-deleted products can be found
    return await _productRepository.FindAsync(id);
}
```

## How It Works

### DbContext Configuration

MiCake automatically configures query filters for entities that implement the `ISoftDeletable` interface:

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
        
        // Apply MiCake conventions (including the soft delete filter)
        modelBuilder.UseMiCakeConventions();
    }
}
```

:::tip
The `UseMiCakeConventions()` method automatically configures global query filters for entities implementing `ISoftDeletable`, so no manual configuration is needed.
:::

### Global Query Filters

MiCake automatically adds global query filters for all entities implementing `ISoftDeletable`:

```csharp
// MiCake internal implementation (no need to add manually)
modelBuilder.Entity<Product>()
    .HasQueryFilter(e => !e.IsDeleted);

modelBuilder.Entity<Order>()
    .HasQueryFilter(e => !e.IsDeleted);
```

## Soft Delete Best Practices

### 1. Enable Soft Delete for Important Data

```csharp
// ✅ Enable soft delete for important data
public class Order : AggregateRoot<int>, ISoftDeletable
{
    public bool IsDeleted { get; set; }
}

public class Customer : AggregateRoot<int>, ISoftDeletable
{
    public bool IsDeleted { get; set; }
}

// ⚠️ Temporary data such as logs can skip soft delete
public class ApplicationLog : Entity<int>
{
    // Doesn't implement ISoftDeletable, can be deleted directly
}
```

### 2. Record the Deletion Time and Deleter

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

### 3. Cascade Soft Delete

Handling soft delete for related entities:

```csharp
public class Order : AggregateRoot<int>, ISoftDeletable
{
    private readonly List<OrderItem> _items = new();
    
    public bool IsDeleted { get; set; }
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    public void SoftDelete()
    {
        IsDeleted = true;
        
        // Cascade the soft delete to order items
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

### 4. Handling Unique Constraints

For fields with unique constraints, special handling may be needed after soft delete:

```csharp
public class User : AggregateRoot<int>, ISoftDeletable
{
    public string Email { get; private set; }
    public bool IsDeleted { get; set; }

    // Configure the unique index in DbContext
}

protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    base.OnModelCreating(modelBuilder);

    // Option 1: The unique index includes the IsDeleted field
    modelBuilder.Entity<User>()
        .HasIndex(e => new { e.Email, e.IsDeleted })
        .IsUnique();

    // Option 2: Use a filtered unique index (SQL Server)
    modelBuilder.Entity<User>()
        .HasIndex(e => e.Email)
        .IsUnique()
        .HasFilter("[IsDeleted] = 0");
}
```

### 5. Periodic Cleanup

Periodically clean up data that has been soft-deleted for a long time:

```csharp
public class DataCleanupService
{
    private readonly MyDbContext _dbContext;

    // Clean up data soft-deleted more than 30 days ago
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

:::note
The example calls `DbContext.SaveChangesAsync()` directly (bypassing repositories/UoW). Direct `DbContext` writes without a UoW are **allowed** with native EF Core semantics (implicit transaction, no rollback/lifecycle guarantees); use the ambient unit of work or `IStandaloneUnitOfWorkExecutor` when transactional guarantees are needed.
:::


## Important Notes

1. **Enable soft delete**: The soft delete feature must be explicitly enabled in the configuration (`UseSoftDeletion = true`)
2. **Query filtering**: Soft-deleted data does not appear in query results by default
3. **Include explicitly**: Use `IgnoreQueryFilters()` to include deleted data
4. **Unique constraints**: Pay attention to handling fields with unique constraints
5. **Cascade delete**: Consider soft delete handling for related entities
6. **Periodic cleanup**: Establish a periodic cleanup mechanism to avoid database bloat
7. **Permission control**: Restore and permanent delete operations should have appropriate permission control
8. **Convention configuration**: Make sure to call `modelBuilder.UseMiCakeConventions()` in the DbContext to apply the soft delete filter

## Soft Delete Interface Reference

| Interface | Fields | Description |
|-----------|--------|-------------|
| `ISoftDeletable` | `bool IsDeleted` | Soft delete marker |
| `IHasDeletedAt` | `DateTime? DeletedAt` | Deletion time |
| `IAuditableWithSoftDeletion` | Combines audit and soft delete | Includes `CreatedAt`, `UpdatedAt`, `IsDeleted`, `DeletedAt` |

## Summary

Features of the MiCake soft delete feature:

- **Logical deletion**: Marks deletion instead of physical deletion, data can be recovered
- **Simple configuration**: Implement the interface and enable the configuration to use it
- **Automatic filtering**: Deleted data is automatically filtered out in queries
- **Flexible control**: You can use `IgnoreQueryFilters()` to include deleted data
- **Audit integration**: Integrates perfectly with the audit feature, recording the deletion time
- **Convention over configuration**: Automatically applied through `UseMiCakeConventions()`

Core steps:
1. Enable it in the configuration: `opts.UseSoftDeletion = true`
2. Implement the interface on the entity: `ISoftDeletable` or `IAuditableWithSoftDeletion`
3. DbContext configuration: call `modelBuilder.UseMiCakeConventions()`
4. Use the Repository normally, soft delete takes effect automatically
