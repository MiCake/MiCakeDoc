---
title: 自动审计
description: 了解 MiCake 的自动审计功能，自动记录实体的创建和修改时间等信息
---

MiCake 提供了自动审计功能，可以自动记录实体的创建和修改时间等信息。

## 审计接口

MiCake 提供了两种审计接口风格：**泛型接口**（推荐）和**传统接口**（向后兼容）。

### 泛型审计接口（推荐）

#### IHasCreatedAt&lt;T&gt;

支持 `DateTime` 或 `DateTimeOffset` 类型的创建时间：

```csharp
// 使用 DateTimeOffset（推荐，支持时区）
public class Article : AggregateRoot<int>, IHasCreatedAt<DateTimeOffset>
{
    public string Title { get; private set; }
    public string Content { get; private set; }
    
    // 自动填充，包含时区信息
    public DateTimeOffset CreatedAt { get; set; }
}

// 使用 DateTime
public class Comment : AggregateRoot<int>, IHasCreatedAt<DateTime>
{
    public string Text { get; private set; }
    
    // 自动填充
    public DateTime CreatedAt { get; set; }
}
```

#### IHasUpdatedAt&lt;T&gt;

记录修改时间：

```csharp
public class Article : AggregateRoot<int>, 
    IHasCreatedAt<DateTimeOffset>, 
    IHasUpdatedAt<DateTimeOffset>
{
    public string Title { get; private set; }
    
    // 自动填充
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    
    public void UpdateTitle(string newTitle)
    {
        Title = newTitle;
        // UpdatedAt 会自动更新
    }
}
```

#### IHasAuditTimestamps&lt;T&gt;

完整的时间审计接口，组合了创建和修改时间：

```csharp
public class Product : AggregateRoot<int>, IHasAuditTimestamps<DateTimeOffset>
{
    public string Name { get; private set; }
    
    // 创建时间（包含时区）
    public DateTimeOffset CreatedAt { get; set; }
    
    // 修改时间（包含时区）
    public DateTimeOffset? UpdatedAt { get; set; }
}
```

### 传统审计接口（向后兼容）

传统接口使用 `DateTime` 类型，为了向后兼容保留：

```csharp
// IHasCreatedAt（等同于 IHasCreatedAt<DateTime>）
public class LegacyArticle : AggregateRoot<int>, IHasCreatedAt
{
    public DateTime CreatedAt { get; set; }
}

// IHasAuditTimestamps（等同于 IHasAuditTimestamps<DateTime>）
public class LegacyProduct : AggregateRoot<int>, IHasAuditTimestamps
{
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
```

:::tip
**推荐使用泛型接口和 DateTimeOffset**：
- `DateTimeOffset` 保留了时区信息，更适合跨时区应用
- 泛型接口提供更好的类型安全性和灵活性
- 传统接口仍然可用，不会有破坏性变更
:::

## 启用审计

审计功能默认已启用。你可以通过 `UseAudit` 扩展方法进行配置：

### 使用 AddMiCakeWithDefault

如果使用 `AddMiCakeWithDefault` 快速配置，可以通过 `AuditConfig` 进行设置：

```csharp
services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
{
    options.AuditConfig = audit =>
    {
        audit.UseAudit = true;  // 启用审计（默认为 true）
        audit.UseSoftDeletion = false;  // 是否启用软删除（默认为 false）
    };
});
```

### 使用 Builder 方式

如果使用 MiCake Builder 方式，可以调用 `UseAudit` 方法：

```csharp
var builder = services.AddMiCake<MyAppModule>();
builder.UseEFCore<MyDbContext>();
builder.UseAudit(opts => 
{
    opts.UseAudit = true;  // 启用审计（默认为 true）
    opts.UseSoftDeletion = true;  // 启用软删除
});
```

### 自定义时间提供者

从 MiCake 最新版本开始，审计时间通过 `TimeProvider` 提供，支持依赖注入：

```csharp
// 注册自定义 TimeProvider（用于测试或特殊时区）
services.AddSingleton<TimeProvider>(new FakeTimeProvider(fixedTime));

// 或使用系统默认 TimeProvider（已自动注册）
// 默认使用 TimeProvider.System，返回 UTC 时间
```

