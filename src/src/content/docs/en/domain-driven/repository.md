---
title: Repository
description: Learn how the repository pattern is implemented in MiCake and its best practices
---

A Repository is a pattern in Domain-Driven Design used to encapsulate data access logic. In MiCake, repositories provide a collection-like interface for operating on aggregate roots, hiding the complexity of the underlying persistence.

## What is a Repository

Core ideas of the repository pattern:
- **Abstract data access**: separate data access logic from business logic
- **Aggregate-root oriented**: only provide repositories for aggregate roots, never for internal entities
- **Collection-like**: provide collection-like APIs (Add, Remove, Find, etc.)
- **Hide persistence details**: the business layer doesn't need to know how data is stored

## Repository Interfaces

### The IRepository Interface

MiCake provides the `IRepository<TAggregateRoot, TKey>` interface:

```csharp
using MiCake.DDD.Domain;
using System.Threading;
using System.Threading.Tasks;

public interface IRepository<TAggregateRoot, TKey> 
    where TAggregateRoot : class, IAggregateRoot<TKey>
    where TKey : notnull
{
    // Query
    IQueryable<TAggregateRoot> Query();
    Task<TAggregateRoot?> FindAsync(TKey id, CancellationToken cancellationToken = default);
    Task<long> GetCountAsync(CancellationToken cancellationToken = default);

    // Add
    Task AddAsync(TAggregateRoot aggregateRoot, CancellationToken cancellationToken = default);
    Task<TAggregateRoot> AddAndReturnAsync(TAggregateRoot aggregateRoot, bool saveNow = true, CancellationToken cancellationToken = default);

    // Update
    Task UpdateAsync(TAggregateRoot aggregateRoot, CancellationToken cancellationToken = default);

    // Delete
    Task DeleteAsync(TAggregateRoot aggregateRoot, CancellationToken cancellationToken = default);
    Task DeleteByIdAsync(TKey id, CancellationToken cancellationToken = default);

    // Save
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
```

### The IReadOnlyRepository Interface

A read-only repository is used for query scenarios:

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

## Automatic Repository Registration

When a repository interface and its implementation follow the conventions, MiCake will automatically create repository implementations for aggregate roots using the `AutoRegisterRepositories` extension method - no manual implementation is needed:

### Registering in a Module

```csharp
using MiCake.Core.Modularity;

public class OrderModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // Scan the assembly and automatically create repositories for all aggregate roots
        context.AutoRegisterRepositories(typeof(OrderModule).Assembly);

        base.ConfigureServices(context);
    }
}
```

The default conventions are:
- The repository interface is named `I{AggregateRootClassName}Repository`, e.g. `IOrderRepository`.
- The repository implementation is named `{AggregateRootClassName}Repository`, e.g. `OrderRepository`.

MiCake will then automatically map `IOrderRepository` to `OrderRepository`.

This method also accepts an optional parameter of type `CustomerRepositorySelector` to customize the repository selection rules. You can implement this interface according to your needs. For example:

```csharp
const customSelector = (repo, repoInterface, index) =>
{
    return repoInterface.Name.Contains(repo.Name);
};
```

### Using a Repository

```csharp
public class OrderService
{
    private readonly IOrderRepository _orderRepository;

    // The repository is injected automatically via dependency injection
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

## Repository Operations

### 1. Adding an Aggregate Root

```csharp
public async Task CreateOrder(CreateOrderDto dto)
{
    // Create the aggregate root
    var order = Order.Create(dto.CustomerId);
    order.AddItem(dto.ProductId, dto.Quantity, dto.Price);

    // Add to the repository
    await _orderRepository.AddAsync(order);

    // Save changes
    await _orderRepository.SaveChangesAsync();
    // SaveChangesAsync will:
    // 1. Persist the aggregate root
    // 2. Automatically dispatch domain events
    // 3. Update audit fields
}
```

### 2. Adding and Returning (Getting the Auto-Increment ID)

```csharp
public async Task<Order> CreateOrderAndReturn(CreateOrderDto dto)
{
    var order = Order.Create(dto.CustomerId);
    order.AddItem(dto.ProductId, dto.Quantity, dto.Price);

    // Add and save immediately, returning the object with the generated ID
    var savedOrder = await _orderRepository.AddAndReturnAsync(order, saveNow: true);

    Console.WriteLine($"New order ID: {savedOrder.Id}");
    return savedOrder;
}
```

### 3. Querying an Aggregate Root

```csharp
public async Task<Order?> GetOrder(int orderId)
{
    // Query by ID
    var order = await _orderRepository.FindAsync(orderId);
    return order;
}

