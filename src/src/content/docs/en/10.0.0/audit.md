---
title: Automatic Audit
description: Learn about MiCake's automatic auditing feature, which
  automatically records entity creation and modification timestamps
slug: en/10.0.0/audit
---

MiCake provides an automatic auditing feature that automatically records information such as entity creation and modification times.

## Audit Interfaces

### IHasCreatedAt

Records the creation time:

```csharp
public class Article : AggregateRoot<int>, IHasCreatedAt
{
    public string Title { get; private set; }
    public string Content { get; private set; }
    
    // Automatically filled
    public DateTime CreatedAt { get; set; }
}
```

### IHasUpdatedAt

Records the modification time:

```csharp
public class Article : AggregateRoot<int>, IHasCreatedAt, IHasUpdatedAt
{
    public string Title { get; private set; }
    
    // Automatically filled
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    public void UpdateTitle(string newTitle)
    {
        Title = newTitle;
        // UpdatedAt is updated automatically
    }
}
```

### IHasAuditTimestamps

A complete timestamp audit interface that combines creation and modification times:

```csharp
public class Product : AggregateRoot<int>, IHasAuditTimestamps
{
    public string Name { get; private set; }
    
    // Creation time
    public DateTime CreatedAt { get; set; }
    
    // Modification time
    public DateTime? UpdatedAt { get; set; }
}
```

## Enabling Auditing

Auditing is enabled by default. You can configure it through the `UseAudit` extension method:

### Using AddMiCakeWithDefault

If you use the `AddMiCakeWithDefault` quick configuration, you can set it up via `AuditConfig`:

```csharp
services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
{
    options.AuditConfig = audit =>
    {
        audit.UseAudit = true;  // Enable auditing (default is true)
        audit.UseSoftDeletion = false;  // Whether to enable soft deletion (default is false)
        audit.AuditTimeProvider = () => DateTime.UtcNow;  // Custom time provider
    };
});
```

### Using the Builder Approach

If you use the MiCake Builder approach, you can call the `UseAudit` method:

```csharp
var builder = services.AddMiCake<MyAppModule>();
builder.UseEFCore<MyDbContext>();
builder.UseAudit(opts => 
{
    opts.UseAudit = true;  // Enable auditing (default is true)
    opts.UseSoftDeletion = true;  // Enable soft deletion
    opts.AuditTimeProvider = () => DateTime.UtcNow;  // Custom time provider
});
```

## Automatic Filling

When entities are saved, the audit fields are filled automatically:

```csharp
// Create an entity
var article = new Article { Title = "My Article" };
await _articleRepository.AddAsync(article);
await _articleRepository.SaveChangesAsync();
// CreatedAt is automatically set to the current time

// Update an entity
article.UpdateTitle("New Title");
await _articleRepository.UpdateAsync(article);
await _articleRepository.SaveChangesAsync();
// UpdatedAt is automatically updated to the current time
```

:::note
The auditing feature is implemented through `IAuditExecutor` and `IAuditProvider`, and is triggered automatically in the Repository's `SaveChangesAsync`.
:::

## Custom Audit Providers

MiCake uses the `IAuditProvider` interface to provide audit logic. The default implementation is `DefaultTimeAuditProvider`, which is responsible for setting creation and modification times.

### Implementing a Custom Audit Provider

```csharp
public class CustomAuditProvider : IAuditProvider
{
    private readonly ICurrentUser _currentUser;
    
    public CustomAuditProvider(ICurrentUser currentUser)
    {
        _currentUser = currentUser;
    }
    
    public void ApplyAudit(AuditOperationContext context)
    {
        if (context?.Entity == null)
            return;

        switch (context.EntityState)
        {
            case RepositoryEntityStates.Added:
                SetCreationAudit(context.Entity);
                break;
                
            case RepositoryEntityStates.Modified:
                SetModificationAudit(context.Entity);
                break;
        }
    }
    
    private void SetCreationAudit(object entity)
    {
        if (entity is IHasCreatedAt hasCreationTime)
        {
            hasCreationTime.CreatedAt = DateTime.UtcNow;
        }
        
        // You can extend with custom audit fields
        if (entity is IHasCreationUser hasCreationUser)
        {
            hasCreationUser.CreatedBy = _currentUser.Id;
        }
    }
    
    private void SetModificationAudit(object entity)
    {
        if (entity is IHasUpdatedAt hasModificationTime)
        {
            hasModificationTime.UpdatedAt = DateTime.UtcNow;
        }
        
        // You can extend with custom audit fields
        if (entity is IHasModificationUser hasModificationUser)
        {
            hasModificationUser.ModifiedBy = _currentUser.Id;
        }
    }
}
```

### Registering a Custom Audit Provider

```csharp
public class MyAppModule : MiCakeModule
{
    public override void ConfigServices(ModuleConfigServiceContext context)
    {
        // Add a custom audit provider (it will work alongside the default DefaultTimeAuditProvider)
        context.Services.AddScoped<IAuditProvider, CustomAuditProvider>();
        
        base.ConfigServices(context);
    }
}
```

:::tip
MiCake supports multiple `IAuditProvider`s, which are executed in registration order. The default `DefaultTimeAuditProvider` is already registered, and your custom providers will be executed additionally.
:::

