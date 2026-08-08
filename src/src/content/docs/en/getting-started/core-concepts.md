---
title: Core Concepts
description: Core concepts in the MiCake framework that help you better understand and use the framework
---

This article introduces the core concepts of the MiCake framework to help you better understand and use it.

## Module System

### What is a Module

MiCake adopts a modular design; an application consists of multiple modules. Each module is an independent functional unit that can:

- Configure its own services
- Manage its own lifecycle
- Declare dependencies on other modules

### Module Lifecycle

Each module has explicit lifecycle hooks:

```csharp
public class MyModule : MiCakeModule
{
    // 1. Configure services phase
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // Register services into the DI container
        context.Services.AddScoped<IMyService, MyService>();
    }

    // 2. Application initialization phase
    public override void OnApplicationInitialization(ModuleInitializationContext context)
    {
        // Initialization logic when the application starts
        var logger = context.ServiceProvider.GetService<ILogger>();
        logger.LogInformation("Module initialized");
    }

    // 3. Application shutdown phase
    public override void OnApplicationShutdown(ModuleShutdownContext context)
    {
        // Cleanup logic when the application shuts down
    }
}
```

### Module Dependencies

Use the `[RelyOn]` attribute to declare dependencies between modules:

```csharp
[RelyOn(typeof(MiCakeAspNetCoreModule))]
[RelyOn(typeof(MiCakeEntityFrameworkCoreModule))]
public class MyAppModule : MiCakeModule
{
    // The framework ensures dependent modules are initialized first
}
```

## Domain-Driven Design (DDD)

### Core Ideas of DDD

MiCake implements the core components of DDD tactical patterns:

1. **Entity**: an object with a unique identity
2. **Value Object**: an immutable object compared by property values
3. **Aggregate Root**: the root entity of an aggregate
4. **Repository**: provides persistence for aggregate roots
5. **Domain Event**: captures business events
6. **Domain Service**: encapsulates domain logic

### Aggregate Boundaries

An aggregate is a collection of related objects, accessed through the aggregate root:

```
┌─────────────────────────────────┐
│  Aggregate (Order)              │
│  ┌──────────────────────────┐   │
│  │ Aggregate Root (Order)   │◄──┼─── External access only through the aggregate root
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

### Entity vs Value Object

**Entity characteristics:**
- Has a unique identity (Id)
- Mutable
- Equality is compared by Id
- Has a lifecycle

```csharp
public class Order : AggregateRoot<int>
{
    public int Id { get; init; }  // Unique identity
    public string OrderNumber { get; private set; }
    // ...
}
```

**Value Object characteristics:**
- No unique identity
- Immutable
- Equality is compared by all property values
- Can be replaced

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

## Repository Pattern

### Repository Responsibilities

A repository encapsulates data access logic and provides a collection-like interface:

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

### Repositories Are Only for Aggregate Roots

❌ Wrong approach:

```csharp
// Do not create repositories for internal entities
public interface IOrderItemRepository : IRepository<OrderItem, int>
{
}
```

✅ Correct approach:

```csharp
// Create repositories only for aggregate roots
public interface IOrderRepository : IRepository<Order, int>
{
}

// Access internal entities through the aggregate root
var order = await orderRepository.FindAsync(orderId);
var items = order.Items;  // Access through the aggregate root
```

## Domain Events

### Event-Driven Architecture

Domain events capture important business events that occur in the domain:

```csharp
// 1. Define the event
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

// 2. Raise the event in the aggregate root
public class Order : AggregateRoot<int>
{
    public void PlaceOrder()
    {
        // Business logic
        Status = OrderStatus.Placed;

        // Raise the domain event
        RaiseDomainEvent(new OrderPlacedEvent(Id, TotalAmount));
    }
}

// 3. Handle the event
public class OrderPlacedEventHandler : IDomainEventHandler<OrderPlacedEvent>
{
    public Task HandleAysnc(OrderPlacedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Send email notification
        // Update inventory
        // Write logs
        return Task.CompletedTask;
    }
}
```

### Automatic Event Dispatch

Domain events are dispatched automatically when `SaveChangesAsync` is called:

```csharp
var order = Order.Create(customer);
order.PlaceOrder();  // Raises the event, but does not dispatch immediately

await repository.AddAsync(order);
await repository.SaveChangesAsync();  // All events are dispatched here
```

## Unit of Work

### What is a Unit of Work

The Unit of Work pattern is used to:

- Track all changes during a business operation
- Ensure changes are committed as a single transaction
- Guarantee data consistency

### Unit of Work in MiCake

MiCake provides several ways to start a unit of work:

```csharp
using MiCake.AspNetCore.Uow;

[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    private readonly IRepository<Order, int> _orderRepository;
    private readonly IRepository<Product, int> _productRepository;

    [HttpPost]
    [UnitOfWork] // Starts a unit of work automatically
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        // 1. Create the order
        var order = Order.Create(dto.CustomerId, dto.ShippingAddress);
        
        foreach (var item in dto.Items)
        {
            order.AddItem(item.ProductId, item.ProductName, item.Price, item.Quantity);
        }
        
        await _orderRepository.AddAsync(order);
        await _orderRepository.SaveChangesAsync();

        // 2. Update product inventory
        foreach (var item in dto.Items)
        {
            var product = await _productRepository.FindAsync(item.ProductId);
            product.DecreaseStock(item.Quantity);
        }
        
        await _productRepository.SaveChangesAsync();

        // When the method returns normally, the transaction is committed automatically
        // If an exception is thrown, the transaction is rolled back automatically
        return Ok(order.Id);
    }
}
```

For concrete examples, read the [Unit of Work documentation](../../domain-driven/unit-of-work/).

## Dependency Injection

### Automatic Service Registration

MiCake supports automatic service registration through interface markers:

```csharp
// Marked as a transient service
public class MyService : ITransientService
{
    // Automatically registered with the Transient lifetime
}

// Marked as a scoped service
public class OrderService : IScopedService
{
    // Automatically registered with the Scoped lifetime
}

// Marked as a singleton service
public class CacheService : ISingletonService
{
    // Automatically registered with the Singleton lifetime
}
```

### Manual Service Registration

Use the `[InjectService]` attribute to precisely control registration:

```csharp
[InjectService(typeof(IMyService), ServiceLifetime.Scoped)]
public class MyService : IMyService
{
    // ...
}
```

## Best Practices Summary

### 1. Aggregate Design Principles
- Keep aggregates small and focused
- Access internal entities through the aggregate root
- Ensure consistency within aggregate boundaries
- Communicate across aggregates via domain events

### 2. Repository Usage Principles
- Create repositories only for aggregate roots
- Repository operations should be atomic
- Complete related operations within a single unit of work
- Avoid exposing data access details via IQueryable, because every method in a repository should express a clear business intent

### 3. Service Layering
- **Domain services**: core business logic
- **Application services**: coordinate operations across multiple aggregates
- **Infrastructure services**: technical services (caching, logging, etc.)

## Next Steps

Now that you understand the core concepts of MiCake, you can dive deeper into each specific component:

- [Entity](../../domain-driven/entity/) - learn the detailed usage of entities
- [Value Object](../../domain-driven/value-object/) - learn how to design value objects
- [Aggregate Root](../../domain-driven/aggregate-root/) - master aggregate design principles
- [Repository](../../domain-driven/repository/) - understand the repository pattern in depth
- [Domain Event](../../domain-driven/domain-event/) - implement event-driven architecture
