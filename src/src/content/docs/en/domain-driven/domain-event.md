---
title: Domain Events
description: Implement event-driven architecture and cross-aggregate communication using domain events
---

A Domain Event is an important pattern in Domain-Driven Design for capturing business facts. It records important business events that have occurred in the domain, enabling loosely coupled communication between aggregates.

## What is a Domain Event

A domain event represents something that has already happened in the domain, with the following characteristics:

1. **Business meaning**: reflects a real business fact
2. **Past tense**: event names use the past tense (e.g. `OrderPlaced`, not `PlaceOrder`)
3. **Immutability**: once an event is created, it cannot be modified
4. **Asynchronous processing**: event handlers respond to events asynchronously

## Defining a Domain Event

### A Basic Event

```csharp
using MiCake.DDD.Domain;

// Order submitted event
public class OrderSubmittedEvent : IDomainEvent
{
    public int OrderId { get; }
    public int CustomerId { get; }
    public decimal TotalAmount { get; }
    public DateTime SubmittedAt { get; }

    public OrderSubmittedEvent(int orderId, int customerId, decimal totalAmount)
    {
        OrderId = orderId;
        CustomerId = customerId;
        TotalAmount = totalAmount;
        SubmittedAt = DateTime.UtcNow;
    }
}

// User registered event
public class UserRegisteredEvent : IDomainEvent
{
    public int UserId { get; }
    public string Email { get; }
    public DateTime RegisteredAt { get; }

    public UserRegisteredEvent(int userId, string email)
    {
        UserId = userId;
        Email = email;
        RegisteredAt = DateTime.UtcNow;
    }
}
```

### Record Events (Recommended)

Using C# records allows you to define events more concisely:

```csharp
// Define events using records
public record ProductCreatedEvent(int ProductId, string Name, decimal Price) : IDomainEvent;

public record PriceChangedEvent(int ProductId, decimal OldPrice, decimal NewPrice) : IDomainEvent;

public record OrderCancelledEvent(int OrderId, string Reason) : IDomainEvent;
```

## Raising Domain Events

### Raising Events in an Aggregate Root

```csharp
public class Order : AggregateRoot<int>
{
    private List<OrderItem> _items = new();

    public int CustomerId { get; private set; }
    public OrderStatus Status { get; private set; }

    public void Submit()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Only draft orders can be submitted");

        if (!_items.Any())
            throw new DomainException("Cannot submit empty order");

        // Change the status
        Status = OrderStatus.Submitted;

        // Raise a domain event
        RaiseDomainEvent(new OrderSubmittedEvent(Id, CustomerId, TotalAmount));
    }

    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Shipped)
            throw new DomainException("Cannot cancel shipped order");

        Status = OrderStatus.Cancelled;
        RaiseDomainEvent(new OrderCancelledEvent(Id, reason));
    }

    public void AddItem(int productId, int quantity, decimal price)
    {
        var item = new OrderItem(productId, quantity, price);
        _items.Add(item);

        // Adding an item can also raise an event
        RaiseDomainEvent(new OrderItemAddedEvent(Id, productId, quantity));
    }
}
```

## Handling Domain Events

### Creating an Event Handler