public async Task<Order?> GetOrderWithItems(int orderId)
{
    // Include navigation properties
    var order = await _orderRepository.FindAsync(
        orderId,
        query => query.Include(o => o.Items)
    );
    return order;
}

public async Task<List<Order>> GetCustomerOrders(int customerId)
{
    // Use LINQ queries. It is generally not recommended to use Query() for complex queries outside the repository, unless for certain query-only scenarios
    var orders = await _orderRepository.Query()
        .Where(o => o.CustomerId == customerId)
        .Where(o => o.Status != OrderStatus.Cancelled)
        .OrderByDescending(o => o.OrderDate)
        .ToListAsync();

    return orders;
}
```

### 4. Updating an Aggregate Root

```csharp
public async Task UpdateOrder(int orderId, UpdateOrderDto dto)
{
    // Load the aggregate root
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new DomainException("Order not found");

    // Modify through the aggregate root's methods
    order.UpdateShippingAddress(dto.ShippingAddress);
}
```

### 5. Deleting an Aggregate Root

```csharp
public async Task DeleteOrder(int orderId)
{
    // Option 1: load first, then delete
    var order = await _orderRepository.FindAsync(orderId);
    if (order != null)
    {
        await _orderRepository.DeleteAsync(order);
        await _orderRepository.SaveChangesAsync();
    }

    // Option 2: delete directly by ID
    await _orderRepository.DeleteByIdAsync(orderId);
    await _orderRepository.SaveChangesAsync();
}
```

## Complex Queries

Complex queries allow us to use `IQueryable` objects for flexible data querying, so we can skip creating dedicated methods in the repository.
However, note that if this approach is overused, it defeats the purpose of the repository pattern in DDD. Every data query beneath the repository should have "domain meaning", such as "get a user by phone number", "get orders marked with a certain status", and so on.
By using these domain-meaningful query methods, we can better express domain intent rather than directly exposing the details of data queries.

However, in some scenarios, complex queries may be needed to fit UI display or data analysis.

### Using the Query() Method

```csharp
public class OrderQueryService
{
    private readonly IReadOnlyRepository<Order, int> _orderRepository;

