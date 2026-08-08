---
title: Dependency Injection
description: Learn about MiCake's dependency injection enhancements, including auto-registration, service marker interfaces, and lifecycle management
---

MiCake extends the .NET Core dependency injection system with more convenient service registration, including auto-registration, attribute marking, and more.

## Standard Dependency Injection

MiCake is fully compatible with .NET Core's standard dependency injection:

```csharp
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        var services = context.Services;

        // Transient - a new instance is created for every request
        services.AddTransient<ITransientService, TransientService>();

        // Scoped - the same instance within each request scope
        services.AddScoped<IScopedService, ScopedService>();

        // Singleton - the same instance for the entire application lifetime
        services.AddSingleton<ISingletonService, SingletonService>();

        base.ConfigureServices(context);
    }
}
```

## Auto-Registration

MiCake provides several ways to register services automatically.

### Method 1: Implement a Marker Interface

Services implementing the following interfaces are registered into the DI container automatically:

```csharp
using MiCake.Core.DependencyInjection;

// A transient service
public class EmailService : ITransientService
{
    public void SendEmail(string to, string subject, string body)
    {
        // Email sending logic
    }
}

// A scoped service
public class OrderService : IScopedService
{
    private readonly IRepository<Order, int> _orderRepository;

    public OrderService(IRepository<Order, int> orderRepository)
    {
        _orderRepository = orderRepository;
    }

    public async Task CreateOrder(CreateOrderDto dto)
    {
        // Order creation logic
    }
}

// A singleton service
public class CacheService : ISingletonService
{
    private readonly Dictionary<string, object> _cache = new();

    public void Set(string key, object value)
    {
        _cache[key] = value;
    }

    public T Get<T>(string key)
    {
        return _cache.TryGetValue(key, out var value) ? (T)value : default;
    }
}
```

**No manual registration is needed - MiCake scans and registers these services automatically.**

### Method 2: Use the InjectService Attribute

Use the `[InjectService]` attribute for finer control:

```csharp
using MiCake.Core.DependencyInjection;
using Microsoft.Extensions.DependencyInjection;

// Basic usage
[InjectService(ServiceLifetime.Scoped)]
public class ProductService : IProductService
{
    // ...
}

// Specify the exposed service types
[InjectService(ServiceLifetime.Scoped, ExposeServices = new[] { typeof(IProductService), typeof(IService) })]
public class ProductService : IProductService, IService
{
    // Registered as IProductService and IService
}

// Try to register (skip if it already exists)
[InjectService(ServiceLifetime.Scoped, TryRegister = true)]
public class ProductService : IProductService
{
    // Skipped if IProductService is already registered
}

// Replace an existing registration
[InjectService(ServiceLifetime.Scoped, ReplaceServices = true)]
public class NewProductService : IProductService
{
    // Replaces the registered IProductService
}
```

### Auto-Registered Service Types

MiCake automatically registers services as the following types:

```csharp
public class OrderService : IOrderService, IScopedService
{
    // Automatically registered as:
    // - OrderService (the implementation class)
    // - IOrderService (the interface)
}

// Usage
public class OrderController
{
    private readonly IOrderService _orderService;         // ✅ Can inject the interface
    private readonly OrderService _concreteService;       // ✅ Can also inject the implementation class

    public OrderController(IOrderService orderService)
    {
        _orderService = orderService;
    }
}
```

## Lifecycles

### Transient

A new instance is created for every request:

```csharp
public class GuidService : ITransientService
{
    public Guid Id { get; } = Guid.NewGuid();
}

// A different instance for every injection
public class MyController
{
    public MyController(GuidService service1, GuidService service2)
    {
        Console.WriteLine(service1.Id); // e.g. 123e4567-e89b-12d3-a456-426614174000
        Console.WriteLine(service2.Id); // e.g. 9876-5432-10dc-ba98-765432109876 (different)
    }
}
```

**Suitable for:**
- Lightweight, stateless services
- Services that do not need shared state

