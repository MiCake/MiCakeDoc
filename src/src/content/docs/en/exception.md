---
title: Exception Handling
description: Learn about MiCake's unified exception handling mechanism, including domain exceptions, business exceptions, and global exception handling
---

MiCake provides a unified exception handling mechanism, including domain exceptions, business exceptions, and more, and can automatically convert exceptions into a unified API response format.

## The MiCake Exception Hierarchy

### MiCakeException - The Base Exception

The base class of all MiCake exceptions:

```csharp
using MiCake.Core;

public class MiCakeException : Exception
{
    // The exception code
    public virtual string? Code { get; set; }
    
    // The exception details
    public virtual object? Details { get; set; }

    public MiCakeException(string message, string? details = null, string? code = null)
        : base(message)
    {
        Code = code;
        Details = details;
    }

    public MiCakeException(
        string message, 
        Exception innerException,
        string? details = null,
        string? code = null)
        : base(message, innerException)
    {
        Code = code;
        Details = details;
    }
}
```

### DomainException - The Domain Exception

Used to represent exceptions that violate domain rules:

```csharp
using MiCake.DDD.Domain;

public class DomainException : MiCakeException
{
    public DomainException(string message) 
        : base(message, code: "DOMAIN_ERROR")
    {
    }

    public DomainException(string message, string code)
        : base(message, code: code)
    {
    }
}
```

## Using Exceptions

### In an Aggregate Root

```csharp
public class Order : AggregateRoot<int>
{
    public OrderStatus Status { get; private set; }
    public decimal TotalAmount { get; private set; }

    public void Confirm()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("Only draft orders can be confirmed");

        if (TotalAmount <= 0)
            throw new DomainException("The order amount must be greater than zero");

        if (!Items.Any())
            throw new DomainException("An order needs at least one item");

        Status = OrderStatus.Confirmed;
        RaiseDomainEvent(new OrderConfirmedEvent(Id));
    }

    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Shipped || Status == OrderStatus.Completed)
            throw new DomainException(
                "Shipped or completed orders cannot be cancelled",
                code: "ORDER_CANCEL_NOT_ALLOWED"
            );

        Status = OrderStatus.Cancelled;
        RaiseDomainEvent(new OrderCancelledEvent(Id, reason));
    }
}
```

### Custom Exceptions

```csharp
// A business exception
public class BusinessException : MiCakeException
{
    public BusinessException(string message, string? code = null)
        : base(message, code: code ?? "BUSINESS_ERROR")
    {
    }
}
```

## Global Exception Handling

MiCake provides a global exception handling mechanism that automatically converts exceptions into a unified API response.

### The Exception Response Format

When an exception occurs, the API returns the following format:

```json
{
  "code": "DOMAIN_ERROR",
  "message": "Only draft orders can be confirmed",
  "errors": null
}
```

## Exception Best Practices

### 1. Use Specific Exception Types

```csharp
// ✅ Correct: use a specific exception type
public async Task<Order> GetOrder(int orderId)
{
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new NotFoundException("Order", orderId);
    
    return order;
}

// ❌ Wrong: use a generic exception
public async Task<Order> GetOrder(int orderId)
{
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new Exception("Order not found");
    
    return order;
}
```

### 2. Provide Clear Error Messages

```csharp
// ✅ Correct: clear error messages
throw new DomainException("Only draft orders can be confirmed");
throw new ValidationException("The email format is incorrect");
throw new BusinessException("Insufficient stock - the order cannot be completed");

// ❌ Wrong: vague error messages
throw new Exception("Error");
throw new Exception("Invalid");
throw new Exception("Failed");
```

### 3. Use Error Codes

```csharp
// ✅ Correct: use error codes
throw new DomainException("The order cannot be cancelled", code: "ORDER_CANCEL_NOT_ALLOWED");
throw new BusinessException("Insufficient stock", code: "INSUFFICIENT_STOCK");

// Clients can use the error codes for internationalization or special handling
```

### 4. Include Useful Context Information

```csharp
// ✅ Correct: include context information
throw new DomainException(
    $"Product '{product.Name}' has insufficient stock. Current stock: {product.Stock}, quantity requested: {quantity}",
    code: "INSUFFICIENT_STOCK"
);

// ❌ Wrong: missing context
throw new DomainException("Insufficient stock");
```

### 5. Do Not Swallow Exceptions

```csharp
// ❌ Wrong: swallowing the exception
try
{
    await ProcessOrder(order);
}
catch (Exception)
{
    // Do nothing
}

// ✅ Correct: log and rethrow
try
{
    await ProcessOrder(order);
}
catch (Exception ex)
{
    _logger.LogError(ex, "Failed to process order: OrderId={OrderId}", order.Id);
    throw;
}

// ✅ Or convert it to a more specific exception
try
{
    await ProcessOrder(order);
}
catch (DbUpdateException ex)
{
    _logger.LogError(ex, "Failed to save order: OrderId={OrderId}", order.Id);
    throw new BusinessException("Failed to save the order. Please try again later");
}
```

## Handling Exceptions in Controllers

Although MiCake provides global exception handling, you can still do specific exception handling in controllers:

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;

    [HttpPost]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        try
        {
            var orderId = await _orderService.CreateOrder(dto);
            return Ok(new { orderId });
        }
        catch (ValidationException ex)
        {
            // Special handling for validation exceptions
            return BadRequest(new
            {
                code = ex.Code,
                message = ex.Message,
                errors = ex.Errors
            });
        }
        catch (BusinessException ex)
        {
            // Log the business exception
            _logger.LogWarning(ex, "Business exception while creating an order");
            throw; // Rethrow - handled by the global handler
        }
        // Other exceptions are handled by the global exception handler
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(int id)
    {
        try
        {
            var order = await _orderService.GetOrder(id);
            return Ok(order);
        }
        catch (NotFoundException)
        {
            return NotFound(new { message = $"Order {id} does not exist" });
        }
    }
}
```

## Notes

1. **Use specific exceptions**: create concrete exception types instead of using the generic `Exception`
2. **Provide clear messages**: exception messages should clearly describe the problem
3. **Use error codes**: make it easy for clients to do special handling and internationalization
4. **Do not over-catch**: only catch the exceptions you can handle
5. **Log exceptions**: log the exception information before rethrowing
