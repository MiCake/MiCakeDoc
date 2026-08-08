---
title: CircuitBreaker 熔断器
description: 熔断器模式实现，保护系统免受外部服务故障影响，支持自动故障转移
slug: 10.0.0/utilities/resilience
---

`GenericCircuitBreaker<TRequest, TResponse>` 是通用熔断器实现，用于保护系统免受外部服务故障影响，支持自动故障转移和多种提供者选择策略。

## 命名空间

```csharp
using MiCake.Util.Resilience;
```

## 熔断器状态

熔断器使用每个 provider 的独立状态对象来跟踪运行状况：

```
Closed（关闭）→ Open（打开）→ HalfOpen（半开）→ Closed
        ↑              ↓               ↓
    正常运行       失败次数超限       尝试恢复
```

### 状态说明

* **Closed（关闭）**: 正常状态，请求正常通过
* **Open（打开）**: 熔断状态，直接拒绝请求或切换到备用提供者
* **HalfOpen（半开）**: 尝试恢复，允许部分请求通过以测试服务是否恢复

### 状态字段

每个 provider 的 `CircuitBreakerState` 包含：

* `State` - 当前状态
* `FailureCount` - 累计失败次数
* `SuccessiveSuccesses` - 连续成功次数
* `LastFailureTime` - 最近失败时间
* `ConcurrentOperations` - 当前并发请求数

## 配置选项

```csharp
var config = new CircuitBreakerConfig
{
    FailureThreshold = 3,           // 失败阈值（默认：3）
    SuccessThreshold = 2,           // 恢复成功阈值（默认：2）
    OpenStateTimeout = TimeSpan.FromMinutes(5),  // 熔断超时时间
    MaxConcurrentOperations = 100,   // 最大并发数
    SelectionStrategy = ProviderSelectionStrategy.PriorityOrder  // 选择策略
};
```

### 配置参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `FailureThreshold` | 触发熔断的连续失败次数 | 3 |
| `SuccessThreshold` | 从半开状态恢复需要的连续成功次数 | 2 |
| `OpenStateTimeout` | 熔断状态持续时间 | 5 分钟 |
| `MaxConcurrentOperations` | 单个提供者的最大并发请求数 | 100 |
| `SelectionStrategy` | 提供者选择策略 | PriorityOrder |

## 提供者选择策略

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `PriorityOrder` | 按优先级顺序选择 | 主备架构 |
| `RoundRobin` | 轮询选择 | 负载均衡 |
| `LeastLoad` | 选择负载最低的提供者 | 动态负载均衡 |
| `ParallelRace` | 并行执行，返回最快的结果 | 低延迟优先 |

### 选择策略详解

**PriorityOrder（默认）**

```csharp
// 按优先级顺序尝试，遇到第一个成功就返回
// 优先级: Primary(0) → Backup1(1) → Backup2(2)
```

**RoundRobin**

```csharp
// 每次请求使用轮询顺序分配
// 请求1 → Provider1, 请求2 → Provider2, 请求3 → Provider1...
```

**LeastLoad**

```csharp
// 优先使用当前并发最小的 provider
// 根据 ConcurrentOperations 字段排序
```

**ParallelRace**

```csharp
// 并发发起到多个 provider，返回最先成功的响应
// 适合多副本的"竞速"场景
```

## Provider 接口

实现 `ICircuitBreakerProvider<TRequest, TResponse>` 接口：

```csharp
public class MyServiceProvider : ICircuitBreakerProvider<MyRequest, MyResponse>
{
    private readonly HttpClient _httpClient;

    public MyServiceProvider(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public string ProviderName => "MyService";

    public async Task<MyResponse?> ExecuteAsync(
        MyRequest request, 
        CancellationToken cancellationToken = default)
    {
        // 执行实际请求
        var response = await _httpClient.PostAsJsonAsync("/api/endpoint", request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<MyResponse>(cancellationToken: cancellationToken);
    }

    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        // 检查服务可用性
        try
        {
            var response = await _httpClient.GetAsync("/health", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
```

## 使用示例

### 基本用法

```csharp
// 创建提供者
var providers = new[]
{
    new PrimaryServiceProvider(_primaryHttpClient),
    new BackupServiceProvider(_backupHttpClient)
};

// 创建配置
var config = new CircuitBreakerConfig
{
    FailureThreshold = 3,
    SuccessThreshold = 2,
    OpenStateTimeout = TimeSpan.FromMinutes(5)
};

// 创建熔断器
var logger = _loggerFactory.CreateLogger<GenericCircuitBreaker<MyRequest, MyResponse>>();
var circuitBreaker = new GenericCircuitBreaker<MyRequest, MyResponse>(
    providers, 
    logger, 
    config
);

// 执行请求
var request = new MyRequest { /* ... */ };
var response = await circuitBreaker.ExecuteAsync(request);
```

### 设置提供者优先级

```csharp
// 设置优先级（数字越小优先级越高）
circuitBreaker.SetProviderPriority("PrimaryService", 0);   // 最高优先级
circuitBreaker.SetProviderPriority("BackupService", 1);    // 次优先级
circuitBreaker.SetProviderPriority("FallbackService", 2);  // 最低优先级
```

### 获取提供者状态