**测试场景示例：**

```csharp
public class FakeTimeProvider : TimeProvider
{
    private readonly DateTimeOffset _fixedTime;
    
    public FakeTimeProvider(DateTimeOffset fixedTime)
    {
        _fixedTime = fixedTime;
    }
    
    public override DateTimeOffset GetUtcNow() => _fixedTime;
}

// 在测试中使用
services.AddSingleton<TimeProvider>(
    new FakeTimeProvider(new DateTimeOffset(2025, 1, 21, 10, 30, 0, TimeSpan.Zero)));
```

## 自动填充

当保存实体时，审计字段会自动填充：

```csharp
// 创建实体
var article = new Article { Title = "My Article" };
await _articleRepository.AddAsync(article);
await _unitOfWork.CommitAsync();   // 提交时 CreatedAt 自动设置为当前时间

// 更新实体
article.UpdateTitle("New Title");
await _articleRepository.UpdateAsync(article);
await _unitOfWork.CommitAsync();   // 提交时 UpdatedAt 自动更新为当前时间
```

:::note
审计功能通过 `IAuditExecutor`（框架内部）和 `IAuditProvider` 实现，在**工作单元提交**（flush/commit）时自动触发。
:::

## 自定义审计提供者

MiCake 使用 `IAuditProvider` 接口来提供审计逻辑。默认实现是 `DefaultTimeAuditProvider`，负责设置创建和修改时间。

### 实现自定义审计提供者

```csharp
public class CustomAuditProvider : IAuditProvider
{
    private readonly ICurrentUser _currentUser;
    private readonly TimeProvider _timeProvider;
    
    public CustomAuditProvider(
        ICurrentUser currentUser,
        TimeProvider timeProvider)
    {
        _currentUser = currentUser;
        _timeProvider = timeProvider;
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
        var now = _timeProvider.GetUtcNow();
        
        // 支持 DateTimeOffset
        if (entity is IHasCreatedAt<DateTimeOffset> hasCreationTimeOffset)
        {
            hasCreationTimeOffset.CreatedAt = now;
        }
        // 支持 DateTime（向后兼容）
        else if (entity is IHasCreatedAt<DateTime> hasCreationTime)
        {
            hasCreationTime.CreatedAt = now.DateTime;
        }
        
        // 可以扩展自定义的审计字段
        if (entity is IHasCreationUser hasCreationUser)
        {
            hasCreationUser.CreatedBy = _currentUser.Id;
        }
    }
    
    private void SetModificationAudit(object entity)
    {
        var now = _timeProvider.GetUtcNow();
        
        // 支持 DateTimeOffset
        if (entity is IHasUpdatedAt<DateTimeOffset> hasModificationTimeOffset)
        {
            hasModificationTimeOffset.UpdatedAt = now;
        }
        // 支持 DateTime（向后兼容）
        else if (entity is IHasUpdatedAt<DateTime> hasModificationTime)
        {
            hasModificationTime.UpdatedAt = now.DateTime;
        }
        
        // 可以扩展自定义的审计字段
        if (entity is IHasModificationUser hasModificationUser)
        {
            hasModificationUser.ModifiedBy = _currentUser.Id;
        }
    }
}
```

### 注册自定义审计提供者

```csharp
public class MyAppModule : MiCakeModule
{
    public override void ConfigServices(ModuleConfigServiceContext context)
    {
        // 添加自定义审计提供者（会与默认的 DefaultTimeAuditProvider 一起工作）
        context.Services.AddScoped<IAuditProvider, CustomAuditProvider>();
        
        base.ConfigServices(context);
    }
}
```

:::tip
MiCake 支持多个 `IAuditProvider`，它们会按注册顺序依次执行。默认的 `DefaultTimeAuditProvider` 已经注册，你的自定义提供者会额外执行。
:::

## 最佳实践

### 1. 优先使用泛型接口和 DateTimeOffset