```csharp
using MiCake.DDD.Domain;
using System.Threading;
using System.Threading.Tasks;

// Order submitted event handler
public class OrderSubmittedEventHandler : IDomainEventHandler<OrderSubmittedEvent>
{
    private readonly IEmailService _emailService;
    private readonly ILogger<OrderSubmittedEventHandler> _logger;

    public OrderSubmittedEventHandler(
        IEmailService emailService,
        ILogger<OrderSubmittedEventHandler> logger)
    {
        _emailService = emailService;
        _logger = logger;
    }

    public async Task HandleAysnc(OrderSubmittedEvent domainEvent, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation($"Order {domainEvent.OrderId} submitted by customer {domainEvent.CustomerId}");

        // Send the order confirmation email
        await _emailService.SendOrderConfirmationAsync(
            domainEvent.CustomerId,
            domainEvent.OrderId,
            domainEvent.TotalAmount
        );

        // Other business logic...
    }
}

// User registered event handler
public class UserRegisteredEventHandler : IDomainEventHandler<UserRegisteredEvent>
{
    private readonly IEmailService _emailService;
    private readonly IRepository<UserProfile, int> _profileRepository;

    public async Task HandleAysnc(UserRegisteredEvent domainEvent, CancellationToken cancellationToken = default)
    {
        // 1. Send a welcome email
        await _emailService.SendWelcomeEmailAsync(domainEvent.Email);

        // 2. Create the user profile
        var profile = UserProfile.Create(domainEvent.UserId);
        await _profileRepository.AddAsync(profile, cancellationToken);
        await _profileRepository.SaveChangesAsync(cancellationToken);

        // 3. Write a log
        Console.WriteLine($"User {domainEvent.UserId} registered at {domainEvent.RegisteredAt}");
    }
}
```

### One Event, Multiple Handlers

A single event can have multiple handlers:

```csharp
// Handler 1: send an email
public class OrderSubmittedEmailHandler : IDomainEventHandler<OrderSubmittedEvent>
{
    public async Task HandleAysnc(OrderSubmittedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Send an email
    }
}

// Handler 2: update inventory
public class OrderSubmittedInventoryHandler : IDomainEventHandler<OrderSubmittedEvent>
{
    public async Task HandleAysnc(OrderSubmittedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Decrease inventory
    }
}

// Handler 3: write a log
public class OrderSubmittedLoggingHandler : IDomainEventHandler<OrderSubmittedEvent>
{
    public async Task HandleAysnc(OrderSubmittedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Write a log
    }
}

// These three handlers are executed in sequence
```

## Automatic Event Dispatch

MiCake automatically dispatches domain events when `SaveChangesAsync()` is called:

```csharp
public class OrderService
{
    private readonly IRepository<Order, int> _orderRepository;

    public async Task SubmitOrder(int orderId)
    {
        // 1. Load the aggregate root
        var order = await _orderRepository.FindAsync(orderId);

        // 2. Call the business method (raises the event, but does not dispatch it yet)
        order.Submit();  // Internally: RaiseDomainEvent(new OrderSubmittedEvent(...))

        // 3. Update the aggregate root
        await _orderRepository.UpdateAsync(order);

        // 4. Save changes - all events are dispatched automatically at this point
        await _orderRepository.SaveChangesAsync();
        // The SaveChangesAsync internal flow:
        // a. Collect all pending events on the aggregate root
        // b. Persist the data to the database
        // c. Dispatch events to the corresponding handlers in order
        // d. Clear the dispatched events
    }
}
```

## The Event Dispatch Flow

```
1. Business method call
   order.Submit()
      ↓
2. Raise the domain event
   RaiseDomainEvent(new OrderSubmittedEvent(...))
      ↓
3. The event is temporarily stored on the aggregate root
   _domainEvents.Add(event)
      ↓
4. Save changes
   await repository.SaveChangesAsync()
      ↓
5. Collect all events
   events = aggregateRoot.DomainEvents
      ↓
6. Persist the data
   dbContext.SaveChanges()
      ↓
7. Dispatch the events
   foreach (event in events)
       foreach (handler in GetHandlers(event))
           await handler.HandleAsync(event)
      ↓
8. Clear the events
   aggregateRoot.ClearDomainEvents()
```

## Use Cases

### 1. Cross-Aggregate Communication

```csharp
// The order aggregate
public class Order : AggregateRoot<int>
{
    public void Submit()
    {
        Status = OrderStatus.Submitted;

        // Raise the event to notify other aggregates
        RaiseDomainEvent(new OrderSubmittedEvent(Id, Items));
    }
}

// The inventory aggregate responds in the event handler
public class OrderSubmittedInventoryHandler : IDomainEventHandler<OrderSubmittedEvent>
{
    private readonly IRepository<Product, int> _productRepository;

    public async Task HandleAysnc(OrderSubmittedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Decrease inventory
        foreach (var item in domainEvent.Items)
        {
            var product = await _productRepository.FindAsync(item.ProductId);
            product.DecreaseStock(item.Quantity);
            await _productRepository.UpdateAsync(product);
        }

        await _productRepository.SaveChangesAsync(cancellationToken);
    }
}
```

