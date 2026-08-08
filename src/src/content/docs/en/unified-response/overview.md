---
title: Unified Response Format
description: Learn about MiCake's unified API response wrapping feature for standard, consistent API responses
---

MiCake provides a unified API response wrapping feature that automatically wraps controller return values into a standard format, making API responses more standardized and consistent.

## The Standard Response Format

MiCake's standard response format contains three fields:

```json
{
  "code": "200",
  "message": "Success",
  "data": {
    // The actual returned data
  }
}
```

**Field description:**
- `code`: the business status code (a string type)
- `message`: the response message
- `data`: the actual business data

## Basic Usage

### Enabled by Default

MiCake enables response wrapping by default - no additional configuration is needed:

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    [HttpGet("{id}")]
    public async Task<Order> GetOrder(int id)
    {
        var order = await _orderRepository.FindAsync(id);
        return order;
    }
}

// The actual response:
// {
//   "code": "200",
//   "message": "Success",
//   "data": {
//     "id": 1,
//     "customerName": "Zhang San",
//     "totalAmount": 999.00
//   }
// }
```

### Collection Data

```csharp
[HttpGet]
public async Task<List<OrderDto>> GetOrders()
{
    return await _orderService.GetAllOrders();
}

// Response:
// {
//   "code": "200",
//   "message": "Success",
//   "data": [
//     { "id": 1, "customerName": "Zhang San" },
//     { "id": 2, "customerName": "Li Si" }
//   ]
// }
```

### Simple Types

```csharp
[HttpPost]
public async Task<int> CreateOrder([FromBody] CreateOrderDto dto)
{
    return await _orderService.CreateOrder(dto);
}

// Response:
// {
//   "code": "200",
//   "message": "Success",
//   "data": 123
// }
```

## Error Responses

Exceptions are automatically converted into the error response format:

```csharp
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    var order = await _orderRepository.FindAsync(id);
    if (order == null)
        throw new NotFoundException("Order", id);
    
    return order;
}

// When the order does not exist:
// {
//   "code": "NOT_FOUND",
//   "message": "Order with id 123 was not found",
//   "errors": null
// }
```

### Validation Errors

```csharp
[HttpPost]
public async Task<int> CreateOrder([FromBody] CreateOrderDto dto)
{
    if (!ModelState.IsValid)
    {
        var errors = ModelState.Values
            .SelectMany(v => v.Errors)
            .Select(e => e.ErrorMessage)
            .ToList();
        
        throw new ValidationException("Validation failed", errors);
    }

    return await _orderService.CreateOrder(dto);
}

// When validation fails:
// {
//   "code": "VALIDATION_ERROR",
//   "message": "Validation failed",
//   "errors": [
//     { "field": "CustomerName", "message": "The customer name cannot be empty" },
//     { "field": "TotalAmount", "message": "The amount must be greater than zero" }
//   ]
// }
```

## Custom Responses

### Using ApiResponse

If you need to customize the response, you can use the `ApiResponse` class:

```csharp
using MiCake.AspNetCore.Responses;

[HttpPost]
public async Task<ApiResponse<int>> CreateOrder([FromBody] CreateOrderDto dto)
{
    var orderId = await _orderService.CreateOrder(dto);
    
    return new ApiResponse<int>
    {
        Code = "ORDER_CREATED",
        Message = "The order was created successfully",
        Data = orderId
    };
}

// Response:
// {
//   "code": "ORDER_CREATED",
//   "message": "The order was created successfully",
//   "data": 123
// }
```

### Custom Error Responses

```csharp
[HttpPost]
public async Task<ApiResponse<bool>> ProcessOrder(int orderId)
{
    try
    {
        await _orderService.ProcessOrder(orderId);
        return new ApiResponse<bool>
        {
            Code = "SUCCESS",
            Message = "The order was processed successfully",
            Data = true
        };
    }
    catch (BusinessException ex)
    {
        return new ApiResponse<bool>
        {
            Code = ex.Code ?? "BUSINESS_ERROR",
            Message = ex.Message,
            Data = false
        };
    }
}
```

## Disabling Response Wrapping

### Disabling at the Method Level

For certain special endpoints, you may not want response wrapping:

```csharp
using MiCake.AspNetCore.Responses;

