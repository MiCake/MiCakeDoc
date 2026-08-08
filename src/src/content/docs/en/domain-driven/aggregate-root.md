---
title: Aggregate Root
description: The root entity of an aggregate - the entry point for repository operations and transaction boundaries
---

An aggregate root is the root entity of an aggregate, and the entry point for repository operations and transaction boundaries. It is responsible for maintaining consistency among all objects within the aggregate.

## What is an Aggregate Root?

In DDD, an aggregate is a collection of related objects that are treated as a whole to maintain the consistency of business rules. The aggregate root is the root entity of an aggregate, and all external access to the aggregate must go through the aggregate root.

**Core characteristics:**
- The only external interface of the aggregate
- Transaction boundary
- Responsible for maintaining the invariants within the aggregate
- Repositories can only operate on aggregate roots

## Defining an Aggregate Root

In MiCake, an aggregate root must inherit from the `AggregateRoot<TKey>` base class:

### Using an Integer ID

```csharp
using MiCake.DDD.Domain;
using System.Collections.Generic;
using System.Linq;

public class Order : AggregateRoot<int>
{
    private readonly List<OrderItem> _items = new();

    public string CustomerName { get; private set; }
    public OrderStatus Status { get; private set; }
    public decimal TotalAmount { get; private set; }
    
    // Expose only a read-only collection
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    // Private constructor
    private Order() { }

    // Factory method
    public static Order Create(string customerName)
    {
        var order = new Order
        {
            CustomerName = customerName,
            Status = OrderStatus.Draft,
            TotalAmount = 0
        };

        order.RaiseDomainEvent(new OrderCreatedEvent(order.Id, customerName));
        return order;
    }

    // The aggregate root is responsible for managing the objects within the aggregate
    public void AddItem(int productId, string productName, decimal price, int quantity)
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Items can only be added to an order in the Draft status");

        var item = new OrderItem(productId, productName, price, quantity);
        _items.Add(item);
        
        RecalculateTotalAmount();
        RaiseDomainEvent(new OrderItemAddedEvent(Id, productId, quantity));
    }

    public void RemoveItem(int productId)
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Items can only be removed from an order in the Draft status");

        var item = _items.FirstOrDefault(x => x.ProductId == productId);
        if (item != null)
        {
            _items.Remove(item);
            RecalculateTotalAmount();
            RaiseDomainEvent(new OrderItemRemovedEvent(Id, productId));
        }
    }

    public void Confirm()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Only orders in the Draft status can be confirmed");

        if (!_items.Any())
            throw new DomainException("An order needs at least one item");

        Status = OrderStatus.Confirmed;
        RaiseDomainEvent(new OrderConfirmedEvent(Id, TotalAmount));
    }

    private void RecalculateTotalAmount()
    {
        TotalAmount = _items.Sum(item => item.Price * item.Quantity);
    }
}

// An entity within the aggregate
public class OrderItem : Entity<int>
{
    public int ProductId { get; private set; }
    public string ProductName { get; private set; }
    public decimal Price { get; private set; }
    public int Quantity { get; private set; }

    private OrderItem() { }

    internal OrderItem(int productId, string productName, decimal price, int quantity)
    {
        ProductId = productId;
        ProductName = productName;
        Price = price;
        Quantity = quantity;
    }
}

public enum OrderStatus
{
    Draft,
    Confirmed,
    Paid,
    Shipped,
    Completed,
    Cancelled
}
```

### Using the Default Integer ID

```csharp
public class Product : AggregateRoot  // Equivalent to AggregateRoot<int>
{
    public string Name { get; private set; }
    public decimal Price { get; private set; }
    public int Stock { get; private set; }
}
```

### Using Other ID Types

```csharp
// Using GUID
public class Customer : AggregateRoot<Guid>
{
    public string Name { get; private set; }
    public string Email { get; private set; }
}

// Using string
public class Tenant : AggregateRoot<string>
{
    public string Name { get; private set; }
    public bool IsActive { get; private set; }
}
```

## Aggregate Root Characteristics

### 1. Encapsulation of Objects Within the Aggregate

The aggregate root should encapsulate all objects within the aggregate; external code cannot modify them directly:

