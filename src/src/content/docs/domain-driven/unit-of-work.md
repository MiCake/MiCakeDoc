---
title: 工作单元
description: 使用工作单元模式管理事务和保证数据一致性
---

工作单元（Unit of Work）是一种设计模式，用于跟踪业务事务期间对象的所有更改，并将多个数据库操作作为单个事务提交。在 MiCake 中，工作单元支持 Lazy 和 Immediate 两种初始化模式，以满足不同的性能和一致性需求。

## 什么是工作单元

工作单元的核心职责：

1. **跟踪变更**：跟踪业务操作期间所有对象的变更
2. **协调持久化**：将所有变更作为一个事务提交
3. **保证一致性**：确保数据的完整性和一致性
4. **管理事务**：控制事务的开始、提交和回滚

## 基本用法

###  ASP.NET Core 应用中的自动工作单元（推荐）

当你使用了`MiCake.AspNetCore`模块时，当`MiCakeAspNetUowOptions.EnableAutoUnitOfWork`选项被启用时（默认为true），工作单元会在每次 HTTP 请求开始时自动创建，并在请求结束时自动提交或回滚，用户无须关心工作单元的生命周期管理。

```csharp
// Startup.cs 或 Program.cs， 默认开启自动工作单元
services.AddMiCakeWithDefault<MyModule, MyDbContext>();

// 可以手动设置，以禁用自动工作单元
services.AddMiCakeWithDefault<MyModule, MyDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        asp.UnitOfWork.EnableAutoUnitOfWork = false;
    };
});
```

**Controller 示例**：

```csharp
public class OrderController : ControllerBase
{
    private readonly IRepository<Order, int> _orderRepository;

    public OrderController(IRepository<Order, int> orderRepository)
    {
        _orderRepository = orderRepository;
    }

    // ✅ 工作单元自动创建、提交或回滚
    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderDto dto)
    {
        var order = new Order(dto.CustomerId, dto.Items);
        await _orderRepository.AddAsync(order);

        // UoW 会在 action 执行成功后自动提交
        return Ok(order.Id);
    }
}
```

### 手动工作单元

对于非 Web 场景或需要精确控制的情况：

```csharp
public class OrderService
{
    private readonly IUnitOfWorkManager _uowManager;
    private readonly IRepository<Order, int> _orderRepository;

    public OrderService(
        IUnitOfWorkManager uowManager,
        IRepository<Order, int> orderRepository)
    {
        _uowManager = uowManager;
        _orderRepository = orderRepository;
    }

    public async Task ProcessOrderAsync(int orderId)
    {
        // ✅ 使用 BeginAsync 创建工作单元（推荐）
        using var uow = await _uowManager.BeginAsync();

        var order = await _orderRepository.FindAsync(orderId);
        order.Process();

        // 提交事务
        await uow.CommitAsync();
    }
}
```

## 事务初始化模式

MiCake 提供了两种事务初始化模式：Lazy（延迟）和 Immediate（立即），以满足不同的性能和一致性需求。

### Lazy 模式（默认）

事务在第一次数据库操作时才真正开启：

```csharp
using var uow = await _uowManager.BeginAsync();
// 此时事务尚未开启

var order = await _orderRepository.FindAsync(1);
// 此时事务才开始

await uow.CommitAsync();
// 提交事务
```

**特点**：
- **性能最优**：只在需要时才开启事务
- **适合场景**：读多写少的操作、可能不需要事务的场景
- **延迟初始化**：事务在第一次数据库操作时才创建

### Immediate 模式

使用 `UnitOfWorkOptions.Immediate` 静态工厂，或手动设置初始化模式：

```csharp
// 方式一：使用静态工厂（推荐）
using var uow = await _uowManager.BeginAsync(UnitOfWorkOptions.Immediate);
// 事务立即开启

var order = await _orderRepository.FindAsync(1);
// 直接使用已开启的事务

await uow.CommitAsync();
```

```csharp
// 方式二：手动设置
var options = new UnitOfWorkOptions
{
    InitializationMode = TransactionInitializationMode.Immediate
};

using var uow = await _uowManager.BeginAsync(options);
```

