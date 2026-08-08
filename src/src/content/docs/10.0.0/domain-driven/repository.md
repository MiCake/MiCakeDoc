---
title: 仓储
description: 了解仓储模式在 MiCake 中的实现和最佳实践
slug: 10.0.0/domain-driven/repository
---

仓储（Repository）是领域驱动设计中用于封装数据访问逻辑的模式。在 MiCake 中，仓储提供了类似集合的接口来操作聚合根，隐藏了底层持久化的复杂性。

## 什么是仓储

仓储模式的核心思想：

* **抽象数据访问**：将数据访问逻辑与业务逻辑分离
* **面向聚合根**：只为聚合根提供仓储，不为内部实体创建仓储
* **类似集合**：提供类似集合的 API（Add、Remove、Find 等）
* **隐藏持久化细节**：业务层不需要知道数据如何存储

## 仓储接口

### IRepository 接口

MiCake 提供了 `IRepository<TAggregateRoot, TKey>` 接口：

```csharp
using MiCake.DDD.Domain;
using System.Threading;
using System.Threading.Tasks;

public interface IRepository<TAggregateRoot, TKey> 
    where TAggregateRoot : class, IAggregateRoot<TKey>
    where TKey : notnull
{
    // 查询
    IQueryable<TAggregateRoot> Query();
    Task<TAggregateRoot?> FindAsync(TKey id, CancellationToken cancellationToken = default);
    Task<long> GetCountAsync(CancellationToken cancellationToken = default);

    // 添加
    Task AddAsync(TAggregateRoot aggregateRoot, CancellationToken cancellationToken = default);
    Task<TAggregateRoot> AddAndReturnAsync(TAggregateRoot aggregateRoot, bool saveNow = true, CancellationToken cancellationToken = default);

    // 更新
    Task UpdateAsync(TAggregateRoot aggregateRoot, CancellationToken cancellationToken = default);

    // 删除
    Task DeleteAsync(TAggregateRoot aggregateRoot, CancellationToken cancellationToken = default);
    Task DeleteByIdAsync(TKey id, CancellationToken cancellationToken = default);

    // 保存
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

### IReadOnlyRepository 接口

只读仓储用于查询场景：

```csharp
public interface IReadOnlyRepository<TAggregateRoot, TKey>
    where TAggregateRoot : class, IAggregateRoot<TKey>
    where TKey : notnull
{
    IQueryable<TAggregateRoot> Query();
    Task<TAggregateRoot?> FindAsync(TKey id, CancellationToken cancellationToken = default);
    Task<long> GetCountAsync(CancellationToken cancellationToken = default);
}
```

## 自动注册仓储

当仓储接口和仓储的实现符合规则时，使用`AutoRegisterRepositories`扩展方法，MiCake 会自动为聚合根创建仓储实现，无需手动编写：

### 在模块中注册

```csharp
using MiCake.Core.Modularity;

public class OrderModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // 扫描程序集，自动为所有聚合根创建仓储
        context.AutoRegisterRepositories(typeof(OrderModule).Assembly);

        base.ConfigureServices(context);
    }
}
```

默认的规则为：

* 仓储接口命名为 `I{聚合根类名}Repository`，例如 `IOrderRepository`。
* 仓储实现命名为 `{聚合根类名}Repository`，例如 `OrderRepository`。

则 MiCake 会自动将 `IOrderRepository` 映射到 `OrderRepository`。

同时该方法接受一个类型为`CustomerRepositorySelector`的可选参数，用于自定义仓储选择规则，你可以根据自己的需求来实现该接口。例如：

```csharp
const customSelector = (repo, repoInterface, index) =>
{
    return repoInterface.Name.Contains(repo.Name);
};
```

### 使用仓储

```csharp
public class OrderService
{
    private readonly IOrderRepository _orderRepository;

