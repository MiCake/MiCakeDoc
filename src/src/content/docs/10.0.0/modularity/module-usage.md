---
title: 模块使用
description: 了解 MiCake 的模块化架构，学习如何创建、组织和使用模块来构建应用程序
slug: 10.0.0/modularity/module-usage
---

MiCake 采用模块化架构,所有功能都围绕模块系统构建。模块是应用程序的基本构建单元，提供了组织代码和管理依赖的方式。

## 什么是模块？

模块（Module）是具有独立功能的代码单元，它可以：

* 配置自己的服务
* 声明对其他模块的依赖
* 在应用生命周期的不同阶段执行初始化逻辑
* 封装特定的业务功能或技术功能

**MiCake 的核心模块：**

* `MiCakeEssentialModule` - 核心模块
* `MiCakeAspNetCoreModule` - ASP.NET Core 集成模块
* `MiCakeEntityFrameworkCoreModule` - EF Core 集成模块

## 创建模块

### 基本模块

继承 `MiCakeModule` 基类：

```csharp
using MiCake.Core.Modularity;
using Microsoft.Extensions.DependencyInjection;

public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // 配置服务
        context.Services.AddScoped<IMyService, MyService>();
        
        base.ConfigureServices(context);
    }
}
```

### 入口模块

应用程序需要一个入口模块，通常依赖 `MiCakeAspNetCoreModule`：

```csharp
using MiCake.AspNetCore.Modules;
using MiCake.Core.Modularity;

[RelyOn(typeof(MiCakeAspNetCoreModule))]
public class MyAppModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        // 自动注册仓储
        context.AutoRegisterRepositories(typeof(MyAppModule).Assembly);
        
        // 配置选项
        context.Services.Configure<MyOptions>(options =>
        {
            options.Setting1 = "Value1";
        });

        base.ConfigureServices(context);
    }

    public override void Initialization(ModuleInitializationContext context)
    {
        // 初始化逻辑
        var logger = context.ServiceProvider.GetService<ILogger<MyAppModule>>();
        logger?.LogInformation("MyAppModule initialized");
        
        base.Initialization(context);
    }
}
```

## 模块生命周期

模块具有三个主要的生命周期钩子：

### 1. ConfigureServices - 配置服务

在应用启动时调用，用于注册服务到 DI 容器：

```csharp
public override void ConfigureServices(ModuleConfigServiceContext context)
{
    var services = context.Services;
    var configuration = context.Configuration;

    // 注册服务
    services.AddScoped<IOrderService, OrderService>();
    services.AddSingleton<ICacheService, MemoryCacheService>();

    // 配置选项
    services.Configure<OrderOptions>(configuration.GetSection("Order"));

    // 添加 HTTP 客户端
    services.AddHttpClient("ExternalApi", client =>
    {
        client.BaseAddress = new Uri("https://api.example.com");
    });

    base.ConfigureServices(context);
}
```

### 2. Initialization - 初始化

在应用启动后调用，用于执行初始化逻辑：

```csharp
public override void Initialization(ModuleInitializationContext context)
{
    var serviceProvider = context.ServiceProvider;
    
    // 获取服务并执行初始化
    var dbContext = serviceProvider.GetRequiredService<MyDbContext>();
    
    // 确保数据库已创建
    dbContext.Database.EnsureCreated();
    
    // 初始化缓存
    var cacheService = serviceProvider.GetService<ICacheService>();
    cacheService?.Initialize();

    base.Initialization(context);
}
```

### 3. Shutdown - 关闭

在应用关闭时调用，用于清理资源：

```csharp
public override void Shutdown()
{
    // 清理资源
    _logger?.LogInformation("MyModule is shutting down");
    
    // 释放资源
    _cache?.Dispose();

    base.Shutdown();
}
```

## 模块依赖

### 声明依赖

使用 `[RelyOn]` 特性声明模块依赖：

```csharp
// 依赖单个模块
[RelyOn(typeof(MiCakeAspNetCoreModule))]
public class MyModule : MiCakeModule
{
    // ...
}

// 依赖多个模块
[RelyOn(typeof(MiCakeAspNetCoreModule))]
[RelyOn(typeof(MyOtherModule))]
public class MyModule : MiCakeModule
{
    // ...
}

// 或者使用数组
[RelyOn(typeof(MiCakeAspNetCoreModule), typeof(MyOtherModule))]
public class MyModule : MiCakeModule
{
    // ...
}
```

### 依赖解析

MiCake 会自动解析模块依赖关系，确保按正确的顺序初始化：

```
MiCakeEssentialModule (核心模块)
    ↓
MiCakeAspNetCoreModule (依赖核心模块)
    ↓
MyAppModule (依赖 AspNetCore 模块)
```

初始化顺序：

```
1. MiCakeEssentialModule.ConfigureServices
2. MiCakeAspNetCoreModule.ConfigureServices
3. MyAppModule.ConfigureServices
4. MiCakeEssentialModule.Initialization
5. MiCakeAspNetCoreModule.Initialization
6. MyAppModule.Initialization
```

## 模块配置

### 访问配置