**特点**：
- **一致性保证**：确保事务从开始就存在
- **适合场景**：关键业务操作、需要明确事务边界的场景
- **立即初始化**：事务在 Begin 时就创建

### 如何选择

| 场景 | 推荐模式 | 原因 |
|------|----------|------|
| 常规 CRUD 操作 | Lazy | 性能更好，大部分操作都需要事务 |
| 关键业务操作 | Immediate | 确保事务一致性 |
| 可能回滚的操作 | Immediate | 避免延迟初始化带来的不确定性 |
| 高并发读操作 | Lazy | 减少不必要的事务开销 |
| 分布式事务 | Immediate | 需要明确的边界控制 |

### 通过 Attribute 控制

:::note
`UnitOfWorkAttribute` 提供两个选项：`IsReadOnly`（只读，写操作快速失败）与 `IsolationLevel`（隔离级别）。禁用工作单元请改用 `[DisableUnitOfWork]`，初始化模式请在 `UnitOfWorkOptions` 中配置。
:::

```csharp
// 只读：写操作快速失败
[UnitOfWork(IsReadOnly = true)]
public class ReadOnlyController : ControllerBase
{
    // ...
}

// 自定义隔离级别
[UnitOfWork(IsolationLevel = IsolationLevel.Serializable)]
public class HighConsistencyController : ControllerBase
{
    // ...
}
```

## 嵌套事务

MiCake 支持嵌套工作单元，内层工作单元会自动加入外层事务：

```csharp
public async Task ComplexOperationAsync()
{
    // 外层工作单元
    using var outerUow = await _uowManager.BeginAsync();

    var order = await _orderRepository.FindAsync(1);
    order.Update();

    // 内层工作单元（自动嵌套）
    using var innerUow = await _uowManager.BeginAsync();

    var product = await _productRepository.FindAsync(1);
    product.DecreaseStock();

    await innerUow.CommitAsync();  // 标记内层完成
    await outerUow.CommitAsync();  // 统一提交
}
```

**嵌套规则**：
- 内层事务自动加入外层事务
- 只有最外层工作单元负责最终提交
- 如果任意层失败，整个事务回滚
- 支持多层嵌套（建议不超过 3 层）

## Attribute 声明式控制

### 启用工作单元

```csharp
[UnitOfWork]
public class ProductController : ControllerBase
{
    // 所有 Action 都会自动创建 UoW
}
```

### 禁用工作单元

```csharp
[DisableUnitOfWork]
public class ReportController : ControllerBase
{
    // 纯查询 Controller，不需要事务
}
```

或在 Action 级别覆盖：

```csharp
public class MixedController : ControllerBase
{
    // 默认启用 UoW

    [DisableUnitOfWork]
    public async Task<IActionResult> GetCachedData()
    {
        // 此 Action 不创建 UoW
    }
}
```

### 自定义隔离级别

```csharp
[UnitOfWork(IsolationLevel = IsolationLevel.Serializable)]
public async Task<IActionResult> HighConsistencyOperation()
{
    // 使用最高隔离级别
}
```

### 只读操作优化

只读 Action 名称推断默认**关闭**，需要显式开启（显式元数据如 `[UnitOfWork(IsReadOnly = true)]` 始终优先）：

```csharp
// 依赖旧推断行为时重新开启：
services.AddMiCakeWithDefault<MyModule, MyDbContext>(
    miCakeAspNetConfig: options =>
    {
        options.UnitOfWork.EnableReadOnlyActionNameInference = true;
        options.UnitOfWork.ReadOnlyActionKeywords = ["Get", "Find", "Query", "Search", "List", "Fetch"];
    });
```

开启后，名称匹配关键字的 Action 会被自动识别为只读（跳过事务提交）。

## 高级场景

### 禁用自动工作单元

```csharp
services.AddMiCakeWithDefault<MyModule, MyDbContext>(
    miCakeAspNetConfig: options =>
    {
        options.UnitOfWork.EnableAutoUnitOfWork = false;
    });
```

