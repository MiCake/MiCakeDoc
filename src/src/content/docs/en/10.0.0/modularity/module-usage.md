---
title: Module Usage
description: Learn about MiCake's modular architecture and how to create,
  organize, and use modules to build applications
slug: en/10.0.0/modularity/module-usage
---

MiCake uses a modular architecture - all features are built around the module system. Modules are the basic building blocks of an application and provide a way to organize code and manage dependencies.

## What is a Module?

A module is a code unit with independent functionality that can:

* Configure its own services
* Declare dependencies on other modules
* Execute initialization logic at different stages of the application lifecycle
* Encapsulate specific business or technical functionality

**MiCake's core modules:**

* `MiCakeEssentialModule` - the core module
* `MiCakeAspNetCoreModule` - the ASP.NET Core integration module
* `MiCakeEntityFrameworkCoreModule` - the EF Core integration module

## Creating a Module

### A Basic Module

Inherit the `MiCakeModule` base class:

```csharp
using MiCake.Core.Modularity;
using Microsoft.Extensions.DependencyInjection;

public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // Configure services
        context.Services.AddScoped<IMyService, MyService>();
        
        base.ConfigureServices(context);
    }
}
```

### The Entry Module

An application needs an entry module, which usually depends on `MiCakeAspNetCoreModule`:

```csharp
using MiCake.AspNetCore.Modules;
using MiCake.Core.Modularity;

[RelyOn(typeof(MiCakeAspNetCoreModule))]
public class MyAppModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // Automatically register repositories
        context.AutoRegisterRepositories(typeof(MyAppModule).Assembly);
        
        // Configure options
        context.Services.Configure<MyOptions>(options =>
        {
            options.Setting1 = "Value1";
        });

        base.ConfigureServices(context);
    }

    public override void Initialization(ModuleInitializationContext context)
    {
        // Initialization logic
        var logger = context.ServiceProvider.GetService<ILogger<MyAppModule>>();
        logger?.LogInformation("MyAppModule initialized");
        
        base.Initialization(context);
    }
}
```

## Module Lifecycle

Modules have three main lifecycle hooks:

### 1. ConfigureServices - Configuring Services

Called at application startup to register services into the DI container:

```csharp
public override void ConfigureServices(ModuleConfigServiceContext context)
{
    var services = context.Services;
    var configuration = context.Configuration;

    // Register services
    services.AddScoped<IOrderService, OrderService>();
    services.AddSingleton<ICacheService, MemoryCacheService>();

    // Configure options
    services.Configure<OrderOptions>(configuration.GetSection("Order"));

    // Add an HTTP client
    services.AddHttpClient("ExternalApi", client =>
    {
        client.BaseAddress = new Uri("https://api.example.com");
    });

    base.ConfigureServices(context);
}
```

### 2. Initialization - Initializing

Called after application startup to execute initialization logic:

```csharp
public override void Initialization(ModuleInitializationContext context)
{
    var serviceProvider = context.ServiceProvider;
    
    // Get services and run initialization
    var dbContext = serviceProvider.GetRequiredService<MyDbContext>();
    
    // Ensure the database has been created
    dbContext.Database.EnsureCreated();
    
    // Initialize the cache
    var cacheService = serviceProvider.GetService<ICacheService>();
    cacheService?.Initialize();

    base.Initialization(context);
}
```

### 3. Shutdown - Shutting Down

Called when the application shuts down to clean up resources:

```csharp
public override void Shutdown()
{
    // Clean up resources
    _logger?.LogInformation("MyModule is shutting down");
    
    // Release resources
    _cache?.Dispose();

    base.Shutdown();
}
```

## Module Dependencies

### Declaring Dependencies

Use the `[RelyOn]` attribute to declare module dependencies:

```csharp
// Depend on a single module
[RelyOn(typeof(MiCakeAspNetCoreModule))]
public class MyModule : MiCakeModule
{
    // ...
}

// Depend on multiple modules
[RelyOn(typeof(MiCakeAspNetCoreModule))]
[RelyOn(typeof(MyOtherModule))]
public class MyModule : MiCakeModule
{
    // ...
}

// Or use an array
[RelyOn(typeof(MiCakeAspNetCoreModule), typeof(MyOtherModule))]
public class MyModule : MiCakeModule
{
    // ...
}
```

### Dependency Resolution

MiCake resolves module dependencies automatically, ensuring modules are initialized in the correct order:

```
MiCakeEssentialModule (the core module)
    ↓
MiCakeAspNetCoreModule (depends on the core module)
    ↓
MyAppModule (depends on the AspNetCore module)
```

Initialization order:

```
1. MiCakeEssentialModule.ConfigureServices
2. MiCakeAspNetCoreModule.ConfigureServices
3. MyAppModule.ConfigureServices
4. MiCakeEssentialModule.Initialization
5. MiCakeAspNetCoreModule.Initialization
6. MyAppModule.Initialization
```

## Module Configuration

### Accessing Configuration

Access the application configuration in a module:

