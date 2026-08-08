---
title: 核心概念
description: MiCake 框架中的核心概念，帮助您更好地理解和使用框架
slug: 10.0.0/getting-started/core-concepts
---

本文介绍 MiCake 框架中的核心概念，帮助您更好地理解和使用框架。

## 模块系统

### 什么是模块

MiCake 采用模块化设计，应用程序由多个模块组成。每个模块都是一个独立的功能单元，可以：

* 配置自己的服务
* 管理自己的生命周期
* 声明对其他模块的依赖

### 模块生命周期

每个模块都有明确的生命周期钩子：

```csharp
public class MyModule : MiCakeModule
{
    // 1. 配置服务阶段
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // 注册服务到 DI 容器
        context.Services.AddScoped<IMyService, MyService>();
    }

    // 2. 应用初始化阶段
    public override void OnApplicationInitialization(ModuleInitializationContext context)
    {
        // 应用启动时的初始化逻辑
        var logger = context.ServiceProvider.GetService<ILogger>();
        logger.LogInformation("Module initialized");
    }

    // 3. 应用关闭阶段
    public override void OnApplicationShutdown(ModuleShutdownContext context)
    {
        // 应用关闭时的清理逻辑
    }
}
```

### 模块依赖

使用 `[RelyOn]` 特性声明模块间的依赖关系：

```csharp
[RelyOn(typeof(MiCakeAspNetCoreModule))]
[RelyOn(typeof(MiCakeEntityFrameworkCoreModule))]
public class MyAppModule : MiCakeModule
{
    // 框架会确保依赖的模块先初始化
}
```

## 领域驱动设计（DDD）

### DDD 的核心思想

MiCake 实现了 DDD 战术模式的核心组件：

1. **实体（Entity）**：具有唯一标识的对象
2. **值对象（Value Object）**：通过属性值比较的不可变对象
3. **聚合根（Aggregate Root）**：聚合的根实体
4. **仓储（Repository）**：提供聚合根的持久化
5. **领域事件（Domain Event）**：捕获业务事件
6. **领域服务（Domain Service）**：封装领域逻辑

### 聚合边界

聚合是一组相关对象的集合，通过聚合根访问：

```
┌─────────────────────────────────┐
│  Aggregate (Order)              │
│  ┌──────────────────────────┐   │
│  │ Aggregate Root (Order)   │◄──┼─── 外部只能通过聚合根访问
│  │  - OrderId               │   │
│  │  - Customer              │   │
│  │  - Status                │   │
│  └──────────────────────────┘   │
│         │ manages               │
│         ▼                       │
│  ┌──────────────────────────┐   │
│  │ Entity (OrderItem)       │   │
│  │  - ProductId             │   │
│  │  - Quantity              │   │
│  │  - Price                 │   │
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

### 实体 vs 值对象

**实体特征：**

* 有唯一标识（Id）
* 可变的
* 通过 Id 比较相等性
* 有生命周期

```csharp
public class Order : AggregateRoot<int>
{
    public int Id { get; init; }  // 唯一标识
    public string OrderNumber { get; private set; }
    // ...
}
```

**值对象特征：**

* 无唯一标识
* 不可变的
* 通过所有属性值比较相等性
* 可以被替换

```csharp
public class Address : ValueObject
{
    public string Street { get; }
    public string City { get; }
    public string ZipCode { get; }

    public Address(string street, string city, string zipCode)
    {
        Street = street;
        City = city;
        ZipCode = zipCode;
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Street;
        yield return City;
        yield return ZipCode;
    }
}
```

## 仓储模式

### 仓储的职责

仓储封装了数据访问逻辑，提供类似集合的接口：

```csharp
public interface IRepository<TAggregateRoot, TKey>
{
    Task<TAggregateRoot> FindAsync(TKey id);
    Task AddAsync(TAggregateRoot aggregateRoot);
    Task UpdateAsync(TAggregateRoot aggregateRoot);
    Task DeleteAsync(TAggregateRoot aggregateRoot);
    Task<int> SaveChangesAsync();
}
```

### 仓储只针对聚合根

❌ 错误做法：

```csharp
// 不要为内部实体创建仓储
public interface IOrderItemRepository : IRepository<OrderItem, int>
{
}
```

✅ 正确做法：

```csharp
// 只为聚合根创建仓储
public interface IOrderRepository : IRepository<Order, int>
{
}