    // 依赖注入自动注入仓储
    public OrderService(IOrderRepository orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task<Order> CreateOrder(CreateOrderDto dto)
    {
        var order = Order.Create(dto.CustomerId);
        
        foreach (var item in dto.Items)
        {
            order.AddItem(item.ProductId, item.Quantity, item.Price);
        }

        await _orderRepository.AddAsync(order);
        return order;
    }
}
```

## 仓储操作

### 1. 添加聚合根

```csharp
public async Task CreateOrder(CreateOrderDto dto)
{
    // 创建聚合根
    var order = Order.Create(dto.CustomerId);
    order.AddItem(dto.ProductId, dto.Quantity, dto.Price);

    // 添加到仓储
    await _orderRepository.AddAsync(order);

    // 保存更改
    await _orderRepository.SaveChangesAsync();
    // SaveChangesAsync 会：
    // 1. 持久化聚合根
    // 2. 自动派发领域事件
    // 3. 更新审计字段
}
```

### 2. 添加并返回（获取自增 ID）

```csharp
public async Task<Order> CreateOrderAndReturn(CreateOrderDto dto)
{
    var order = Order.Create(dto.CustomerId);
    order.AddItem(dto.ProductId, dto.Quantity, dto.Price);

    // 添加并立即保存，返回包含生成的 ID 的对象
    var savedOrder = await _orderRepository.AddAndReturnAsync(order, saveNow: true);

    Console.WriteLine($"New order ID: {savedOrder.Id}");
    return savedOrder;
}
```

### 3. 查询聚合根

```csharp
public async Task<Order?> GetOrder(int orderId)
{
    // 根据 ID 查询
    var order = await _orderRepository.FindAsync(orderId);
    return order;
}

public async Task<Order?> GetOrderWithItems(int orderId)
{
    // 包含导航属性
    var order = await _orderRepository.FindAsync(
        orderId,
        query => query.Include(o => o.Items)
    );
    return order;
}

public async Task<List<Order>> GetCustomerOrders(int customerId)
{
    // 使用 LINQ 查询，通常不建议在仓储外部使用 Query() 进行复杂查询，除非某些仅用于数据查询的场景
    var orders = await _orderRepository.Query()
        .Where(o => o.CustomerId == customerId)
        .Where(o => o.Status != OrderStatus.Cancelled)
        .OrderByDescending(o => o.OrderDate)
        .ToListAsync();

    return orders;
}
```

### 4. 更新聚合根

```csharp
public async Task UpdateOrder(int orderId, UpdateOrderDto dto)
{
    // 加载聚合根
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new DomainException("Order not found");

    // 通过聚合根方法修改
    order.UpdateShippingAddress(dto.ShippingAddress);
}
```

### 5. 删除聚合根

```csharp
public async Task DeleteOrder(int orderId)
{
    // 方式一：先加载再删除
    var order = await _orderRepository.FindAsync(orderId);
    if (order != null)
    {
        await _orderRepository.DeleteAsync(order);
        await _orderRepository.SaveChangesAsync();
    }

    // 方式二：直接通过 ID 删除
    await _orderRepository.DeleteByIdAsync(orderId);
    await _orderRepository.SaveChangesAsync();
}
```

## 复杂查询

复杂查询允许我们使用`IQueryable`对象进行灵活的数据查询操作，因此可以跳过在仓储中建立专门的方法。
但是请注意：如果过多的使用该方式来进行查询，会失去领域驱动设计中仓储模式的意义。因为在仓储下方的每一个数据查询，它都是具有"领域意义"的，比如"通过手机号获取用户"、"获取被标记为某状态的订单"等等。
通过这些领域意义的查询方法，我们可以更好地表达领域意图，而不是直接暴露数据查询的细节。

但是在某些场景下，为了适配UI显示或者数据分析，可能需要进行复杂查询。

### 使用 Query() 方法

```csharp
public class OrderQueryService
{
    private readonly IReadOnlyRepository<Order, int> _orderRepository;

    public async Task<List<OrderSummaryDto>> GetOrderSummaries(OrderFilterDto filter)
    {
        var query = _orderRepository.Query();

        // 应用过滤条件
        if (filter.CustomerId.HasValue)
            query = query.Where(o => o.CustomerId == filter.CustomerId.Value);

        if (filter.StartDate.HasValue)
            query = query.Where(o => o.OrderDate >= filter.StartDate.Value);

        if (filter.EndDate.HasValue)
            query = query.Where(o => o.OrderDate <= filter.EndDate.Value);

        if (filter.Status.HasValue)
            query = query.Where(o => o.Status == filter.Status.Value);

        // 投影到 DTO
        var result = await query
            .Select(o => new OrderSummaryDto
            {
                OrderId = o.Id,
                OrderDate = o.OrderDate,
                TotalAmount = o.TotalAmount,
                Status = o.Status
            })
            .OrderByDescending(o => o.OrderDate)
            .Skip(filter.Skip)
            .Take(filter.Take)
            .ToListAsync();

        return result;
    }