### Scoped

The same instance within a request scope:

```csharp
public class RequestContextService : IScopedService
{
    public Guid RequestId { get; } = Guid.NewGuid();
}

// All injections within the same request are the same instance
public class MyController
{
    public MyController(RequestContextService service1, RequestContextService service2)
    {
        Console.WriteLine(service1.RequestId); // e.g. 123e4567-e89b-12d3-a456-426614174000
        Console.WriteLine(service2.RequestId); // 123e4567-e89b-12d3-a456-426614174000 (same)
    }
}
```

**Suitable for:**
- Services that need to share state during a request
- Database contexts (DbContext)
- Units of work

### Singleton

The same instance for the entire application lifetime:

```csharp
public class ConfigurationService : ISingletonService
{
    public string AppVersion { get; } = "1.0.0";
    public DateTime StartTime { get; } = DateTime.UtcNow;
}

// All injections are the same instance
// service1.StartTime == service2.StartTime == service3.StartTime
```

**Suitable for:**
- Configuration services
- Cache services
- Logging services
- Stateless utility classes

## Service Exposure

### Default Exposure Rules

MiCake automatically exposes the following types:

```csharp
public class OrderService : IOrderService, IService, IScopedService
{
    // Automatically exposed:
    // 1. The implementation class itself: OrderService
    // 2. All public interfaces (except marker interfaces): IOrderService, IService
    // Not exposed: IScopedService (it is a marker interface)
}
```

### Custom Exposure

Use the `[InjectService]` attribute to customize the exposed service types:

```csharp
// Expose only the interface
[InjectService(ServiceLifetime.Scoped, ExposeServices = new[] { typeof(IOrderService) })]
public class OrderService : IOrderService, IService
{
    // Registered only as IOrderService
}

// Expose only the implementation class
[InjectService(ServiceLifetime.Scoped, ExposeServices = new[] { typeof(OrderService) })]
public class OrderService : IOrderService
{
    // Registered only as OrderService
}

// Expose multiple types
[InjectService(ServiceLifetime.Scoped, ExposeServices = new[] { 
    typeof(IOrderService), 
    typeof(IService),
    typeof(OrderService) 
})]
public class OrderService : IOrderService, IService
{
    // Registered as IOrderService, IService and OrderService
}
```

## Dependency Injection Best Practices

### 1. Prefer Interfaces Over Implementations

Prefer injecting interfaces over implementation classes:

```csharp
// ✅ Correct: inject the interface
public class OrderController
{
    private readonly IOrderService _orderService;

    public OrderController(IOrderService orderService)
    {
        _orderService = orderService;
    }
}

// ❌ Not recommended: inject the implementation class
public class OrderController
{
    private readonly OrderService _orderService;

    public OrderController(OrderService orderService)
    {
        _orderService = orderService;
    }
}
```

### 2. Avoid the Service Locator Pattern

Do not inject `IServiceProvider` to resolve services:

```csharp
// ❌ Wrong: service locator pattern
public class OrderService
{
    private readonly IServiceProvider _serviceProvider;

    public OrderService(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public void ProcessOrder()
    {
        var productService = _serviceProvider.GetService<IProductService>();
        // ...
    }
}

// ✅ Correct: constructor injection
public class OrderService
{
    private readonly IProductService _productService;

    public OrderService(IProductService productService)
    {
        _productService = productService;
    }

    public void ProcessOrder()
    {
        // Use the injected service directly
    }
}
```

### 3. Choose the Right Lifecycle

```csharp
// ✅ Correct: DbContext uses Scoped
public class MyDbContext : DbContext, IScopedService
{
    // One instance per request
}

// ✅ Correct: a cache service uses Singleton
public class MemoryCacheService : ISingletonService
{
    // A single global instance
}

// ❌ Wrong: DbContext uses Singleton
public class MyDbContext : DbContext, ISingletonService
{
    // This causes thread-safety issues
}
```

### 4. Avoid Circular Dependencies