### 2. Business Process Coordination

```csharp
// The user registration flow
public class User : AggregateRoot<int>
{
    public void Register(string email, string password)
    {
        // Registration logic
        Email = email;
        SetPassword(password);
        Status = UserStatus.Pending;

        // Raise the registration event
        RaiseDomainEvent(new UserRegisteredEvent(Id, email));
    }
}

// Multiple handlers coordinate to complete the registration flow
public class SendVerificationEmailHandler : IDomainEventHandler<UserRegisteredEvent>
{
    public async Task HandleAysnc(UserRegisteredEvent domainEvent, CancellationToken cancellationToken)
    {
        // Send a verification email
    }
}

public class CreateUserProfileHandler : IDomainEventHandler<UserRegisteredEvent>
{
    public async Task HandleAysnc(UserRegisteredEvent domainEvent, CancellationToken cancellationToken)
    {
        // Create the user profile
    }
}

public class InitializeUserSettingsHandler : IDomainEventHandler<UserRegisteredEvent>
{
    public async Task HandleAysnc(UserRegisteredEvent domainEvent, CancellationToken cancellationToken)
    {
        // Initialize user settings
    }
}
```

### 3. Auditing and Logging

```csharp
public class OrderStatusChangedEvent : IDomainEvent
{
    public int OrderId { get; }
    public OrderStatus OldStatus { get; }
    public OrderStatus NewStatus { get; }
    public DateTime ChangedAt { get; }
}

public class OrderAuditEventHandler : IDomainEventHandler<OrderStatusChangedEvent>
{
    private readonly IAuditLogRepository _auditRepository;

    public async Task HandleAysnc(OrderStatusChangedEvent domainEvent, CancellationToken cancellationToken)
    {
        var auditLog = new AuditLog
        {
            EntityType = nameof(Order),
            EntityId = domainEvent.OrderId,
            Action = "StatusChanged",
            OldValue = domainEvent.OldStatus.ToString(),
            NewValue = domainEvent.NewStatus.ToString(),
            Timestamp = domainEvent.ChangedAt
        };

        await _auditRepository.AddAsync(auditLog);
        await _auditRepository.SaveChangesAsync(cancellationToken);
    }
}
```

### 4. Sending Notifications

```csharp
public class OrderShippedEvent : IDomainEvent
{
    public int OrderId { get; }
    public int CustomerId { get; }
    public string TrackingNumber { get; }
}

public class OrderShippedNotificationHandler : IDomainEventHandler<OrderShippedEvent>
{
    private readonly INotificationService _notificationService;

    public async Task HandleAysnc(OrderShippedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Send an email notification
        await _notificationService.SendEmailAsync(
            domainEvent.CustomerId,
            "Order Shipped",
            $"Your order has been shipped. Tracking number: {domainEvent.TrackingNumber}"
        );

        // Send an SMS notification
        await _notificationService.SendSmsAsync(
            domainEvent.CustomerId,
            $"Order shipped. Track: {domainEvent.TrackingNumber}"
        );

        // Send a push notification
        await _notificationService.SendPushNotificationAsync(
            domainEvent.CustomerId,
            "Order Shipped",
            "Your order is on the way!"
        );
    }
}
```

## Best Practices

### 1. Name Events in the Past Tense

```csharp
// ✅ Correct - use the past tense
public class OrderPlacedEvent : IDomainEvent { }
public class PaymentCompletedEvent : IDomainEvent { }
public class UserRegisteredEvent : IDomainEvent { }

// ❌ Wrong - use the present tense or imperative form
public class PlaceOrderEvent : IDomainEvent { }
public class CompletePaymentEvent : IDomainEvent { }
public class RegisterUserEvent : IDomainEvent { }
```