```csharp
public class Order : AggregateRoot<int>
{
    private readonly List<OrderItem> _items = new();

    // ✅ Correct: return a read-only collection
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    // ✅ Correct: modify objects within the aggregate through the aggregate root's methods
    public void AddItem(int productId, string productName, decimal price, int quantity)
    {
        var item = new OrderItem(productId, productName, price, quantity);
        _items.Add(item);
        RecalculateTotalAmount();
    }

    public void UpdateItemQuantity(int productId, int newQuantity)
    {
        var item = _items.FirstOrDefault(x => x.ProductId == productId);
        if (item == null)
            throw new DomainException("Order item does not exist");

        // Update through the aggregate root
        item.UpdateQuantity(newQuantity);
        RecalculateTotalAmount();
    }
}

// ❌ Wrong: expose a mutable collection
public class Order : AggregateRoot<int>
{
    public List<OrderItem> Items { get; set; } // External code can modify this directly
}
```

### 2. Maintaining Invariants

The aggregate root is responsible for maintaining the business rules (invariants) within the aggregate:

```csharp
public class ShoppingCart : AggregateRoot<int>
{
    private readonly List<CartItem> _items = new();
    private const int MaxItemCount = 100;
    private const decimal MaxTotalAmount = 50000m;

    public IReadOnlyCollection<CartItem> Items => _items.AsReadOnly();
    public decimal TotalAmount { get; private set; }

    public void AddItem(int productId, string productName, decimal price, int quantity)
    {
        // Invariant 1: cart item count limit
        if (_items.Count >= MaxItemCount)
            throw new DomainException($"A cart can contain at most {MaxItemCount} items");

        // Invariant 2: cart total amount limit
        var newTotalAmount = TotalAmount + (price * quantity);
        if (newTotalAmount > MaxTotalAmount)
            throw new DomainException($"The cart total cannot exceed {MaxTotalAmount}");

        // Invariant 3: each product can only be added once
        if (_items.Any(x => x.ProductId == productId))
            throw new DomainException("This product is already in the cart");

        var item = new CartItem(productId, productName, price, quantity);
        _items.Add(item);
        TotalAmount = newTotalAmount;
    }
}
```

### 3. Domain Events

An aggregate root can raise domain events to notify about important changes occurring in the domain:

```csharp
public class Order : AggregateRoot<int>
{
    public OrderStatus Status { get; private set; }

    public void Confirm()
    {
        Status = OrderStatus.Confirmed;
        RaiseDomainEvent(new OrderConfirmedEvent(Id));
    }

    public void Pay(decimal amount, string paymentMethod)
    {
        if (Status != OrderStatus.Confirmed)
            throw new DomainException("Only confirmed orders can be paid");

        if (amount != TotalAmount)
            throw new DomainException("Incorrect payment amount");

        Status = OrderStatus.Paid;
        RaiseDomainEvent(new OrderPaidEvent(Id, amount, paymentMethod));
    }

    public void Ship(string trackingNumber)
    {
        if (Status != OrderStatus.Paid)
            throw new DomainException("Only paid orders can be shipped");

        Status = OrderStatus.Shipped;
        RaiseDomainEvent(new OrderShippedEvent(Id, trackingNumber));
    }
}
```

## Aggregate Design Principles

### 1. Small Aggregates

Aggregates should be as small as possible, containing only the objects that must maintain consistency:

```csharp
// ✅ Correct: small aggregate
public class Order : AggregateRoot<int>
{
    private readonly List<OrderItem> _items = new();
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();
    
    // Order and OrderItem must maintain consistency
}

// ❌ Wrong: large aggregate
public class Order : AggregateRoot<int>
{
    public Customer Customer { get; set; } // Customer should be an independent aggregate root
    public List<OrderItem> Items { get; set; }
    public Payment Payment { get; set; }   // Payment may be an independent aggregate root
    public Shipment Shipment { get; set; } // Shipment may be an independent aggregate root
}
```

### 2. Reference Other Aggregates by ID

Aggregates should not hold direct object references to each other; instead, they should reference by ID:

```csharp
// ✅ Correct: reference by ID
public class Order : AggregateRoot<int>
{
    public int CustomerId { get; private set; }  // References the ID of the Customer aggregate
    public int ShippingAddressId { get; private set; }
}

// ❌ Wrong: hold a direct object reference
public class Order : AggregateRoot<int>
{
    public Customer Customer { get; set; }  // Directly references another aggregate root
    public Address ShippingAddress { get; set; }
}
```

## Aggregate Root Design Best Practices

### 1. Use Factory Methods to Create Aggregate Roots