```csharp
var status = circuitBreaker.GetProvidersStatus();
foreach (var (name, info) in status)
{
    Console.WriteLine($"提供者: {name}");
    Console.WriteLine($"  状态: {info.State}");
    Console.WriteLine($"  失败次数: {info.Failures}");
    Console.WriteLine($"  并发请求: {info.ConcurrentRequests}");
}
```

### 刷新提供者状态

```csharp
// 手动检查所有提供者的可用性
await circuitBreaker.RefreshProviderStatusAsync();
```

### 在服务中使用

```csharp
public class PaymentService : IScopedService
{
    private readonly GenericCircuitBreaker<PaymentRequest, PaymentResponse> _circuitBreaker;

    public PaymentService(
        IEnumerable<ICircuitBreakerProvider<PaymentRequest, PaymentResponse>> providers,
        ILogger<PaymentService> logger)
    {
        var config = new CircuitBreakerConfig
        {
            FailureThreshold = 5,
            SuccessThreshold = 3,
            OpenStateTimeout = TimeSpan.FromMinutes(10),
            SelectionStrategy = ProviderSelectionStrategy.LeastLoad
        };

        _circuitBreaker = new GenericCircuitBreaker<PaymentRequest, PaymentResponse>(
            providers.ToArray(),
            logger,
            config
        );

        // 设置优先级
        _circuitBreaker.SetProviderPriority("AlipayProvider", 0);
        _circuitBreaker.SetProviderPriority("WeChatPayProvider", 1);
    }

    public async Task<PaymentResponse> ProcessPayment(PaymentRequest request)
    {
        try
        {
            return await _circuitBreaker.ExecuteAsync(request);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "所有支付提供者都失败");
            
            // 返回降级数据
            return new PaymentResponse
            {
                Success = false,
                Message = "支付服务暂时不可用，请稍后重试"
            };
        }
    }
}
```

### 使用不同选择策略

```csharp
// PriorityOrder - 主备模式
var primaryBackup = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.PriorityOrder 
    }
);

// RoundRobin - 负载均衡
var loadBalanced = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.RoundRobin 
    }
);

// LeastLoad - 动态负载均衡
var dynamicLoadBalanced = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.LeastLoad 
    }
);

// ParallelRace - 竞速模式
var raceMode = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.ParallelRace 
    }
);
```

## 最佳实践

### 1. 提供降级方案

```csharp
// ✅ 正确：提供降级方案
try
{
    return await circuitBreaker.ExecuteAsync(request);
}
catch
{
    // 返回缓存数据或默认值
    return GetCachedData();
}

// ❌ 错误：不处理失败
var response = await circuitBreaker.ExecuteAsync(request); // 可能抛出异常
```

### 2. 合理设置阈值

```csharp
// ✅ 正确：根据服务特性调整阈值
var config = new CircuitBreakerConfig
{
    FailureThreshold = 5,  // 允许 5 次失败
    SuccessThreshold = 3,  // 需要 3 次成功才恢复
    OpenStateTimeout = TimeSpan.FromMinutes(10)  // 10 分钟后尝试恢复
};

// ❌ 错误：阈值过小导致频繁熔断
var config = new CircuitBreakerConfig
{
    FailureThreshold = 1,  // 一次失败就熔断
    OpenStateTimeout = TimeSpan.FromSeconds(5)  // 5 秒后就尝试恢复
};
```

### 3. 监控状态

```csharp
// ✅ 正确：定期检查状态
public class CircuitBreakerMonitor : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var status = _circuitBreaker.GetProvidersStatus();
            foreach (var (name, info) in status)
            {
                if (info.State == CircuitState.Open)
                {
                    _logger.LogWarning($"Provider {name} is in Open state!");
                    // 发送告警
                }
            }
            
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
```

### 4. 使用日志

```csharp
// 熔断器会自动记录状态变化
// 确保配置了日志级别

{
  "Logging": {
    "LogLevel": {
      "MiCake.Util.Resilience": "Information"
    }
  }
}
```

### 5. 提供健康检查

```csharp
public class MyServiceProvider : ICircuitBreakerProvider<Request, Response>
{
    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            // ✅ 正确：实现真实的健康检查
            var response = await _httpClient.GetAsync("/health", ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}

// ❌ 错误：总是返回 true
public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
{
    return true;  // 没有实际检查
}
```

## 状态转换示例

```
初始状态: Closed
1. 请求失败 × 3次 → 状态变为 Open
2. 等待 5 分钟（OpenStateTimeout）
3. 状态自动变为 HalfOpen
4. 尝试请求成功 × 2次 → 状态变为 Closed
5. 如果尝试失败 → 状态回到 Open
```

## 并发控制

```csharp
var config = new CircuitBreakerConfig
{
    MaxConcurrentOperations = 100  // 限制单个提供者最多 100 个并发请求
};

// 超过限制的请求会被拒绝或路由到其他提供者
```

## 注意事项

1. **状态独立**：每个提供者有独立的状态
2. **线程安全**：所有操作都是线程安全的
3. **超时设置**：合理设置 OpenStateTimeout
4. **降级方案**：始终提供降级方案
5. **监控告警**：定期检查状态并告警
6. **健康检查**：实现真实的健康检查逻辑
