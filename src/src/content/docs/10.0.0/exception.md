---
title: 异常处理
description: 了解 MiCake 的统一异常处理机制，包括领域异常、业务异常和全局异常处理
slug: 10.0.0/exception
---

MiCake 提供了统一的异常处理机制，包括领域异常、业务异常等，并能自动将异常转换为统一的 API 响应格式。

## MiCake 异常体系

### MiCakeException - 基础异常

所有 MiCake 异常的基类：

```csharp
using MiCake.Core;

public class MiCakeException : Exception
{
    // 异常代码
    public virtual string? Code { get; set; }
    
    // 异常详情
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

### DomainException - 领域异常

用于表示违反领域规则的异常：

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

## 使用异常

### 在聚合根中

```csharp
public class Order : AggregateRoot<int>
{
    public OrderStatus Status { get; private set; }
    public decimal TotalAmount { get; private set; }

    public void Confirm()
    {
        if (Status != OrderStatus.Draft)
            throw new DomainException("只能确认草稿状态的订单");

        if (TotalAmount <= 0)
            throw new DomainException("订单金额必须大于零");

        if (!Items.Any())
            throw new DomainException("订单至少需要一个商品项");

        Status = OrderStatus.Confirmed;
        RaiseDomainEvent(new OrderConfirmedEvent(Id));
    }

    public void Cancel(string reason)
    {
        if (Status == OrderStatus.Shipped || Status == OrderStatus.Completed)
            throw new DomainException(
                "已发货或已完成的订单不能取消",
                code: "ORDER_CANCEL_NOT_ALLOWED"
            );

        Status = OrderStatus.Cancelled;
        RaiseDomainEvent(new OrderCancelledEvent(Id, reason));
    }
}
```

### 自定义异常

```csharp
// 业务异常
public class BusinessException : MiCakeException
{
    public BusinessException(string message, string? code = null)
        : base(message, code: code ?? "BUSINESS_ERROR")
    {
    }
}
```

## 全局异常处理

MiCake 提供了全局异常处理机制，自动将异常转换为统一的 API 响应。

### 异常响应格式

当发生异常时，API 会返回以下格式：

```json
{
  "code": "DOMAIN_ERROR",
  "message": "只能确认草稿状态的订单",
  "errors": null
}
```

## 异常最佳实践

### 1. 使用特定的异常类型

```csharp
// ✅ 正确：使用特定的异常类型
public async Task<Order> GetOrder(int orderId)
{
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new NotFoundException("Order", orderId);
    
    return order;
}

// ❌ 错误：使用通用异常
public async Task<Order> GetOrder(int orderId)
{
    var order = await _orderRepository.FindAsync(orderId);
    if (order == null)
        throw new Exception("Order not found");
    
    return order;
}
```

### 2. 提供清晰的错误消息

```csharp
// ✅ 正确：清晰的错误消息
throw new DomainException("只能确认草稿状态的订单");
throw new ValidationException("邮箱格式不正确");
throw new BusinessException("库存不足，无法完成订单");

// ❌ 错误：模糊的错误消息
throw new Exception("Error");
throw new Exception("Invalid");
throw new Exception("Failed");
```

### 3. 使用错误代码

```csharp
// ✅ 正确：使用错误代码
throw new DomainException("订单不能取消", code: "ORDER_CANCEL_NOT_ALLOWED");
throw new BusinessException("库存不足", code: "INSUFFICIENT_STOCK");

// 客户端可以根据错误代码进行国际化或特殊处理
```

### 4. 包含有用的上下文信息

```csharp
// ✅ 正确：包含上下文信息
throw new DomainException(
    $"产品 '{product.Name}' 的库存不足。当前库存：{product.Stock}，需求数量：{quantity}",
    code: "INSUFFICIENT_STOCK"
);

// ❌ 错误：缺少上下文
throw new DomainException("库存不足");
```

### 5. 不要吞噬异常

```csharp
// ❌ 错误：吞噬异常
try
{
    await ProcessOrder(order);
}
catch (Exception)
{
    // 什么都不做
}

// ✅ 正确：记录并重新抛出
try
{
    await ProcessOrder(order);
}
catch (Exception ex)
{
    _logger.LogError(ex, "处理订单失败: OrderId={OrderId}", order.Id);
    throw;
}

// ✅ 或者转换为更具体的异常
try
{
    await ProcessOrder(order);
}
catch (DbUpdateException ex)
{
    _logger.LogError(ex, "保存订单失败: OrderId={OrderId}", order.Id);
    throw new BusinessException("保存订单失败，请稍后重试");
}
```

## 在控制器中处理异常

虽然 MiCake 提供了全局异常处理，但您仍然可以在控制器中进行特定的异常处理：

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
            // 特殊处理验证异常
            return BadRequest(new
            {
                code = ex.Code,
                message = ex.Message,
                errors = ex.Errors
            });
        }
        catch (BusinessException ex)
        {
            // 记录业务异常
            _logger.LogWarning(ex, "创建订单业务异常");
            throw; // 重新抛出，由全局处理
        }
        // 其他异常由全局异常处理器处理
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
            return NotFound(new { message = $"订单 {id} 不存在" });
        }
    }
}
```

## 注意事项

1. **使用特定异常**：创建具体的异常类型而不是使用通用 `Exception`
2. **提供清晰消息**：异常消息应该清晰地说明问题
3. **使用错误代码**：便于客户端进行特殊处理和国际化
4. **不要过度捕获**：只捕获您能处理的异常
5. **记录异常**：在重新抛出前记录异常信息
