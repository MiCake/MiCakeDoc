---
title: Unit of Work
description: Use the unit of work pattern to manage transactions and ensure data consistency
---

The Unit of Work is a design pattern used to track all changes to objects during a business transaction and commit multiple database operations as a single transaction. In MiCake, the unit of work supports both Lazy and Immediate initialization modes to meet different performance and consistency requirements.

## What is a Unit of Work

The core responsibilities of a unit of work:

1. **Track changes**: track all changes to objects during a business operation
2. **Coordinate persistence**: commit all changes as a single transaction
3. **Ensure consistency**: guarantee the integrity and consistency of data
4. **Manage transactions**: control the beginning, commit, and rollback of transactions

## Basic Usage

### Automatic Unit of Work in ASP.NET Core Applications (Recommended)

When you use the `MiCake.AspNetCore` module and the `MiCakeAspNetUowOptions.EnableAutoUnitOfWork` option is enabled (defaults to true), a unit of work is created automatically at the beginning of every HTTP request and committed or rolled back automatically at the end of the request. You don't need to worry about the unit of work lifecycle.

```csharp
// Startup.cs or Program.cs - automatic unit of work is enabled by default
services.AddMiCakeWithDefault<MyModule, MyDbContext>();

// You can configure it manually to disable the automatic unit of work
services.AddMiCakeWithDefault<MyModule, MyDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        asp.UnitOfWork.EnableAutoUnitOfWork = false;
    };
});
```

**Controller example**:

```csharp
public class OrderController : ControllerBase
{
    private readonly IRepository<Order, int> _orderRepository;

    public OrderController(IRepository<Order, int> orderRepository)
    {
        _orderRepository = orderRepository;
    }

    // ✅ The unit of work is created, committed, or rolled back automatically
    [HttpPost]
    public async Task<IActionResult> CreateOrder(CreateOrderDto dto)
    {
        var order = new Order(dto.CustomerId, dto.Items);
        await _orderRepository.AddAsync(order);

        // The UoW is committed automatically after the action succeeds
        return Ok(order.Id);
    }
}
```

### Manual Unit of Work

For non-Web scenarios or cases requiring precise control:

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
        // ✅ Use BeginAsync to create a unit of work (recommended)
        using var uow = await _uowManager.BeginAsync();

        var order = await _orderRepository.FindAsync(orderId);
        order.Process();

        // Commit the transaction
        await uow.CommitAsync();
    }
}
```

## Transaction Initialization Modes

MiCake provides two transaction initialization modes: Lazy and Immediate, to meet different performance and consistency requirements.

### Lazy Mode (Default)

The transaction is actually started at the first database operation:

```csharp
using var uow = await _uowManager.BeginAsync();
// The transaction has not started yet

var order = await _orderRepository.FindAsync(1);
// The transaction starts now

await uow.CommitAsync();
// Commit the transaction
```

**Characteristics**:
- **Best performance**: the transaction is only opened when needed
- **Suitable for**: read-heavy/write-light operations, scenarios that may not need a transaction
- **Lazy initialization**: the transaction is created at the first database operation

### Immediate Mode

Use the `UnitOfWorkOptions.Immediate` static factory, or set the initialization mode manually:

```csharp
// Option 1: use the static factory (recommended)
using var uow = await _uowManager.BeginAsync(UnitOfWorkOptions.Immediate);
// The transaction starts immediately

var order = await _orderRepository.FindAsync(1);
// Use the already-started transaction directly

await uow.CommitAsync();
```

```csharp
// Option 2: set it manually
var options = new UnitOfWorkOptions
{
    InitializationMode = TransactionInitializationMode.Immediate
};

using var uow = await _uowManager.BeginAsync(options);
```

**Characteristics**:
- **Consistency guarantee**: ensures the transaction exists from the beginning
- **Suitable for**: critical business operations, scenarios that need explicit transaction boundaries
- **Immediate initialization**: the transaction is created at Begin time

### How to Choose

| Scenario | Recommended Mode | Reason |
|----------|------------------|--------|
| Regular CRUD operations | Lazy | Better performance; most operations need a transaction |
| Critical business operations | Immediate | Ensure transaction consistency |
| Operations that may roll back | Immediate | Avoid the uncertainty of lazy initialization |
| High-concurrency read operations | Lazy | Reduce unnecessary transaction overhead |
| Distributed transactions | Immediate | Need explicit boundary control |

### Controlling Through Attributes

:::note
`UnitOfWorkAttribute` provides two options: `IsReadOnly` (read-only; write operations fail fast) and `IsolationLevel`. To opt out of the unit of work, use `[DisableUnitOfWork]` instead; configure the initialization mode via `UnitOfWorkOptions`.
:::

```csharp
// Read-only: write operations fail fast
[UnitOfWork(IsReadOnly = true)]
public class ReadOnlyController : ControllerBase
{
    // ...
}