```csharp
public class Order : AggregateRoot<int>
{
    private Order() { } // Private constructor

    public static Order Create(int customerId, Address shippingAddress)
    {
        // Validation
        if (customerId <= 0)
            throw new DomainException("Invalid customer ID");

        if (shippingAddress == null)
            throw new DomainException("Shipping address cannot be empty");

        var order = new Order
        {
            CustomerId = customerId,
            ShippingAddress = shippingAddress,
            Status = OrderStatus.Draft,
            CreatedAt = DateTime.UtcNow
        };

        order.RaiseDomainEvent(new OrderCreatedEvent(order.Id, customerId));
        return order;
    }
}
```

### 2. Use Private Collections and Internal Constructors

```csharp
public class Order : AggregateRoot<int>
{
    // Private collection
    private readonly List<OrderItem> _items = new();

    // Expose a read-only collection
    public IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    public void AddItem(int productId, string productName, decimal price, int quantity)
    {
        // Internal constructor - can only be created through the aggregate root
        var item = new OrderItem(productId, productName, price, quantity);
        _items.Add(item);
    }
}

public class OrderItem : Entity<int>
{
    // Internal constructor
    internal OrderItem(int productId, string productName, decimal price, int quantity)
    {
        ProductId = productId;
        ProductName = productName;
        Price = price;
        Quantity = quantity;
    }
}
```

### 3. Implement State Transition Methods

```csharp
public class Order : AggregateRoot<int>
{
    public OrderStatus Status { get; private set; }

    public void Confirm()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException($"An order cannot be confirmed from the {Status} status");

        Status = OrderStatus.Confirmed;
        RaiseDomainEvent(new OrderConfirmedEvent(Id));
    }

    public void Pay(PaymentInfo paymentInfo)
    {
        if (Status != OrderStatus.Confirmed)
            throw new DomainException($"An order cannot be paid from the {Status} status");

        Status = OrderStatus.Paid;
        RaiseDomainEvent(new OrderPaidEvent(Id, paymentInfo));
    }

    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Shipped || Status == OrderStatus.Completed)
            throw new DomainException($"An order in the {Status} status cannot be cancelled");

        Status = OrderStatus.Cancelled;
        RaiseDomainEvent(new OrderCancelledEvent(Id, reason));
    }
}
```

## Working with Repositories

Aggregate roots are the objects that repositories operate on:

```csharp
public class OrderService
{
    private readonly IOrderRepository _orderRepository;

    public async Task<int> CreateOrder(CreateOrderDto dto)
    {
        // Create the aggregate root
        var order = Order.Create(dto.CustomerId, dto.ShippingAddress);
        
        // Add order items
        foreach (var item in dto.Items)
        {
            order.AddItem(item.ProductId, item.ProductName, item.Price, item.Quantity);
        }

        // Persist the aggregate root (committed by the ambient UoW; domain events are dispatched at commit)
        await _orderRepository.AddAsync(order);
        await _unitOfWork.CommitAsync();

        return order.Id;
    }

    public async Task ConfirmOrder(int orderId)
    {
        // Load the aggregate root
        var order = await _orderRepository.FindAsync(orderId);
        if (order == null)
            throw new NotFoundException("Order does not exist");

        // Execute the domain operation
        order.Confirm();

        // Commit the changes (via the ambient UoW)
        await _unitOfWork.CommitAsync();
    }
}
```

## Aggregate Root vs Entity

| Feature | Aggregate Root | Entity |
|---------|----------------|--------|
| Identity | ✅ Yes | ✅ Yes |
| Can exist independently | ✅ Yes | ❌ No |
| Repository access | ✅ Yes | ❌ No |
| Transaction boundary | ✅ Yes | ❌ No |
| External interface | ✅ Yes | ❌ No |

## Notes

1. **Aggregates should be as small as possible**: contain only the objects that must be modified together
2. **One transaction modifies only one aggregate root**: use domain events for cross-aggregate operations
3. **Reference other aggregates by ID**: do not hold direct aggregate root references
4. **Encapsulate objects within the aggregate**: external code can only access them through the aggregate root
5. **Maintain aggregate invariants**: ensure the aggregate is always in a valid state

## Next Steps

- Learn how to use [Repositories](/en/domain-driven/repository/) to persist aggregate roots
- Learn about [Domain Events](/en/domain-driven/domain-event/) for cross-aggregate operations
- Explore [Unit of Work](/en/domain-driven/unit-of-work/) to manage transactions