### 2. Events Should Be Immutable

```csharp
// ✅ Correct - all properties are read-only
public class OrderCreatedEvent : IDomainEvent
{
    public int OrderId { get; }  // Read-only
    public DateTime CreatedAt { get; }

    public OrderCreatedEvent(int orderId)
    {
        OrderId = orderId;
        CreatedAt = DateTime.UtcNow;
    }
}

// ❌ Wrong - properties can be modified
public class OrderCreatedEvent : IDomainEvent
{
    public int OrderId { get; set; }  // Mutable
    public DateTime CreatedAt { get; set; }
}
```

### 3. Keep Event Handlers Idempotent

```csharp
public class OrderCreatedEmailHandler : IDomainEventHandler<OrderCreatedEvent>
{
    private readonly IEmailService _emailService;
    private readonly IEmailLogRepository _emailLogRepository;

    public async Task HandleAysnc(OrderCreatedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Check whether it has already been sent (idempotency)
        var alreadySent = await _emailLogRepository.ExistsAsync(
            l => l.OrderId == domainEvent.OrderId && l.Type == "OrderCreated"
        );

        if (alreadySent)
            return;  // Already sent, skip

        // Send the email
        await _emailService.SendOrderConfirmationAsync(domainEvent.OrderId);

        // Record the log
        await _emailLogRepository.AddAsync(new EmailLog
        {
            OrderId = domainEvent.OrderId,
            Type = "OrderCreated",
            SentAt = DateTime.UtcNow
        });

        await _emailLogRepository.SaveChangesAsync(cancellationToken);
    }
}
```

### 4. Events Should Contain Sufficient Information

```csharp
// ✅ Good practice - include the necessary information
public class OrderSubmittedEvent : IDomainEvent
{
    public int OrderId { get; }
    public int CustomerId { get; }
    public decimal TotalAmount { get; }
    public List<OrderItemDto> Items { get; }  // Include detailed information
    public DateTime SubmittedAt { get; }

    // Event handlers do not need to query the order details again
}

// ❌ Bad practice - insufficient information
public class OrderSubmittedEvent : IDomainEvent
{
    public int OrderId { get; }  // Only the ID

    // Event handlers need to query the database for details
}
```

### 5. Avoid Long-Running Operations in Event Handlers

```csharp
// ❌ Avoid - synchronously execute time-consuming operations
public class OrderPlacedHandler : IDomainEventHandler<OrderPlacedEvent>
{
    public async Task HandleAysnc(OrderPlacedEvent domainEvent, CancellationToken cancellationToken)
    {
        // This blocks the transaction
        await SendEmailAsync();  // May be slow
        await CallExternalApiAsync();  // May fail
        await GeneratePdfAsync();  // Very time-consuming
    }
}

// ✅ Recommended - publish to a message queue for asynchronous processing
public class OrderPlacedHandler : IDomainEventHandler<OrderPlacedEvent>
{
    private readonly IMessageQueue _messageQueue;

    public async Task HandleAysnc(OrderPlacedEvent domainEvent, CancellationToken cancellationToken)
    {
        // Publish to the queue quickly
        await _messageQueue.PublishAsync(new SendOrderEmailCommand(domainEvent.OrderId));
        await _messageQueue.PublishAsync(new GenerateInvoiceCommand(domainEvent.OrderId));
    }
}
```

## Summary

The MiCake domain event mechanism:

- Implement the `IDomainEvent` interface to define events
- Raise events in aggregate roots via `RaiseDomainEvent`
- Implement `IDomainEventHandler<TEvent>` to handle events
- Dispatch events automatically when `SaveChangesAsync` is called
- Used to implement loosely coupled communication between aggregates
- Supports one event with multiple handlers

Next steps:
- Learn about [Domain Services](../domain-driven/domain-service/) to understand service design
- Read about [Unit of Work](../domain-driven/unit-of-work/) to understand transaction management
- Check out [Aggregate Roots](../domain-driven/aggregate-root/) to review aggregate design