[HttpGet("raw")]
[DisableResponseWrapper] // Disable response wrapping
public async Task<Order> GetRawOrder(int id)
{
    return await _orderRepository.FindAsync(id);
}

// Returns the order object directly, unwrapped:
// {
//   "id": 1,
//   "customerName": "Zhang San",
//   "totalAmount": 999.00
// }
```

### Disabling at the Controller Level

```csharp
[ApiController]
[Route("api/[controller]")]
[DisableResponseWrapper] // Disable response wrapping for the entire controller
public class RawDataController : ControllerBase
{
    // None of the methods will have response wrapping
}
```

## Configuring Response Wrapping

### Global Configuration

Configure the response wrapping options in `Startup.cs`:

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
    {
        options.AspNetConfig = asp =>
        {
            // Configure the data wrapper
            asp.DataWrapperOptions = wrapperOptions =>
            {
                // Set the default success code
                wrapperOptions.DefaultSuccessCode = "0";
                
                // Set the default success message
                wrapperOptions.DefaultSuccessMessage = "Operation succeeded";
                
                // Set the default error message
                wrapperOptions.DefaultErrorMessage = "Operation failed";
            };
        };
    }).Build();
}
```

### A Custom Wrapper

If you need to fully customize the response format, you can implement the `IResponseWrapper` interface:

```csharp
public class CustomResponseWrapper : IResponseWrapper
{
    public string? Code { get; set; }
    public string? Message { get; set; }
    public object? Data { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? TraceId { get; set; }
}

// Register the custom wrapper
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        context.Services.AddSingleton<IResponseWrapper, CustomResponseWrapper>();
        base.ConfigureServices(context);
    }
}
```

## Response Wrapping Best Practices

### 1. Keep It Consistent

Use a unified response format throughout the entire application:

```csharp
// ✅ Correct: let MiCake wrap the response automatically
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    return await _orderRepository.FindAsync(id);
}

// ❌ Not recommended: manually build the response object
[HttpGet("{id}")]
public async Task<IActionResult> GetOrder(int id)
{
    var order = await _orderRepository.FindAsync(id);
    return Ok(new { code = "200", data = order });
}
```

### 2. Use Appropriate HTTP Status Codes

MiCake automatically sets the correct HTTP status code:

```csharp
// Success: 200 OK
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    return await _orderRepository.FindAsync(id);
}

// Not found: 404 Not Found
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    var order = await _orderRepository.FindAsync(id);
    if (order == null)
        throw new NotFoundException("Order", id);
    return order;
}

// Validation error: 400 Bad Request
[HttpPost]
public async Task<int> CreateOrder([FromBody] CreateOrderDto dto)
{
    if (!ModelState.IsValid)
        throw new ValidationException("Validation failed");
    return await _orderService.CreateOrder(dto);
}
```

### 3. Provide Meaningful Error Codes

```csharp
// ✅ Correct: use meaningful error codes
throw new BusinessException("Insufficient stock", code: "INSUFFICIENT_STOCK");
throw new BusinessException("The order has been cancelled", code: "ORDER_CANCELLED");

// ❌ Wrong: use a generic error code
throw new Exception("Error");
```

### 4. Keep Return Types Consistent

```csharp
// ✅ Correct: consistent return types
[HttpGet]
public async Task<List<OrderDto>> GetOrders()
{
    return await _orderService.GetAllOrders();
}

// ❌ Not recommended: inconsistent return types
[HttpGet]
public async Task<IActionResult> GetOrders()
{
    var orders = await _orderService.GetAllOrders();
    if (!orders.Any())
        return NotFound();
    return Ok(orders);
}
```

## Notes

1. **Enabled by default**: MiCake enables response wrapping by default
2. **Automatic exception handling**: exceptions are automatically converted into unified error responses
3. **Custom responses**: you can customize the response using the `ApiResponse` class
4. **Disabling wrapping**: use the `[DisableResponseWrapper]` attribute to disable wrapping
5. **HTTP status codes**: MiCake automatically sets the correct HTTP status code based on the exception type