// 通过聚合根访问内部实体
var order = await orderRepository.FindAsync(orderId);
var items = order.Items;  // 通过聚合根访问
```

## 领域事件

### 事件驱动架构

领域事件用于捕获领域中发生的重要业务事件：

```csharp
// 1. 定义事件
public class OrderPlacedEvent : IDomainEvent
{
    public int OrderId { get; }
    public decimal TotalAmount { get; }

    public OrderPlacedEvent(int orderId, decimal totalAmount)
    {
        OrderId = orderId;
        TotalAmount = totalAmount;
    }
}

// 2. 在聚合根中触发事件
public class Order : AggregateRoot<int>
{
    public void PlaceOrder()
    {
        // 业务逻辑
        Status = OrderStatus.Placed;

        // 触发领域事件
        RaiseDomainEvent(new OrderPlacedEvent(Id, TotalAmount));
    }
}

// 3. 处理事件
public class OrderPlacedEventHandler : IDomainEventHandler<OrderPlacedEvent>
{
    public Task HandleAysnc(OrderPlacedEvent domainEvent, CancellationToken cancellationToken)
    {
        // 发送邮件通知
        // 更新库存
        // 记录日志
        return Task.CompletedTask;
    }
}
```

### 事件的自动派发

领域事件会在调用 `SaveChangesAsync` 时自动派发：

```csharp
var order = Order.Create(customer);
order.PlaceOrder();  // 触发事件，但不立即派发

await repository.AddAsync(order);
await repository.SaveChangesAsync();  // 此时自动派发所有事件
```

## 工作单元（Unit of Work）

### 什么是工作单元

工作单元模式用于：

* 跟踪业务操作期间的所有变更
* 确保变更作为一个事务提交
* 保证数据一致性

### MiCake 中的工作单元

在 MiCake 中，提供了多种方式来开启工作单元：

```csharp
using MiCake.AspNetCore.Uow;

[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    private readonly IRepository<Order, int> _orderRepository;
    private readonly IRepository<Product, int> _productRepository;

    [HttpPost]
    [UnitOfWork] // 自动开启工作单元
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        // 1. 创建订单
        var order = Order.Create(dto.CustomerId, dto.ShippingAddress);
        
        foreach (var item in dto.Items)
        {
            order.AddItem(item.ProductId, item.ProductName, item.Price, item.Quantity);
        }
        
        await _orderRepository.AddAsync(order);
        await _orderRepository.SaveChangesAsync();

        // 2. 更新产品库存
        foreach (var item in dto.Items)
        {
            var product = await _productRepository.FindAsync(item.ProductId);
            product.DecreaseStock(item.Quantity);
        }
        
        await _productRepository.SaveChangesAsync();

        // 方法正常返回时，自动提交事务
        // 如果抛出异常，自动回滚事务
        return Ok(order.Id);
    }
}
```

具体例子请阅读[工作单元文档](./工作单元.md)。

## 依赖注入

### 自动服务注册

MiCake 支持通过接口标记自动注册服务：

```csharp
// 标记为瞬时服务（Transient）
public class MyService : ITransientService
{
    // 自动注册为 Transient 生命周期
}

// 标记为作用域服务（Scoped）
public class OrderService : IScopedService
{
    // 自动注册为 Scoped 生命周期
}

// 标记为单例服务（Singleton）
public class CacheService : ISingletonService
{
    // 自动注册为 Singleton 生命周期
}
```

### 手动服务注册

使用 `[InjectService]` 特性精确控制注册：

```csharp
[InjectService(typeof(IMyService), ServiceLifetime.Scoped)]
public class MyService : IMyService
{
    // ...
}
```

## 最佳实践总结

### 1. 聚合设计原则

* 保持聚合小而专注
* 通过聚合根访问内部实体
* 在聚合边界内保证一致性
* 跨聚合通过领域事件通信

### 2. 仓储使用原则

* 只为聚合根创建仓储
* 仓储操作应该是原子的
* 在一个工作单元内完成相关操作
* 尽量避免使用IQueryable暴露数据访问细节，因为仓储中的每一个方法都应该是一个明确的业务意图

### 3. 服务分层

* **领域服务**：核心业务逻辑
* **应用服务**：协调多个聚合的操作
* **基础设施服务**：技术性服务（缓存、日志等）

## 下一步

现在您已经理解了 MiCake 的核心概念，可以深入学习各个具体组件：

* [实体](./实体.md) - 了解实体的详细用法
* [值对象](./值对象.md) - 学习值对象的设计
* [聚合根](./聚合根.md) - 掌握聚合的设计原则
* [仓储](./仓储.md) - 深入理解仓储模式
* [领域事件](./领域事件.md) - 实现事件驱动架构