## Best Practices

### 1. Implement Interfaces for Entities That Need Auditing

```csharp
// ✅ An entity that needs full auditing
public class Order : AggregateRoot<int>, IHasAuditTimestamps
{
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ✅ An entity that only needs a creation time
public class OrderItem : Entity<int>, IHasCreatedAt
{
    public DateTime CreatedAt { get; set; }
}

// ✅ An entity that doesn't need auditing can skip the interfaces
public class OrderItemDetail : Entity<int>
{
    // No audit fields needed
}
```

### 2. Use UTC Time

```csharp
// ✅ Use UTC time (recommended)
services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
{
    options.AuditConfig = audit =>
    {
        audit.AuditTimeProvider = () => DateTime.UtcNow;
    };
});

// Or use the default configuration (the default is UTC time)
services.AddMiCakeWithDefault<MyAppModule, MyDbContext>();
```

### 3. Custom Time Providers

If you need a specific time zone or a fixed time for testing:

```csharp
// Use local time
builder.UseAudit(opts => 
{
    opts.AuditTimeProvider = () => DateTime.Now;
});

// Or use the static property configuration (suitable for tests)
DefaultTimeAuditProvider.CurrentTimeProvider = () => new DateTime(2025, 1, 1);
```

### 4. Combining with Soft Deletion

```csharp
public class Product : AggregateRoot<int>, IAuditableWithSoftDeletion
{
    public string Name { get; private set; }
    
    // Audit fields
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // Soft deletion fields
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

// Enable the soft deletion feature
builder.UseAudit(opts => opts.UseSoftDeletion = true);
```

## Audit Interface Reference

| Interface                   | Field                 | Description                      |
| --------------------------- | --------------------- | -------------------------------- |
| `IHasCreatedAt`             | `DateTime CreatedAt`  | Creation time                    |
| `IHasUpdatedAt`             | `DateTime? UpdatedAt` | Modification time                |
| `IHasAuditTimestamps`       | Includes the two above fields | Combined creation and modification time interface |
| `ISoftDeletable`            | `bool IsDeleted`      | Soft deletion marker             |
| `IHasDeletedAt`             | `DateTime? DeletedAt` | Deletion time                    |
| `IAuditableWithSoftDeletion`| Includes all of the above fields | Full audit information (including soft deletion) |

## Soft Deletion

MiCake provides a soft deletion feature that marks entities as deleted instead of physically deleting them.

### Enabling Soft Deletion

```csharp
builder.UseAudit(opts => 
{
    opts.UseSoftDeletion = true;  // Enable soft deletion
});
```

### Using the Soft Deletion Interfaces

```csharp
// Basic soft deletion
public class Article : AggregateRoot<int>, ISoftDeletable
{
    public bool IsDeleted { get; set; }
}

// Soft deletion + deletion time
public class Order : AggregateRoot<int>, ISoftDeletable, IHasDeletedAt
{
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

// Full audit + soft deletion
public class Product : AggregateRoot<int>, IAuditableWithSoftDeletion
{
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
```

## Query Examples

```csharp
// Query the most recently created orders
public async Task<List<Order>> GetRecentOrders()
{
    return await _orderRepository.Query()
        .OrderByDescending(o => o.CreatedAt)
        .Take(10)
        .ToListAsync();
}

// Query orders modified within a specified time range
public async Task<List<Order>> GetModifiedOrders(DateTime startDate, DateTime endDate)
{
    return await _orderRepository.Query()
        .Where(o => o.UpdatedAt >= startDate && o.UpdatedAt <= endDate)
        .ToListAsync();
}

// Query non-deleted products (when soft deletion is enabled)
public async Task<List<Product>> GetActiveProducts()
{
    return await _productRepository.Query()
        .Where(p => !p.IsDeleted)
        .ToListAsync();
}
```

## How It Works

MiCake's auditing feature is implemented through the following components:

1. **IAuditProvider**: The audit provider interface, which defines audit logic
2. **DefaultTimeAuditProvider**: The default time audit provider, which handles creation and modification times
3. **IAuditExecutor**: The audit executor, which invokes all registered audit providers
4. **AuditRepositoryLifetime**: A Repository lifecycle hook that automatically executes auditing before `SaveChangesAsync`

Auditing only takes effect on entities that implement MiCake's DDD domain object interfaces (such as `Entity` and `AggregateRoot`).

## Summary

Features of the MiCake automatic auditing feature:

* **Easy to use**: Implement an interface to enable auditing, no manual time setting required
* **Flexible configuration**: Supports custom time providers and audit providers
* **Automatic triggering**: Audit fields are filled automatically on `SaveChangesAsync`
* **Multiple providers**: Supports registering multiple audit providers, executed in order
* **Soft deletion support**: Built-in soft deletion, marks deletion instead of physical deletion
* **Type safety**: Interface-based design, checked at compile time

Core interfaces:

* `IHasCreatedAt`: Creation time
* `IHasUpdatedAt`: Modification time
* `IHasAuditTimestamps`: Complete time auditing
* `IAuditableWithSoftDeletion`: Full auditing + soft deletion
