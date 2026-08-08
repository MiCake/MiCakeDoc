---
title: 统一返回格式
description: 了解 MiCake 的统一 API 响应格式包装功能，实现规范一致的 API 响应
slug: 10.0.0/unified-response/overview
---

MiCake 提供了统一的 API 响应格式包装功能，自动将控制器的返回值包装为标准格式，使 API 响应更加规范和一致。

## 标准响应格式

MiCake 的标准响应格式包含三个字段：

```json
{
  "code": "200",
  "message": "Success",
  "data": {
    // 实际的返回数据
  }
}
```

**字段说明：**

* `code`: 业务状态码（字符串类型）
* `message`: 响应消息
* `data`: 实际的业务数据

## 基本使用

### 默认启用

MiCake 默认启用响应包装，无需额外配置：

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

// 实际返回：
// {
//   "code": "200",
//   "message": "Success",
//   "data": {
//     "id": 1,
//     "customerName": "张三",
//     "totalAmount": 999.00
//   }
// }
```

### 集合数据

```csharp
[HttpGet]
public async Task<List<OrderDto>> GetOrders()
{
    return await _orderService.GetAllOrders();
}

// 返回：
// {
//   "code": "200",
//   "message": "Success",
//   "data": [
//     { "id": 1, "customerName": "张三" },
//     { "id": 2, "customerName": "李四" }
//   ]
// }
```

### 简单类型

```csharp
[HttpPost]
public async Task<int> CreateOrder([FromBody] CreateOrderDto dto)
{
    return await _orderService.CreateOrder(dto);
}

// 返回：
// {
//   "code": "200",
//   "message": "Success",
//   "data": 123
// }
```

## 错误响应

异常会自动转换为错误响应格式：

```csharp
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    var order = await _orderRepository.FindAsync(id);
    if (order == null)
        throw new NotFoundException("Order", id);
    
    return order;
}

// 当订单不存在时返回：
// {
//   "code": "NOT_FOUND",
//   "message": "Order with id 123 was not found",
//   "errors": null
// }
```

### 验证错误

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
        
        throw new ValidationException("验证失败", errors);
    }

    return await _orderService.CreateOrder(dto);
}

// 验证失败时返回：
// {
//   "code": "VALIDATION_ERROR",
//   "message": "验证失败",
//   "errors": [
//     { "field": "CustomerName", "message": "客户姓名不能为空" },
//     { "field": "TotalAmount", "message": "金额必须大于零" }
//   ]
// }
```

## 自定义响应

### 使用 ApiResponse

如果需要自定义响应，可以使用 `ApiResponse` 类：

```csharp
using MiCake.AspNetCore.Responses;

[HttpPost]
public async Task<ApiResponse<int>> CreateOrder([FromBody] CreateOrderDto dto)
{
    var orderId = await _orderService.CreateOrder(dto);
    
    return new ApiResponse<int>
    {
        Code = "ORDER_CREATED",
        Message = "订单创建成功",
        Data = orderId
    };
}

// 返回：
// {
//   "code": "ORDER_CREATED",
//   "message": "订单创建成功",
//   "data": 123
// }
```

### 自定义错误响应

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
            Message = "订单处理成功",
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

## 禁用响应包装

### 方法级别禁用

对于某些特殊接口，您可能不希望进行响应包装：

```csharp
using MiCake.AspNetCore.Responses;

[HttpGet("raw")]
[DisableResponseWrapper] // 禁用响应包装
public async Task<Order> GetRawOrder(int id)
{
    return await _orderRepository.FindAsync(id);
}

// 直接返回订单对象，不包装：
// {
//   "id": 1,
//   "customerName": "张三",
//   "totalAmount": 999.00
// }
```

### 控制器级别禁用

```csharp
[ApiController]
[Route("api/[controller]")]
[DisableResponseWrapper] // 整个控制器禁用响应包装
public class RawDataController : ControllerBase
{
    // 所有方法都不会进行响应包装
}
```

## 配置响应包装

### 全局配置

在 `Startup.cs` 中配置响应包装选项：

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
    {
        options.AspNetConfig = asp =>
        {
            // 配置数据包装器
            asp.DataWrapperOptions = wrapperOptions =>
            {
                // 设置默认成功代码
                wrapperOptions.DefaultSuccessCode = "0";
                
                // 设置默认成功消息
                wrapperOptions.DefaultSuccessMessage = "操作成功";
                
                // 设置默认错误消息
                wrapperOptions.DefaultErrorMessage = "操作失败";
            };
        };
    }).Build();
}
```

### 自定义包装器

如果需要完全自定义响应格式，可以实现 `IResponseWrapper` 接口：

```csharp
public class CustomResponseWrapper : IResponseWrapper
{
    public string? Code { get; set; }
    public string? Message { get; set; }
    public object? Data { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string? TraceId { get; set; }
}

// 注册自定义包装器
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        context.Services.AddSingleton<IResponseWrapper, CustomResponseWrapper>();
        base.ConfigureServices(context);
    }
}
```

## 响应包装最佳实践

### 1. 保持一致性

在整个应用中使用统一的响应格式：

```csharp
// ✅ 正确：让 MiCake 自动包装
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    return await _orderRepository.FindAsync(id);
}

// ❌ 不推荐：手动构建响应对象
[HttpGet("{id}")]
public async Task<IActionResult> GetOrder(int id)
{
    var order = await _orderRepository.FindAsync(id);
    return Ok(new { code = "200", data = order });
}
```

### 2. 使用合适的 HTTP 状态码

MiCake 会自动设置正确的 HTTP 状态码：

```csharp
// 成功：200 OK
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    return await _orderRepository.FindAsync(id);
}

// 未找到：404 Not Found
[HttpGet("{id}")]
public async Task<Order> GetOrder(int id)
{
    var order = await _orderRepository.FindAsync(id);
    if (order == null)
        throw new NotFoundException("Order", id);
    return order;
}

// 验证错误：400 Bad Request
[HttpPost]
public async Task<int> CreateOrder([FromBody] CreateOrderDto dto)
{
    if (!ModelState.IsValid)
        throw new ValidationException("验证失败");
    return await _orderService.CreateOrder(dto);
}
```

### 3. 提供有意义的错误代码

```csharp
// ✅ 正确：使用有意义的错误代码
throw new BusinessException("库存不足", code: "INSUFFICIENT_STOCK");
throw new BusinessException("订单已取消", code: "ORDER_CANCELLED");

// ❌ 错误：使用通用错误代码
throw new Exception("Error");
```

### 4. 返回类型一致

```csharp
// ✅ 正确：返回类型一致
[HttpGet]
public async Task<List<OrderDto>> GetOrders()
{
    return await _orderService.GetAllOrders();
}

// ❌ 不推荐：返回类型不一致
[HttpGet]
public async Task<IActionResult> GetOrders()
{
    var orders = await _orderService.GetAllOrders();
    if (!orders.Any())
        return NotFound();
    return Ok(orders);
}
```

## 注意事项

1. **默认启用**：MiCake 默认启用响应包装
2. **异常自动处理**：异常会自动转换为统一的错误响应
3. **自定义响应**：可以通过 `ApiResponse` 类自定义响应
4. **禁用包装**：使用 `[DisableResponseWrapper]` 特性禁用包装
5. **HTTP 状态码**：MiCake 会根据异常类型自动设置正确的 HTTP 状态码