```csharp
// ✅ 推荐：使用泛型接口和 DateTimeOffset
public class Order : AggregateRoot<int>, IHasAuditTimestamps<DateTimeOffset>
{
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
}

// ✅ 只需要创建时间的实体
public class OrderItem : Entity<int>, IHasCreatedAt<DateTimeOffset>
{
    public DateTimeOffset CreatedAt { get; set; }
}

// ⚠️ 向后兼容：仍可使用 DateTime（不推荐用于新项目）
public class LegacyOrder : AggregateRoot<int>, IHasAuditTimestamps
{
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ✅ 不需要审计的实体可以不实现接口
public class OrderItemDetail : Entity<int>
{
    // 不需要审计字段
}
```

### 2. TimeProvider 依赖注入

```csharp
// ✅ 推荐：使用默认的 TimeProvider.System（已自动注册，返回 UTC 时间）
services.AddMiCakeWithDefault<MyAppModule, MyDbContext>();

// ✅ 测试场景：注入自定义 TimeProvider
services.AddSingleton<TimeProvider>(
    new FakeTimeProvider(new DateTimeOffset(2025, 1, 21, 10, 0, 0, TimeSpan.Zero)));

// ❌ 不推荐：不要使用已废弃的静态配置方式
// DefaultTimeAuditProvider.CurrentTimeProvider = () => DateTime.UtcNow;  // 已移除
```

### 3. 值对象使用 OwnsOne/OwnsMany

当聚合根包含值对象时，使用 EF Core 的 Owned Entity 配置：

```csharp
// ✅ 聚合根实现审计接口
public class Product : AggregateRoot<Guid>, IHasAuditTimestamps<DateTimeOffset>
{
    public Money Price { get; private set; }  // 值对象
    
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    
    public void UpdatePrice(string currency, decimal amount)
    {
        Price = new Money(currency, amount);
        // UpdatedAt 会自动更新
    }
}

// 值对象不需要审计接口
public class Money : ValueObject
{
    public string Currency { get; private set; }
    public decimal Amount { get; private set; }
    
    // ...
}

// DbContext 配置
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<Product>().OwnsOne(p => p.Price);
}
```

### 4. 结合软删除

```csharp
public class Product : AggregateRoot<int>, IAuditableWithSoftDeletion
{
    public string Name { get; private set; }
    
    // 审计字段
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    
    // 软删除字段
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}

// 启用软删除功能
builder.UseAudit(opts => opts.UseSoftDeletion = true);
```

## 审计接口对照

### 泛型接口（推荐）

| 接口                                   | 字段                   | 说明                                |
| -------------------------------------- | ---------------------- | ----------------------------------- |
| `IHasCreatedAt<T>`                     | `T CreatedAt`          | 创建时间（T 可为 DateTime 或 DateTimeOffset） |
| `IHasUpdatedAt<T>`                     | `T? UpdatedAt`         | 修改时间（T 可为 DateTime 或 DateTimeOffset） |
| `IHasAuditTimestamps<T>`               | 包含上述两个字段       | 创建和修改时间的组合接口            |
| `ISoftDeletable`                       | `bool IsDeleted`       | 软删除标记                          |
| `IHasDeletedAt<T>`                     | `T? DeletedAt`         | 删除时间（T 可为 DateTime 或 DateTimeOffset） |
| `IAuditableWithSoftDeletion<T>`        | 包含上述所有字段       | 完整审计信息（含软删除）            |

### 传统接口（向后兼容）

| 接口                         | 等同于                                | 说明                     |
| ---------------------------- | ------------------------------------- | ------------------------ |
| `IHasCreatedAt`              | `IHasCreatedAt<DateTime>`             | 创建时间                 |
| `IHasUpdatedAt`              | `IHasUpdatedAt<DateTime>`             | 修改时间                 |
| `IHasAuditTimestamps`        | `IHasAuditTimestamps<DateTime>`       | 创建和修改时间的组合接口 |
| `IHasDeletedAt`              | `IHasDeletedAt<DateTime>`             | 删除时间                 |
| `IAuditableWithSoftDeletion` | `IAuditableWithSoftDeletion<DateTime>`| 完整审计信息（含软删除） |

