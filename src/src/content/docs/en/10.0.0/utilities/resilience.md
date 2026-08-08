---
title: CircuitBreaker
description: A circuit breaker pattern implementation that protects the system
  from external service failures and supports automatic failover
slug: en/10.0.0/utilities/resilience
---

`GenericCircuitBreaker<TRequest, TResponse>` is a generic circuit breaker implementation used to protect the system from external service failures. It supports automatic failover and multiple provider selection strategies.

## Namespace

```csharp
using MiCake.Util.Resilience;
```

## Circuit Breaker States

The circuit breaker uses an independent state object per provider to track health:

```
Closed（Closed）→ Open（Open）→ HalfOpen（HalfOpen）→ Closed
        ↑              ↓               ↓
    Normal operation   Failure threshold   Attempt recovery
```

### State Description

* **Closed**: normal state, requests pass through normally
* **Open**: circuit-open state, requests are rejected directly or switched to a backup provider
* **HalfOpen**: attempts recovery, allows a portion of requests through to test whether the service has recovered

### State Fields

Each provider's `CircuitBreakerState` contains:

* `State` - the current state
* `FailureCount` - the cumulative failure count
* `SuccessiveSuccesses` - the number of consecutive successes
* `LastFailureTime` - the most recent failure time
* `ConcurrentOperations` - the current number of concurrent requests

## Configuration Options

```csharp
var config = new CircuitBreakerConfig
{
    FailureThreshold = 3,           // Failure threshold (default: 3)
    SuccessThreshold = 2,           // Recovery success threshold (default: 2)
    OpenStateTimeout = TimeSpan.FromMinutes(5),  // Circuit-open timeout
    MaxConcurrentOperations = 100,   // Maximum concurrency
    SelectionStrategy = ProviderSelectionStrategy.PriorityOrder  // Selection strategy
};
```

### Configuration Parameter Description

| Parameter | Description | Default |
|-----------|-------------|---------|
| `FailureThreshold` | The number of consecutive failures that triggers the circuit to open | 3 |
| `SuccessThreshold` | The number of consecutive successes needed to recover from HalfOpen | 2 |
| `OpenStateTimeout` | The duration of the circuit-open state | 5 minutes |
| `MaxConcurrentOperations` | The maximum number of concurrent requests for a single provider | 100 |
| `SelectionStrategy` | The provider selection strategy | PriorityOrder |

## Provider Selection Strategies

| Strategy | Description | Use case |
|----------|-------------|----------|
| `PriorityOrder` | Selects in priority order | Primary/backup architecture |
| `RoundRobin` | Round-robin selection | Load balancing |
| `LeastLoad` | Selects the provider with the lowest load | Dynamic load balancing |
| `ParallelRace` | Executes in parallel and returns the fastest result | Low-latency first |

### Selection Strategy Details

**PriorityOrder (default)**

```csharp
// Tries in priority order and returns on the first success
// Priority: Primary(0) → Backup1(1) → Backup2(2)
```

**RoundRobin**

```csharp
// Assigns requests in round-robin order
// Request 1 → Provider1, Request 2 → Provider2, Request 3 → Provider1...
```

**LeastLoad**

```csharp
// Prefers the provider with the smallest current concurrency
// Sorted by the ConcurrentOperations field
```

**ParallelRace**

```csharp
// Sends requests to multiple providers concurrently, returning the first successful response
// Suitable for multi-replica "race" scenarios
```

## The Provider Interface