    public async Task<List<OrderSummaryDto>> GetOrderSummaries(OrderFilterDto filter)
    {
        var query = _orderRepository.Query();

        // Apply filter conditions
        if (filter.CustomerId.HasValue)
            query = query.Where(o => o.CustomerId == filter.CustomerId.Value);

        if (filter.StartDate.HasValue)
            query = query.Where(o => o.OrderDate >= filter.StartDate.Value);

        if (filter.EndDate.HasValue)
            query = query.Where(o => o.OrderDate <= filter.EndDate.Value);

        if (filter.Status.HasValue)
            query = query.Where(o => o.Status == filter.Status.Value);

        // Project to DTO
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

### Including Navigation Properties

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

## Automatic Domain Event Dispatch

MiCake automatically dispatches domain events when `SaveChangesAsync` is called:

```csharp
public async Task SubmitOrder(int orderId)
{
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new DomainException("Order not found");

    // Call a business method that raises a domain event
    order.Submit();  // Internally calls RaiseDomainEvent(new OrderSubmittedEvent(...))

    await _orderRepository.UpdateAsync(order);

    // SaveChangesAsync will automatically:
    // 1. Persist the data
    // 2. Collect all domain events on the aggregate root
    // 3. Dispatch events to the corresponding handlers in order
    // 4. Clear the dispatched events
    await _orderRepository.SaveChangesAsync();

    // At this point OrderSubmittedEvent has been handled
}
```

## Soft Delete Support

For aggregate roots implementing the `ISoftDelete` interface, the repository automatically handles soft deletion:

```csharp
public class Product : AggregateRoot<int>, ISoftDelete
{
    public string Name { get; private set; }
    public bool IsDeleted { get; set; }
    public DateTime? DeletedTime { get; set; }
}

// Using the repository
public async Task DeleteProduct(int productId)
{
    var product = await _productRepository.FindAsync(productId);
    
    // Calling DeleteAsync sets IsDeleted = true
    await _productRepository.DeleteAsync(product);
    await _productRepository.SaveChangesAsync();
    
    // The product is not physically deleted; it is only marked as deleted
}

// Queries automatically filter out soft-deleted data
public async Task<List<Product>> GetActiveProducts()
{
    // Query() automatically adds the .Where(p => !p.IsDeleted) filter
    var products = await _productRepository.Query()
        .Where(p => p.Price > 0)
        .ToListAsync();
    
    // Only non-deleted products are returned
    return products;
}
```

## Audit Support

For aggregate roots implementing audit interfaces, the repository automatically fills in audit fields:

```csharp
public class Article : AggregateRoot<int>, IHasCreationTime, IHasModificationTime
{
    public string Title { get; private set; }
    public DateTime CreatedTime { get; set; }  // Filled automatically
    public DateTime? ModifiedTime { get; set; }  // Filled automatically
}

// On creation
var article = Article.Create("My Article");
await _articleRepository.AddAsync(article);
await _articleRepository.SaveChangesAsync();
// CreatedTime is automatically set to the current time

// On update
article.UpdateTitle("New Title");
await _articleRepository.UpdateAsync(article);
await _articleRepository.SaveChangesAsync();
// ModifiedTime is automatically updated to the current time
```

## Repository Best Practices

### 1. Create Repositories Only for Aggregate Roots

```csharp
// ✅ Correct - create a repository for an aggregate root
public class Order : AggregateRoot<int> { }
// Use: IRepository<Order, int>

// ❌ Wrong - do not create a repository for internal entities
public class OrderItem : Entity<int> { }
// Do not: IRepository<OrderItem, int>

// ✅ Correct - access internal entities through the aggregate root
var order = await _orderRepository.FindAsync(orderId);
var items = order.Items;  // Access through the aggregate root
```

### 2. Design Query Methods Based on Domain Intent

```csharp
// ✅ Correct - design methods based on domain intent
public async Task<List<Order>> GetPendingOrdersByCustomer(int customerId)
{
    return await _orderRepository.Query()
        .Where(o => o.CustomerId == customerId && o.Status == OrderStatus.Pending)
        .ToListAsync();
}

// ❌ Wrong - do not expose data query details
public async Task<List<Order>> GetOrdersByRawFilter(string filter)
{
    // This kind of method lacks domain meaning
    throw new NotImplementedException();
}
```

## Frequently Asked Questions

### Q: When does the repository automatically dispatch domain events?

A: All pending events on aggregate roots are dispatched automatically when `SaveChangesAsync()` is called. If you use the default `MiCake.AspNetCore` module integration and the `IsAutoUowEnabled` option of `MiCakeAspNetUowOption` is enabled (defaults to true), `SaveChangesAsync()` is called automatically at the end of every HTTP request - no manual action is required.

### Q: What is the difference between Query() and FindAsync()?

A: 
- `Query()` returns an `IQueryable` used to build complex queries
- `FindAsync()` queries a single object directly by ID

## Summary

The MiCake repository pattern:

- Creates repositories only for aggregate roots
- Registers automatically - no manual implementation needed
- Provides collection-like APIs
- Dispatches domain events automatically
- Supports soft delete and auditing
- Hides persistence details

Next steps:
- Learn about [Domain Events](../domain-driven/domain-event/) to understand event-driven development
- Read about [Unit of Work](../domain-driven/unit-of-work/) to understand transaction management
- Check out [Aggregate Roots](../domain-driven/aggregate-root/) to understand aggregate design