在模块中访问应用配置：

```csharp
public class MyModule : MiCakeModule
{
    public override void ConfigureServices(ModuleConfigServiceContext context)
    {
        var configuration = context.Configuration;
        
        // 读取配置
        var connectionString = configuration.GetConnectionString("DefaultConnection");
        var apiKey = configuration["ExternalApi:ApiKey"];

        // 配置服务
        context.Services.AddDbContext<MyDbContext>(options =>
        {
            options.UseSqlServer(connectionString);
        });

        base.ConfigureServices(context);
    }
}
```

## 高级生命周期方法

对于需要更精细控制的场景，模块提供了额外的生命周期方法：

### PreConfigServices - 配置服务前

```csharp
public override void PreConfigServices(ModuleConfigServiceContext context)
{
    // 在 ConfigureServices 之前执行
    // 用于配置必须最先注册的服务
    
    context.Services.AddSingleton<IEarlyService, EarlyService>();
    
    base.PreConfigServices(context);
}
```

### PostConfigServices - 配置服务后

```csharp
public override void PostConfigServices(ModuleConfigServiceContext context)
{
    // 在 ConfigureServices 之后执行
    // 用于验证或调整已注册的服务
    
    var services = context.Services;
    
    // 验证必需的服务是否已注册
    if (!services.Any(d => d.ServiceType == typeof(IRequiredService)))
    {
        throw new InvalidOperationException("IRequiredService is not registered");
    }

    base.PostConfigServices(context);
}
```

### PreInitialization - 初始化前

```csharp
public override void PreInitialization(ModuleInitializationContext context)
{
    // 在 Initialization 之前执行
    // 用于准备初始化所需的资源
    
    base.PreInitialization(context);
}
```

### PostInitialization - 初始化后

```csharp
public override void PostInitialization(ModuleInitializationContext context)
{
    // 在 Initialization 之后执行
    // 用于验证初始化结果或执行后续操作
    
    base.PostInitialization(context);
}
```

## 功能模块示例

### 数据访问模块

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
        
        // 配置 DbContext
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

        // 自动注册仓储
        context.AutoRegisterRepositories(typeof(DataAccessModule).Assembly);

        base.ConfigureServices(context);
    }

    public override void Initialization(ModuleInitializationContext context)
    {
        // 初始化数据库
        var dbContext = context.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Database.Migrate();

        base.Initialization(context);
    }
}
```

## 模块组织建议

### 按功能组织

```
MyApp.Core (核心模块)
    - Domain/
    - Services/
    - CoreModule.cs

MyApp.DataAccess (数据访问模块)
    - DbContext/
    - Repositories/
    - DataAccessModule.cs

MyApp.Application (应用模块)
    - UseCases/
    - Dtos/
    - ApplicationModule.cs

MyApp.Web (Web 模块)
    - Controllers/
    - WebModule.cs (入口模块)
```

### 按层次组织

```
MyApp (入口模块)
    ↓
MyApp.Application (应用层模块)
    ↓
MyApp.Domain (领域层模块)
    ↓
MyApp.Infrastructure (基础设施模块)
```

## 注册模块

在 `Startup.cs` 中注册入口模块：

```csharp
public void ConfigureServices(IServiceCollection services)
{
    services.AddControllers();
    
    // 注册 MiCake 及入口模块
    services.AddMiCakeWithDefault<MyAppModule, MyDbContext>(options =>
    {
        options.AppConfig = app =>
        {
            // 应用配置
        };
    }).Build();
}

public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    app.UseRouting();
    
    // 启动 MiCake
    app.StartMiCake();
    
    app.UseEndpoints(endpoints =>
    {
        endpoints.MapControllers();
    });
}
```

## 模块最佳实践

### 1. 明确依赖

使用 `[RelyOn]` 明确声明依赖关系：

```csharp
// ✅ 正确：明确依赖
[RelyOn(typeof(DataAccessModule))]
public class ApplicationModule : MiCakeModule { }

// ❌ 错误：隐式依赖
public class ApplicationModule : MiCakeModule 
{
    // 使用了 DataAccessModule 的服务，但没有声明依赖
}
```

### 2. 避免循环依赖

```csharp
// ❌ 错误：循环依赖
[RelyOn(typeof(ModuleB))]
public class ModuleA : MiCakeModule { }

[RelyOn(typeof(ModuleA))]
public class ModuleB : MiCakeModule { }

// ✅ 正确：提取共同依赖
public class CommonModule : MiCakeModule { }

[RelyOn(typeof(CommonModule))]
public class ModuleA : MiCakeModule { }

[RelyOn(typeof(CommonModule))]
public class ModuleB : MiCakeModule { }
```

## 注意事项

1. **入口模块必须指定**：在 `AddMiCakeWithDefault` 中指定入口模块
2. **生命周期方法顺序**：理解各个生命周期方法的执行顺序
3. **依赖解析**：MiCake 会自动解析模块依赖并按正确顺序初始化
4. **避免循环依赖**：确保模块之间没有循环依赖关系
5. **调用 base 方法**：在重写生命周期方法时，记得调用 `base` 方法