Implement the `ICircuitBreakerProvider<TRequest, TResponse>` interface:

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
        // Execute the actual request
        var response = await _httpClient.PostAsJsonAsync("/api/endpoint", request, cancellationToken);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<MyResponse>(cancellationToken: cancellationToken);
    }

    public async Task<bool> IsAvailableAsync(CancellationToken cancellationToken = default)
    {
        // Check service availability
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

## Usage Examples

### Basic Usage

```csharp
// Create providers
var providers = new[]
{
    new PrimaryServiceProvider(_primaryHttpClient),
    new BackupServiceProvider(_backupHttpClient)
};

// Create the configuration
var config = new CircuitBreakerConfig
{
    FailureThreshold = 3,
    SuccessThreshold = 2,
    OpenStateTimeout = TimeSpan.FromMinutes(5)
};

// Create the circuit breaker
var logger = _loggerFactory.CreateLogger<GenericCircuitBreaker<MyRequest, MyResponse>>();
var circuitBreaker = new GenericCircuitBreaker<MyRequest, MyResponse>(
    providers, 
    logger, 
    config
);

// Execute the request
var request = new MyRequest { /* ... */ };
var response = await circuitBreaker.ExecuteAsync(request);
```

### Setting Provider Priorities

```csharp
// Set priorities (the smaller the number, the higher the priority)
circuitBreaker.SetProviderPriority("PrimaryService", 0);   // Highest priority
circuitBreaker.SetProviderPriority("BackupService", 1);    // Second priority
circuitBreaker.SetProviderPriority("FallbackService", 2);  // Lowest priority
```

### Getting Provider Status

```csharp
var status = circuitBreaker.GetProvidersStatus();
foreach (var (name, info) in status)
{
    Console.WriteLine($"Provider: {name}");
    Console.WriteLine($"  State: {info.State}");
    Console.WriteLine($"  Failures: {info.Failures}");
    Console.WriteLine($"  Concurrent requests: {info.ConcurrentRequests}");
}
```

### Refreshing Provider Status

```csharp
// Manually check the availability of all providers
await circuitBreaker.RefreshProviderStatusAsync();
```

### Using in a Service

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

        // Set priorities
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
            _logger.LogError(ex, "All payment providers failed");
            
            // Return degraded data
            return new PaymentResponse
            {
                Success = false,
                Message = "The payment service is temporarily unavailable, please try again later"
            };
        }
    }
}
```

### Using Different Selection Strategies

```csharp
// PriorityOrder - primary/backup mode
var primaryBackup = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.PriorityOrder 
    }
);

// RoundRobin - load balancing
var loadBalanced = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.RoundRobin 
    }
);

// LeastLoad - dynamic load balancing
var dynamicLoadBalanced = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.LeastLoad 
    }
);

// ParallelRace - race mode
var raceMode = new GenericCircuitBreaker<Request, Response>(
    providers,
    logger,
    new CircuitBreakerConfig 
    { 
        SelectionStrategy = ProviderSelectionStrategy.ParallelRace 
    }
);
```

## Best Practices

### 1. Provide a Fallback Strategy

```csharp
// ✅ Correct: provide a fallback strategy
try
{
    return await circuitBreaker.ExecuteAsync(request);
}
catch
{
    // Return cached data or a default value
    return GetCachedData();
}

// ❌ Wrong: don't handle failures
var response = await circuitBreaker.ExecuteAsync(request); // may throw an exception
```

### 2. Set Thresholds Reasonably

```csharp
// ✅ Correct: adjust thresholds based on service characteristics
var config = new CircuitBreakerConfig
{
    FailureThreshold = 5,  // allow 5 failures
    SuccessThreshold = 3,  // need 3 successes to recover
    OpenStateTimeout = TimeSpan.FromMinutes(10)  // attempt recovery after 10 minutes
};

// ❌ Wrong: thresholds too small cause frequent tripping
var config = new CircuitBreakerConfig
{
    FailureThreshold = 1,  // trips after one failure
    OpenStateTimeout = TimeSpan.FromSeconds(5)  // attempts recovery after 5 seconds
};
```

### 3. Monitor Status

```csharp
// ✅ Correct: check the status periodically
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
                    // Send an alert
                }
            }
            
            await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        }
    }
}
```

### 4. Use Logging

```csharp
// The circuit breaker automatically logs state changes
// Make sure the log level is configured

{
  "Logging": {
    "LogLevel": {
      "MiCake.Util.Resilience": "Information"
    }
  }
}
```

### 5. Provide Health Checks

```csharp
public class MyServiceProvider : ICircuitBreakerProvider<Request, Response>
{
    public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
    {
        try
        {
            // ✅ Correct: implement a real health check
            var response = await _httpClient.GetAsync("/health", ct);
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}

// ❌ Wrong: always returns true
public async Task<bool> IsAvailableAsync(CancellationToken ct = default)
{
    return true;  // no actual check
}
```

## State Transition Example

```
Initial state: Closed
1. Request fails × 3 times → state changes to Open
2. Wait for 5 minutes (OpenStateTimeout)
3. State automatically changes to HalfOpen
4. Requests succeed × 2 times → state changes to Closed
5. If the attempt fails → state returns to Open
```

## Concurrency Control

```csharp
var config = new CircuitBreakerConfig
{
    MaxConcurrentOperations = 100  // limits a single provider to 100 concurrent requests at most
};

// Requests exceeding the limit are rejected or routed to another provider
```

## Important Notes

1. **Independent states**: each provider has an independent state
2. **Thread safety**: all operations are thread-safe
3. **Timeout setting**: set OpenStateTimeout reasonably
4. **Fallback strategy**: always provide a fallback strategy
5. **Monitoring and alerts**: check the status and alert periodically
6. **Health checks**: implement real health check logic