```csharp
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        var configuration = context.Configuration;
        
        // Read configuration
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        var apiKey = configuration["ExternalApi:ApiKey"];

        // Configure services
        context.Services.AddDbContext<MyDbContext>(options =>
        {
            options.UseSqlServer(connectionString);
        });

        base.ConfigureServices(context);
    }
}
```

## Advanced Lifecycle Methods

For scenarios that need finer control, modules provide additional lifecycle methods:

### PreConfigServices - Before Configuring Services

```csharp
public override void PreConfigServices(ModuleConfigServiceContext context)
{
    // Executed before ConfigureServices
    // Used to configure services that must be registered first
    
    context.Services.AddSingleton<IEarlyService, EarlyService>();
    
    base.PreConfigServices(context);
}
```

### PostConfigServices - After Configuring Services

```csharp
public override void PostConfigServices(ModuleConfigServiceContext context)
{
    // Executed after ConfigureServices
    // Used to validate or adjust the registered services
    
    var services = context.Services;
    
    // Validate that required services are registered
    if (!services.Any(d => d.ServiceType == typeof(IRequiredService)))
    {
        throw new InvalidOperationException("IRequiredService is not registered");
    }

    base.PostConfigServices(context);
}
```

### PreInitialization - Before Initialization

```csharp
public override void PreInitialization(ModuleInitializationContext context)
{
    // Executed before Initialization
    // Used to prepare the resources needed for initialization
    
    base.PreInitialization(context);
}
```

### PostInitialization - After Initialization

```csharp
public override void PostInitialization(ModuleInitializationContext context)
{
    // Executed after Initialization
    // Used to validate the initialization result or run follow-up operations
    
    base.PostInitialization(context);
}
```

## Feature Module Example

### A Data Access Module

```csharp
using MiCake.Core.Modularity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

[RelyOn(typeof(MiCakeEssentialModule))]
public class DataAccessModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        var configuration = context.Configuration;
        
        // Configure the DbContext
        context.Services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlServer(
                configuration.GetConnectionString("DefaultConnection"),
                sqlOptions =>
                {
                    sqlOptions.EnableRetryOnFailure(5);
                    sqlOptions.CommandTimeout(30);
                });
        });

        // Automatically register repositories
        context.AutoRegisterRepositories(typeof(DataAccessModule).Assembly);

        base.ConfigureServices(context);
    }

    public override void Initialization(ModuleInitializationContext context)
    {
        // Initialize the database
        var dbContext = context.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Database.Migrate();

        base.Initialization(context);
    }
}
```

## Module Organization Suggestions

### Organize by Feature

```
MyApp.Core (the core module)
    - Domain/
    - Services/
    - CoreModule.cs

MyApp.DataAccess (the data access module)
    - DbContext/
    - Repositories/
    - DataAccessModule.cs

MyApp.Application (the application module)
    - UseCases/
    - Dtos/
    - ApplicationModule.cs

MyApp.Web (the web module)
    - Controllers/
    - WebModule.cs (the entry module)
```

### Organize by Layer

```
MyApp (the entry module)
    ↓
MyApp.Application (the application layer module)
    ↓
MyApp.Domain (the domain layer module)
    ↓
MyApp.Infrastructure (the infrastructure module)
```

## Registering a Module

Register the entry module in `Startup.cs`:

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllers();
    
    // Register MiCake and the entry module
    services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
    {
        options.AppConfig = app =>
        {
            // Application configuration
        };
    }).Build();
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseRouting();
    
    // Start MiCake
    app.StartMiCake();
    
    app.UseEndpoints(endpoints =>
    {
        endpoints.MapControllers();
    });
}
```

## Module Best Practices

### 1. Declare Dependencies Explicitly

Use `[RelyOn]` to declare dependencies explicitly:

```csharp
// ✅ Correct: explicit dependency
[RelyOn(typeof(DataAccessModule))]
public class ApplicationModule : MiCakeModule { }

// ❌ Wrong: implicit dependency
public class ApplicationModule : MiCakeModule 
{
    // Uses services from DataAccessModule, but does not declare the dependency
}
```

### 2. Avoid Circular Dependencies

```csharp
// ❌ Wrong: circular dependency
[RelyOn(typeof(ModuleB))]
public class ModuleA : MiCakeModule { }

[RelyOn(typeof(ModuleA))]
public class ModuleB : MiCakeModule { }

// ✅ Correct: extract the common dependency
public class CommonModule : MiCakeModule { }

[RelyOn(typeof(CommonModule))]
public class ModuleA : MiCakeModule { }

[RelyOn(typeof(CommonModule))]
public class ModuleB : MiCakeModule { }
```

## Notes

1. **The entry module must be specified**: specify it in `AddMiCakeWithDefault`
2. **Lifecycle method order**: understand the execution order of the lifecycle methods
3. **Dependency resolution**: MiCake resolves module dependencies automatically and initializes them in the correct order
4. **Avoid circular dependencies**: make sure there are no circular dependencies between modules
5. **Call the base method**: remember to call the `base` method when overriding lifecycle methods