此时需要手动管理所有工作单元。

### Savepoint（保存点）

在长事务中创建保存点，支持部分回滚：

```csharp
using var uow = await _uowManager.BeginAsync();

// 执行一些操作
await ProcessStep1();

// 创建保存点
var savepoint = await uow.CreateSavepointAsync("step1");

try
{
    // 执行可能失败的操作
    await ProcessStep2();
}
catch
{
    // 回滚到保存点，保留 step1 的更改
    await uow.RollbackToSavepointAsync("step1");
}

await uow.CommitAsync();
```

### 手动回滚

```csharp
using var uow = await _uowManager.BeginAsync();

try
{
    await ProcessOrder();

    if (someCondition)
    {
        // 手动回滚
        await uow.RollbackAsync();
        return;
    }

    await uow.CommitAsync();
}
catch
{
    // 异常时自动回滚
    throw;
}
```

### 监听工作单元事件

```csharp
using var uow = await _uowManager.BeginAsync();

uow.OnCommitting += (sender, args) =>
{
    _logger.LogInformation("UoW {Id} is committing", args.UnitOfWorkId);
};

uow.OnCommitted += (sender, args) =>
{
    _logger.LogInformation("UoW {Id} committed successfully", args.UnitOfWorkId);
};

uow.OnRolledBack += (sender, args) =>
{
    _logger.LogWarning(args.Exception, "UoW {Id} rolled back", args.UnitOfWorkId);
};

await ProcessOrder();
await uow.CommitAsync();
```

## 配置选项

### ASP.NET Core 配置

```csharp
services.AddMiCakeWithDefault<MyModule, MyDbContext>(
    miCakeAspNetConfig: options =>
    {
        // 启用/禁用自动工作单元（默认：true）
        options.UnitOfWork.EnableAutoUnitOfWork = true;

        // 只读 Action 名称推断（默认：false，需显式开启）
        options.UnitOfWork.EnableReadOnlyActionNameInference = false;

        // 只读 Action 关键字
        options.UnitOfWork.ReadOnlyActionKeywords = ["Find", "Get", "Query", "Search"];
    });
```

### UnitOfWork 选项

```csharp
// 使用静态工厂（推荐）
using var uow = await _uowManager.BeginAsync(UnitOfWorkOptions.Default);      // Lazy 默认
using var uow2 = await _uowManager.BeginAsync(UnitOfWorkOptions.Immediate);   // 立即开启事务
using var uow3 = await _uowManager.BeginAsync(UnitOfWorkOptions.ReadOnly);    // 只读
```

```csharp
// 或手动设置
var options = new UnitOfWorkOptions
{
    // 隔离级别（默认：ReadCommitted）
    IsolationLevel = IsolationLevel.ReadCommitted,

    // 初始化模式（默认：Lazy）
    InitializationMode = TransactionInitializationMode.Lazy,

    // 是否只读（默认：false）
    IsReadOnly = false
};

using var uow = await _uowManager.BeginAsync(options);
```

:::note
`UnitOfWorkOptions` 不含超时配置。超时请使用 EF/provider 的命令、锁、事务超时配置。
:::

## 最佳实践

### ✅ 推荐做法

1. **优先使用 BeginAsync()**

```csharp
// ✅ 好
using var uow = await _uowManager.BeginAsync();
```

2. **使用 using 语句确保 Dispose**

```csharp
// ✅ 好
using var uow = await _uowManager.BeginAsync();
// ... 操作
await uow.CommitAsync();

// ❌ 差
var uow = await _uowManager.BeginAsync();
// ... 操作
await uow.CommitAsync();
// 忘记 Dispose!
```

3. **明确提交或回滚**

```csharp
using var uow = await _uowManager.BeginAsync();

try
{
    // ... 操作
    await uow.CommitAsync();  // ✅ 明确提交
}
catch
{
    // Dispose 时会记录警告
    throw;
}
```

4. **合理使用 Attribute**