```csharp
// ❌ Wrong: circular dependency
public class ServiceA : IScopedService
{
    public ServiceA(ServiceB serviceB) { }
}

public class ServiceB : IScopedService
{
    public ServiceB(ServiceA serviceA) { } // Circular dependency!
}

// ✅ Correct: extract an interface or use a mediator
public interface IServiceAProvider
{
    void DoSomething();
}

public class ServiceA : IServiceAProvider, IScopedService
{
    public void DoSomething() { }
}

public class ServiceB : IScopedService
{
    public ServiceB(IServiceAProvider serviceAProvider) { }
}
```

### 5. Thread Safety of Singleton Services

```csharp
// ❌ Wrong: a singleton service that is not thread-safe
public class CacheService : ISingletonService
{
    private Dictionary<string, object> _cache = new();

    public void Set(string key, object value)
    {
        _cache[key] = value; // Not thread-safe
    }
}

// ✅ Correct: use a thread-safe collection
public class CacheService : ISingletonService
{
    private ConcurrentDictionary<string, object> _cache = new();

    public void Set(string key, object value)
    {
        _cache[key] = value; // Thread-safe
    }
}
```

## Registering Services Manually

In some cases, you may need to register services manually:

```csharp
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        var services = context.Services;

        // Register an implementation
        services.AddScoped<IOrderService, OrderService>();

        // Register a factory method
        services.AddScoped<IEmailService>(sp =>
        {
            var config = sp.GetRequiredService<IConfiguration>();
            var smtpServer = config["Email:SmtpServer"];
            return new EmailService(smtpServer);
        });

        // Register an existing instance
        var cacheService = new CacheService();
        services.AddSingleton<ICacheService>(cacheService);

        // Try to register (skip if it already exists)
        services.TryAddScoped<IProductService, ProductService>();

        // Replace an existing registration
        services.Replace(ServiceDescriptor.Scoped<IOrderService, NewOrderService>());

        base.ConfigureServices(context);
    }
}
```

## Resolving Services

### In a Controller

Inject through the constructor:

```csharp
[ApiController]
[Route("api/[controller]")]
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogger<OrderController> _logger;

    public OrderController(
        IOrderService orderService,
        ILogger<OrderController> logger)
    {
        _orderService = orderService;
        _logger = logger;
    }
}
```

### In Module Initialization

Resolve from the `ServiceProvider`:

```csharp
public class MyModule : MiCakeModule
{
    public override void Initialization(ModuleInitializationContext context)
    {
        var serviceProvider = context.ServiceProvider;

        // Get a required service (throws an exception if it does not exist)
        var dbContext = serviceProvider.GetRequiredService<MyDbContext>();

        // Get an optional service (returns null if it does not exist)
        var cacheService = serviceProvider.GetService<ICacheService>();

        base.Initialization(context);
    }
}
```

### In Classes Not Managed by DI

When you need to resolve services in classes not managed by DI:

```csharp
public class MyHelper
{
    public static void DoSomething(IServiceProvider serviceProvider)
    {
        var orderService = serviceProvider.GetRequiredService<IOrderService>();
        // Use the service
    }
}
```

## Conditional Registration

### TryAdd - Register Only If Not Already Registered

```csharp
services.TryAddScoped<IOrderService, OrderService>();
services.TryAddScoped<IOrderService, NewOrderService>(); // Has no effect, since it is already registered
```

### Using Attributes

```csharp
[InjectService(ServiceLifetime.Scoped, TryRegister = true)]
public class OrderService : IOrderService
{
    // Registered only if IOrderService is not already registered
}
```

## Notes

1. **Lifecycle selection**: choose the appropriate lifecycle based on the service's characteristics
2. **Avoid memory leaks**: do not hold references to short-lived services in long-lived services
3. **Thread safety**: singleton services must be thread-safe
4. **Avoid circular dependencies**: pay attention to dependency relationships between services when designing
5. **Interfaces first**: prefer injecting services through interfaces