// Custom isolation level
[UnitOfWork(IsolationLevel = IsolationLevel.Serializable)]
public class HighConsistencyController : ControllerBase
{
    // ...
}
```

## Nested Transactions

MiCake supports nested units of work - the inner unit of work automatically joins the outer transaction:

```csharp
public async Task ComplexOperationAsync()
{
    // Outer unit of work
    using var outerUow = await _uowManager.BeginAsync();

    var order = await _orderRepository.FindAsync(1);
    order.Update();

    // Inner unit of work (nested automatically)
    using var innerUow = await _uowManager.BeginAsync();

    var product = await _productRepository.FindAsync(1);
    product.DecreaseStock();

    await innerUow.CommitAsync();  // Mark the inner one as complete
    await outerUow.CommitAsync();  // Commit everything together
}
```

**Nesting rules**:
- The inner transaction automatically joins the outer transaction
- Only the outermost unit of work is responsible for the final commit
- If any level fails, the entire transaction is rolled back
- Multiple levels of nesting are supported (it is recommended to keep it under 3 levels)

## Declarative Control Through Attributes

### Enabling the Unit of Work

```csharp
[UnitOfWork]
public class ProductController : ControllerBase
{
    // A UoW is created automatically for all Actions
}
```

### Disabling the Unit of Work

```csharp
[DisableUnitOfWork]
public class ReportController : ControllerBase
{
    // A pure query controller - no transaction needed
}
```

Or override it at the Action level:

```csharp
public class MixedController : ControllerBase
{
    // UoW is enabled by default

    [DisableUnitOfWork]
    public async Task<IActionResult> GetCachedData()
    {
        // This Action does not create a UoW
    }
}
```

### Custom Isolation Level

```csharp
[UnitOfWork(IsolationLevel = IsolationLevel.Serializable)]
public async Task<IActionResult> HighConsistencyOperation()
{
    // Use the highest isolation level
}
```

### Read-Only Operation Optimization

Read-only Action name inference is **off by default**; enable it explicitly (explicit metadata such as `[UnitOfWork(IsReadOnly = true)]` always takes precedence):

```csharp
// Re-enable it if you depend on the old inference behavior:
services.AddMiCakeWithDefault<MyModule, MyDbContext>(
    miCakeAspNetConfig: options =>
    {
        options.UnitOfWork.EnableReadOnlyActionNameInference = true;
        options.UnitOfWork.ReadOnlyActionKeywords = ["Get", "Find", "Query", "Search", "List", "Fetch"];
    });
```

When enabled, Actions whose names match the keywords are automatically identified as read-only (skipping the transaction commit).

## Advanced Scenarios

### Disabling the Automatic Unit of Work

```csharp
services.AddMiCakeWithDefault<MyModule, MyDbContext>(
    miCakeAspNetConfig: options =>
    {
        options.UnitOfWork.EnableAutoUnitOfWork = false;
    });
```

In this case, you need to manage all units of work manually.

### Savepoints

Create savepoints in long transactions to support partial rollback:

```csharp
using var uow = await _uowManager.BeginAsync();

// Execute some operations
await ProcessStep1();

// Create a savepoint
var savepoint = await uow.CreateSavepointAsync("step1");

try
{
    // Execute an operation that may fail
    await ProcessStep2();
}
catch
{
    // Roll back to the savepoint, keeping the changes from step1
    await uow.RollbackToSavepointAsync("step1");
}

await uow.CommitAsync();
```

### Manual Rollback

```csharp
using var uow = await _uowManager.BeginAsync();

try
{
    await ProcessOrder();

    if (someCondition)
    {
        // Roll back manually
        await uow.RollbackAsync();
        return;
    }

    await uow.CommitAsync();
}
catch
{
    // Roll back automatically on exception
    throw;
}
```

### Listening to Unit of Work Events

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

## Configuration Options

### ASP.NET Core Configuration

```csharp
services.AddMiCakeWithDefault<MyModule, MyDbContext>(
    miCakeAspNetConfig: options =>
    {
        // Enable/disable the automatic unit of work (default: true)
        options.UnitOfWork.EnableAutoUnitOfWork = true;

        // Read-only Action name inference (default: false, opt-in)
        options.UnitOfWork.EnableReadOnlyActionNameInference = false;

        // Read-only Action keywords
        options.UnitOfWork.ReadOnlyActionKeywords = ["Find", "Get", "Query", "Search"];
    });
```

### UnitOfWork Options

```csharp
// Use the static factories (recommended)
using var uow = await _uowManager.BeginAsync(UnitOfWorkOptions.Default);      // Lazy default
using var uow2 = await _uowManager.BeginAsync(UnitOfWorkOptions.Immediate);   // Start the transaction immediately
using var uow3 = await _uowManager.BeginAsync(UnitOfWorkOptions.ReadOnly);    // Read-only
```

```csharp
// Or set the options manually
var options = new UnitOfWorkOptions
{
    // Isolation level (default: ReadCommitted)
    IsolationLevel = IsolationLevel.ReadCommitted,

    // Initialization mode (default: Lazy)
    InitializationMode = TransactionInitializationMode.Lazy,

    // Whether it is read-only (default: false)
    IsReadOnly = false
};