## 软删除

MiCake 提供了软删除功能，可以标记实体为已删除而不是物理删除。

### 启用软删除

```csharp
builder.UseAudit(opts => 
{
    opts.UseSoftDeletion = true;  // 启用软删除
});
```

### 使用软删除接口

```csharp
// 基本软删除
public class Article : AggregateRoot<int>, ISoftDeletable
{
    public bool IsDeleted { get; set; }
}

// 软删除 + 删除时间（使用 DateTimeOffset）
public class Order : AggregateRoot<int>, ISoftDeletable, IHasDeletedAt<DateTimeOffset>
{
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}

// 完整审计 + 软删除（推荐）
public class Product : AggregateRoot<int>, IAuditableWithSoftDeletion<DateTimeOffset>
{
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTimeOffset? DeletedAt { get; set; }
}

// 传统方式（向后兼容）
public class LegacyProduct : AggregateRoot<int>, IAuditableWithSoftDeletion
{
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedAt { get; set; }
}
```

## 查询示例

```csharp
// 查询最近创建的订单
public async Task<List<Order>> GetRecentOrders()
{
    return await _orderRepository.Query()
        .OrderByDescending(o => o.CreatedAt)
        .Take(10)
        .ToListAsync();
}

// 查询指定时间范围内修改的订单
public async Task<List<Order>> GetModifiedOrders(DateTime startDate, DateTime endDate)
{
    return await _orderRepository.Query()
        .Where(o => o.UpdatedAt >= startDate && o.UpdatedAt <= endDate)
        .ToListAsync();
}

// 查询未删除的产品（启用软删除时）
public async Task<List<Product>> GetActiveProducts()
{
    return await _productRepository.Query()
        .Where(p => !p.IsDeleted)
        .ToListAsync();
}
```

## 工作原理

MiCake 的审计功能通过以下组件实现：

1. **IAuditProvider**: 审计提供者接口，定义审计逻辑
2. **DefaultTimeAuditProvider**: 默认时间审计提供者，处理创建和修改时间
3. **IAuditExecutor**: 审计执行器（框架内部实现），负责调用所有注册的审计提供者
4. **AuditRepositoryLifetime**: Repository 生命周期钩子（框架内部实现），在工作单元提交（flush/commit）前自动执行审计

审计只对实现了 MiCake DDD 领域对象接口（如 `Entity`、`AggregateRoot`）的实体生效。

## 小结

MiCake 自动审计功能特点：

- **简单易用**: 实现接口即可启用审计，无需手动设置时间
- **泛型支持**: 支持 `DateTime` 和 `DateTimeOffset`，满足不同场景需求
- **时区友好**: 推荐使用 `DateTimeOffset`，保留时区信息，适合跨时区应用
- **依赖注入**: 通过 `TimeProvider` 注入，易于测试和自定义
- **智能审计**: 自动检测 Owned Entity 变更，更新父实体审计时间
- **自动触发**: 在工作单元提交（flush/commit）时自动填充审计字段
- **多提供者**: 支持注册多个审计提供者，按顺序执行
- **软删除支持**: 内置软删除功能，标记删除而非物理删除
- **类型安全**: 基于接口设计，编译时检查
- **向后兼容**: 传统非泛型接口仍然可用

核心接口（泛型）：
- `IHasCreatedAt<T>`: 创建时间
- `IHasUpdatedAt<T>`: 修改时间  
- `IHasAuditTimestamps<T>`: 完整时间审计
- `IHasDeletedAt<T>`: 删除时间
- `IAuditableWithSoftDeletion<T>`: 完整审计 + 软删除

传统接口（向后兼容）：
- `IHasCreatedAt`: 等同于 `IHasCreatedAt<DateTime>`
- `IHasUpdatedAt`: 等同于 `IHasUpdatedAt<DateTime>`
- `IHasAuditTimestamps`: 等同于 `IHasAuditTimestamps<DateTime>`
- `IAuditableWithSoftDeletion`: 等同于 `IAuditableWithSoftDeletion<DateTime>`