    public async Task<OrderStatisticsDto> GetOrderStatistics(int customerId)
    {
        var orders = _orderRepository.Query()
            .Where(o => o.CustomerId == customerId);

        var statistics = new OrderStatisticsDto
        {
            TotalOrders = await orders.CountAsync(),
            TotalAmount = await orders.SumAsync(o => o.TotalAmount),
            AverageAmount = await orders.AverageAsync(o => o.TotalAmount),
            CompletedOrders = await orders.CountAsync(o => o.Status == OrderStatus.Completed)
        };

        return statistics;
    }
}
```

### 包含导航属性

```csharp
public async Task<Order?> GetOrderWithFullDetails(int orderId)
{
    var order = await _orderRepository.Query()
        .Include(o => o.Items)
        .Include(o => o.ShippingAddress)
        .FirstOrDefaultAsync(o => o.Id == orderId);

    return order;
}
```

## 领域事件的自动派发

MiCake 在 `SaveChangesAsync` 时自动派发领域事件：

```csharp
public async Task SubmitOrder(int orderId)
{
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new DomainException("Order not found");

    // 调用业务方法，触发领域事件
    order.Submit();  // 内部调用 RaiseDomainEvent(new OrderSubmittedEvent(...))

    await _orderRepository.UpdateAsync(order);

    // SaveChangesAsync 时会自动：
    // 1. 持久化数据
    // 2. 收集聚合根上的所有领域事件
    // 3. 按顺序派发事件到对应的处理器
    // 4. 清除已派发的事件
    await _orderRepository.SaveChangesAsync();

    // 此时 OrderSubmittedEvent 已被处理
}
```

## 软删除支持

对于实现了 `ISoftDelete` 接口的聚合根，仓储会自动处理软删除：

```csharp
public class Product : AggregateRoot<int>, ISoftDelete
{
    public string Name { get; private set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedTime { get; set; }
}

// 使用仓储
public async Task DeleteProduct(int productId)
{
    var product = await _productRepository.FindAsync(productId);
    
    // 调用 DeleteAsync 会设置 IsDeleted = true
    await _productRepository.DeleteAsync(product);
    await _productRepository.SaveChangesAsync();
    
    // 产品未被物理删除，只是标记为已删除
}

// 查询时自动过滤软删除的数据
public async Task<List<Product>> GetActiveProducts()
{
    // Query() 自动添加 .Where(p => !p.IsDeleted) 过滤器
    var products = await _productRepository.Query()
        .Where(p => p.Price > 0)
        .ToListAsync();
    
    // 只返回未删除的产品
    return products;
}
```

## 审计支持

对于实现了审计接口的聚合根，仓储会自动填充审计字段：

```csharp
public class Article : AggregateRoot<int>, IHasCreationTime, IHasModificationTime
{
    public string Title { get; private set; }
    public DateTime CreatedTime { get; set; }  // 自动填充
    public DateTime? ModifiedTime { get; set; }  // 自动填充
}

// 创建时
var article = Article.Create("My Article");
await _articleRepository.AddAsync(article);
await _articleRepository.SaveChangesAsync();
// CreatedTime 自动设置为当前时间

// 更新时
article.UpdateTitle("New Title");
await _articleRepository.UpdateAsync(article);
await _articleRepository.SaveChangesAsync();
// ModifiedTime 自动更新为当前时间
```

## 仓储最佳实践

### 1. 只为聚合根创建仓储

```csharp
// ✅ 正确 - 为聚合根创建仓储
public class Order : AggregateRoot<int> { }
// 使用: IRepository<Order, int>

// ❌ 错误 - 不要为内部实体创建仓储
public class OrderItem : Entity<int> { }
// 不要: IRepository<OrderItem, int>

// ✅ 正确 - 通过聚合根访问内部实体
var order = await _orderRepository.FindAsync(orderId);
var items = order.Items;  // 通过聚合根访问
```

### 2. 基于领域意图设计查询方法

```csharp
// ✅ 正确 - 基于领域意图设计方法
public async Task<List<Order>> GetPendingOrdersByCustomer(int customerId)
{
    return await _orderRepository.Query()
        .Where(o => o.CustomerId == customerId && o.Status == OrderStatus.Pending)
        .ToListAsync();
}

// ❌ 错误 - 不要暴露数据查询细节
public async Task<List<Order>> GetOrdersByRawFilter(string filter)
{
    // 这种方法缺乏领域意义
    throw new NotImplementedException();
}
```

## 常见问题

### Q: 仓储何时会自动派发领域事件？

A: 在调用 `SaveChangesAsync()` 时自动派发聚合根上的所有待处理事件，如果使用了默认的`MiCake.AspNetCore`模块集成，当`MiCakeAspNetUowOption`的`IsAutoUowEnabled`选项被启用时（默认为true），`SaveChangesAsync()`会在每次HTTP请求结束时自动调用，无须用户手动操作。

### Q: Query() 和 FindAsync() 有什么区别？

A:

* `Query()` 返回 `IQueryable`，用于构建复杂查询
* `FindAsync()` 直接根据 ID 查询单个对象

## 小结

MiCake 的仓储模式：

* 只为聚合根创建仓储
* 自动注册，无需手动实现
* 提供类似集合的 API
* 自动派发领域事件
* 支持软删除和审计
* 隐藏持久化细节

下一步：

* 学习[领域事件](/10.0.0/domain-driven/domain-event/)了解事件驱动
* 阅读[工作单元](/10.0.0/domain-driven/unit-of-work/)理解事务管理
* 查看[聚合根](/10.0.0/domain-driven/aggregate-root/)理解聚合设计