using var uow = await _uowManager.BeginAsync(options);
```

:::note
`UnitOfWorkOptions` does not include a timeout setting. Configure timeouts through EF/provider command, lock, or transaction timeout settings instead.
:::

## Best Practices

### ✅ Recommended Approaches

1. **Prefer BeginAsync()**

```csharp
// ✅ Good
using var uow = await _uowManager.BeginAsync();
```

2. **Use a using statement to ensure Dispose**

```csharp
// ✅ Good
using var uow = await _uowManager.BeginAsync();
// ... operations
await uow.CommitAsync();

// ❌ Bad
var uow = await _uowManager.BeginAsync();
// ... operations
await uow.CommitAsync();
// Forgot to Dispose!
```

3. **Commit or roll back explicitly**

```csharp
using var uow = await _uowManager.BeginAsync();

try
{
    // ... operations
    await uow.CommitAsync();  // ✅ Commit explicitly
}
catch
{
    // A warning is logged on Dispose
    throw;
}
```

4. **Use attributes sensibly**

```csharp
// ✅ Declare at the Controller level to reduce repetition
[UnitOfWork]
public class OrderController : ControllerBase { }

// ✅ Override special cases at the Action level
[DisableUnitOfWork]
public async Task<IActionResult> GetCachedData() { }
```

### ❌ Anti-Patterns

1. **Do not create multiple UoWs in a loop**

```csharp
// ❌ Bad
foreach (var order in orders)
{
    using var uow = await _uowManager.BeginAsync();
    await ProcessOrder(order);
    await uow.CommitAsync();
}

// ✅ Good
using var uow = await _uowManager.BeginAsync();
foreach (var order in orders)
{
    await ProcessOrder(order);
}
await uow.CommitAsync();
```

2. **Do not use a Repository outside of a UoW**

```csharp
// ❌ Bad: operations outside a UoW get no transaction/rollback/lifecycle guarantees
var order = await _orderRepository.FindAsync(1);  // No UoW context

// ✅ Good
using var uow = await _uowManager.BeginAsync();
var order = await _orderRepository.FindAsync(1);
// ... operations
await uow.CommitAsync();
```

3. **Avoid overly long transactions**

```csharp
// ❌ Bad
using var uow = await _uowManager.BeginAsync();
await DoLotsOfWork();  // A 10-minute operation
await DoMoreWork();
await uow.CommitAsync();

// ✅ Good - split the long operation
await DoLotsOfWork();  // Not in a transaction

using var uow = await _uowManager.BeginAsync();
await DoCriticalWork();  // Only the critical part is in the transaction
await uow.CommitAsync();
```

## Common Mistakes

### ❌ "Unit of Work Not Completed" Warning

```csharp
// Mistake: neither committed nor rolled back explicitly
using var uow = await _uowManager.BeginAsync();
await ProcessOrder();
// Forgot to call CommitAsync() or RollbackAsync()
// A warning is logged on Dispose: "UnitOfWork disposed without being completed"
```

### ✅ Correct Handling

```csharp
using var uow = await _uowManager.BeginAsync();

try
{
    await ProcessOrder();
    await uow.CommitAsync();  // ✅ Commit explicitly
}
catch (Exception ex)
{
    await uow.RollbackAsync();  // ✅ Roll back explicitly
    throw;
}
```

### ❌ Misusing Nested Transactions

```csharp
// Mistake: BeginAsync does not accept a requiresNew parameter
using var outerUow = await _uowManager.BeginAsync();
using var innerUow = await _uowManager.BeginAsync(requiresNew: true);  // ❌ Compile error
```

For a truly **independent transaction**, use the isolated callback execution `ExecuteRequiresNewAsync` (creates a separate DI scope; commits automatically on success, rolls back on failure):

```csharp
await _uowManager.ExecuteRequiresNewAsync(async (sp, ct) =>
{
    // Resolve services from the callback's provider (capturing outer scoped services fails the ownership check)
    var repo = sp.GetRequiredService<IRepository<Order, int>>();
    await repo.AddAsync(order);
});
```

### ✅ Correct Nesting

```csharp
// Correct: the inner one nests automatically within the outer transaction
using var outerUow = await _uowManager.BeginAsync();
using var innerUow = await _uowManager.BeginAsync();
// The inner one is nested automatically within the outer transaction; a nested CommitAsync only marks completion, the physical commit happens at the root UoW
await innerUow.CommitAsync();
await outerUow.CommitAsync();
```

## Summary

The unit of work is the core of transaction management in MiCake. In the framework:

- ✅ **Lazy and Immediate modes** - meet different performance and consistency requirements
- ✅ **Nested transaction support** - flexible transaction composition
- ✅ **Declarative control** - attributes simplify configuration
- ✅ **Automatic management** - ASP.NET Core integration

By using units of work sensibly, you can:
- Ensure data consistency
- Simplify transaction management
- Improve code maintainability
- Optimize application performance

Next steps:
- Learn about [Repositories](/en/domain-driven/repository/) to understand data access
- Read about [Domain Events](/en/domain-driven/domain-event/) to understand event handling
- Check out [Aggregate Roots](/en/domain-driven/aggregate-root/) to understand aggregate boundaries