```csharp
// ✅ 在 Controller 级别声明，减少重复
[UnitOfWork]
public class OrderController : ControllerBase { }

// ✅ Action 级别覆盖特殊情况
[DisableUnitOfWork]
public async Task<IActionResult> GetCachedData() { }
```

### ❌ 反模式

1. **不要在循环中创建多个 UoW**

```csharp
// ❌ 差
foreach (var order in orders)
{
    using var uow = await _uowManager.BeginAsync();
    await ProcessOrder(order);
    await uow.CommitAsync();
}

// ✅ 好
using var uow = await _uowManager.BeginAsync();
foreach (var order in orders)
{
    await ProcessOrder(order);
}
await uow.CommitAsync();
```

2. **不要在 UoW 外部使用 Repository**

```csharp
// ❌ 差：UoW 外的操作无法获得事务/回滚/生命周期保证
var order = await _orderRepository.FindAsync(1);  // 无 UoW 上下文

// ✅ 好
using var uow = await _uowManager.BeginAsync();
var order = await _orderRepository.FindAsync(1);
// ... 操作
await uow.CommitAsync();
```

3. **避免过长的事务**

```csharp
// ❌ 差
using var uow = await _uowManager.BeginAsync();
await DoLotsOfWork();  // 10 分钟的操作
await DoMoreWork();
await uow.CommitAsync();

// ✅ 好 - 将长操作拆分
await DoLotsOfWork();  // 不在事务中

using var uow = await _uowManager.BeginAsync();
await DoCriticalWork();  // 只有关键部分在事务中
await uow.CommitAsync();
```

## 常见错误

### ❌ 工作单元未完成警告

```csharp
// 错误：未明确提交或回滚
using var uow = await _uowManager.BeginAsync();
await ProcessOrder();
// 忘记调用 CommitAsync() 或 RollbackAsync()
// Dispose 时会记录警告："UnitOfWork disposed without being completed"
```

### ✅ 正确的处理

```csharp
using var uow = await _uowManager.BeginAsync();

try
{
    await ProcessOrder();
    await uow.CommitAsync();  // ✅ 明确提交
}
catch (Exception ex)
{
    await uow.RollbackAsync();  // ✅ 明确回滚
    throw;
}
```

### ❌ 嵌套事务误用

```csharp
// 错误：BeginAsync 不接受 requiresNew 参数
using var outerUow = await _uowManager.BeginAsync();
using var innerUow = await _uowManager.BeginAsync(requiresNew: true);  // ❌ 编译错误
```

需要真正的**独立事务**时，使用隔离回调执行 `ExecuteRequiresNewAsync`（创建独立 DI 作用域，成功自动提交、失败自动回滚）：

```csharp
await _uowManager.ExecuteRequiresNewAsync(async (sp, ct) =>
{
    // 必须从回调的 provider 解析服务（捕获外层 scoped 服务会触发所有权校验失败）
    var repo = sp.GetRequiredService<IRepository<Order, int>>();
    await repo.AddAsync(order);
});
```

### ✅ 正确的嵌套

```csharp
// 正确：内层自动嵌套在外层事务中
using var outerUow = await _uowManager.BeginAsync();
using var innerUow = await _uowManager.BeginAsync();
// 内层会自动嵌套在外层事务中；嵌套 CommitAsync 只标记完成，物理提交发生在根 UoW
await innerUow.CommitAsync();
await outerUow.CommitAsync();
```

## 小结

工作单元是 MiCake 中事务管理的核心，在框架中：

- ✅ **Lazy 和 Immediate 模式** - 满足不同性能和一致性需求
- ✅ **嵌套事务支持** - 灵活的事务组合
- ✅ **声明式控制** - Attribute 简化配置
- ✅ **自动管理** - ASP.NET Core 集成

通过合理使用工作单元，您可以：
- 确保数据一致性
- 简化事务管理
- 提高代码可维护性
- 优化应用性能

下一步：
- 学习[仓储](/domain-driven/repository/)了解数据访问
- 阅读[领域事件](/domain-driven/domain-event/)理解事件处理
- 查看[聚合根](/domain-driven/aggregate-root/)理解聚合边界
