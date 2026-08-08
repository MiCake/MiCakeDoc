---
title: API 日志使用
description: 介绍如何使用 MiCake 的 API 日志功能，包括配置、特性和自定义写入器
---

## 功能概述

MiCake 的 API 日志增强功能提供了全面的 HTTP 请求/响应日志记录能力，专为生产环境设计，具有以下核心特性：

### 核心特性

+ **自动日志记录** - 无侵入式记录所有 API 请求和响应  
+ **敏感数据脱敏** - 自动屏蔽密码、令牌等敏感信息  
+ **可配置过滤** - 灵活的路径、状态码、内容类型过滤  
+ **性能优化** - 内置截断、缓存和 ArrayPool 优化  
+ **可扩展架构** - 通过接口自定义日志写入、处理和配置  
+ **特性控制** - 使用 Attribute 精确控制单个端点的日志行为

## 快速开始

### 1. 启用 API 日志

在 `Startup.cs` 或 `Program.cs` 中通过 `MiCakeAspNetOptions` 配置：

```csharp
services.AddMiCakeWithDefault<YourModule, YourDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        // 启用 API 日志功能
        asp.UseApiLogging = true;
    };
})
.Build();
```

### 2. 自定义配置（可选）

```csharp
services.AddMiCakeWithDefault<YourModule, YourDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        asp.UseApiLogging = true;
        
        // 排除成功响应
        asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };
        
        // 添加敏感字段
        asp.ApiLoggingOptions.SensitiveFields.Add("phoneNumber");
        asp.ApiLoggingOptions.SensitiveFields.Add("email");
        
        // 排除特定路径
        asp.ApiLoggingOptions.ExcludedPaths.Add("/health");
        asp.ApiLoggingOptions.ExcludedPaths.Add("/metrics");
        asp.ApiLoggingOptions.ExcludedPaths.Add("/swagger/**");
    };
})
.Build();
```

### 3. 验证配置

启动应用后，调用任意 API 端点，您将在日志中看到类似输出：

```json
{
  "correlationId": "abc123...",
  "timestamp": "2025-12-27T10:30:00Z",
  "request": {
    "method": "POST",
    "path": "/api/users",
    "body": "{\"name\":\"John\",\"password\":\"***\"}"
  },
  "response": {
    "statusCode": 201,
    "body": "{\"id\":123,\"name\":\"John\"}"
  },
  "elapsedMilliseconds": 45
}
```

---

## 配置选项详解

### ApiLoggingOptions 完整配置

```csharp
asp.ApiLoggingOptions = new ApiLoggingOptions
{
    // 功能开关
    Enabled = true,  // 是否启用日志（默认：true）
    
    // 请求/响应控制
    LogRequestHeaders = false,   // 是否记录请求头（默认：false）
    LogResponseHeaders = false,  // 是否记录响应头（默认：false）
    LogRequestBody = true,       // 是否记录请求体（默认：true）
    LogResponseBody = true,      // 是否记录响应体（默认：true）
    
    // 大小限制
    MaxRequestBodySize = 4096,   // 请求体最大字节数（默认：4KB）
    MaxResponseBodySize = 4096,  // 响应体最大字节数（默认：4KB）
    
    // 截断策略
    TruncationStrategy = TruncationStrategy.TruncateWithSummary,
    // - SimpleTruncate: 简单截断
    // - TruncateWithSummary: 截断并附加摘要（推荐）
    // - MetadataOnly: 仅记录元数据（大小、类型）
    
    // 排除规则
    ExcludeStatusCodes = new List<int>(),  // 排除的状态码
    ExcludedPaths = new List<string>       // 排除的路径（支持 glob）
    { 
        "/health", 
        "/metrics" 
    },
    ExcludedContentTypes = new List<string>  // 排除的内容类型
    { 
        "application/octet-stream",
        "image/*",
        "video/*" 
    },
    
    // 敏感数据
    SensitiveFields = new List<string>  // 需要脱敏的字段名
    { 
        "password",
        "token",
        "secret",
        "key",
        "authorization"
    }
};
```

### 配置最佳实践

#### 开发环境

```csharp
asp.ApiLoggingOptions.LogRequestHeaders = true;
asp.ApiLoggingOptions.LogResponseHeaders = true;
asp.ApiLoggingOptions.MaxRequestBodySize = 16384;  // 16KB
asp.ApiLoggingOptions.MaxResponseBodySize = 16384;
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int>();  // 记录所有状态码
```

#### 生产环境

```csharp
asp.ApiLoggingOptions.LogRequestHeaders = false;  // 减少日志量
asp.ApiLoggingOptions.LogResponseHeaders = false;
asp.ApiLoggingOptions.MaxRequestBodySize = 4096;  // 4KB
asp.ApiLoggingOptions.MaxResponseBodySize = 4096;
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };  // 仅记录异常
asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
```

---

## 控制器级别控制

使用特性（Attributes）可以精确控制单个控制器或操作的日志行为。

### SkipApiLogging - 跳过日志

完全跳过日志记录，适用于：
- 高频轮询端点
- 健康检查端点
- 文件下载/上传
- 已有其他日志机制的端点

```csharp
/// <summary>
/// 跳过整个控制器的日志
/// </summary>
[SkipApiLogging]
[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Check() => Ok("Healthy");
}

/// <summary>
/// 跳过单个操作的日志
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FileController : ControllerBase
{
    [HttpGet("download/{id}")]
    [SkipApiLogging]  // 文件下载不记录日志
    public async Task<IActionResult> Download(long id)
    {
        var stream = await _fileService.GetFileStreamAsync(id);
        return File(stream, "application/octet-stream");
    }
}
```

### AlwaysLog - 强制记录

忽略 `ExcludeStatusCodes` 配置，强制记录，适用于：
- 关键业务操作（支付、订单）
- 安全敏感操作（登录、密码修改）
- 需要审计的操作

```csharp
[ApiController]
[Route("api/[controller]")]
public class PaymentController : ControllerBase
{
    /// <summary>
    /// 支付操作 - 始终记录日志用于审计
    /// </summary>
    [HttpPost("process")]
    [AlwaysLog]  // 即使配置了 ExcludeStatusCodes = [200]，也会记录
    public async Task<IActionResult> ProcessPayment([FromBody] PaymentRequest request)
    {
        var result = await _paymentService.ProcessAsync(request);
        return Ok(result);
    }
}
```

### LogFullResponse - 记录完整响应

忽略大小限制，记录完整响应体，适用于：
- 调试特定端点
- 导出操作
- 报告生成

```csharp
[ApiController]
[Route("api/[controller]")]
public class ReportController : ControllerBase
{
    /// <summary>
    /// 生成报告 - 记录完整响应用于审计
    /// </summary>
    [HttpGet("generate")]
    [LogFullResponse]  // 忽略 MaxResponseBodySize 限制
    public async Task<IActionResult> GenerateReport()
    {
        var report = await _reportService.GenerateAsync();
        return Ok(report);
    }
    
    /// <summary>
    /// 导出数据 - 最多记录 64KB
    /// </summary>
    [HttpGet("export")]
    [LogFullResponse(MaxSize = 65536)]  // 自定义大小限制
    public async Task<IActionResult> ExportData()
    {
        var data = await _exportService.ExportAsync();
        return Ok(data);
    }
}
```

---

## 自定义日志写入器

实现 `IApiLogWriter` 接口可以将日志写入任何目的地。

### 接口定义

```csharp
/// <summary>
/// Defines a contract for writing API log entries.
/// </summary>
public interface IApiLogWriter
{
    /// <summary>
    /// Writes an API log entry asynchronously.
    /// </summary>
    /// <param name="entry">The log entry to write</param>
    /// <param name="cancellationToken">Cancellation token</param>
    Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken = default);
}
```

### 示例 1: 数据库日志写入器

将日志写入数据库用于长期存储和查询：

```csharp
using MiCake.AspNetCore.ApiLogging;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Writes API logs to database for long-term storage and querying.
/// </summary>
public class DatabaseApiLogWriter : IApiLogWriter
{
    private readonly IDbContextFactory<LogDbContext> _dbContextFactory;

    public DatabaseApiLogWriter(IDbContextFactory<LogDbContext> dbContextFactory)
    {
        _dbContextFactory = dbContextFactory;
    }

    public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken = default)
    {
        await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
        
        var logRecord = new ApiLogRecord
        {
            CorrelationId = entry.CorrelationId,
            Timestamp = entry.Timestamp,
            Method = entry.Request.Method,
            Path = entry.Request.Path,
            QueryString = entry.Request.QueryString,
            RequestBody = entry.Request.Body,
            RequestHeaders = entry.Request.Headers != null 
                ? string.Join(";", entry.Request.Headers.Select(h => $"{h.Key}={h.Value}"))
                : null,
            StatusCode = entry.Response.StatusCode,
            ResponseBody = entry.Response.Body,
            ResponseHeaders = entry.Response.Headers != null
                ? string.Join(";", entry.Response.Headers.Select(h => $"{h.Key}={h.Value}"))
                : null,
            ElapsedMilliseconds = entry.ElapsedMilliseconds,
            Exception = entry.Exception
        };

        dbContext.ApiLogs.Add(logRecord);
        // 直接使用原生 EF DbContext 写入（绕过仓储/UoW）。
        // 无 UoW 的直接 DbContext 写入按原生 EF Core 语义放行（隐式事务，无回滚/生命周期保证）。
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

// 注册
services.AddDbContextFactory<LogDbContext>(options => 
    options.UseSqlServer(connectionString));
services.AddSingleton<IApiLogWriter, DatabaseApiLogWriter>();
```

### 示例 2: Elasticsearch 日志写入器

将日志写入 Elasticsearch 用于高性能搜索和分析：

```csharp
using Elastic.Clients.Elasticsearch;
using MiCake.AspNetCore.ApiLogging;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Writes API logs to Elasticsearch for search and analytics.
/// </summary>
public class ElasticsearchApiLogWriter : IApiLogWriter
{
    private readonly ElasticsearchClient _client;
    private readonly string _indexPrefix;

    public ElasticsearchApiLogWriter(ElasticsearchClient client, string indexPrefix = "api-logs")
    {
        _client = client;
        _indexPrefix = indexPrefix;
    }

    public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken = default)
    {
        // Use daily index pattern: api-logs-2025-12-27
        var indexName = $"{_indexPrefix}-{entry.Timestamp:yyyy-MM-dd}";
        
        var document = new
        {
            entry.CorrelationId,
            entry.Timestamp,
            Request = new
            {
                entry.Request.Method,
                entry.Request.Path,
                entry.Request.QueryString,
                entry.Request.Body,
                entry.Request.ContentType
            },
            Response = new
            {
                entry.Response.StatusCode,
                entry.Response.Body,
                entry.Response.ContentType,
                entry.Response.IsTruncated,
                entry.Response.OriginalSize
            },
            entry.ElapsedMilliseconds,
            entry.Exception
        };

        await _client.IndexAsync(document, indexName, cancellationToken);
    }
}

// 注册
var settings = new ElasticsearchClientSettings(new Uri("http://localhost:9200"));
var client = new ElasticsearchClient(settings);
services.AddSingleton(client);
services.AddSingleton<IApiLogWriter, ElasticsearchApiLogWriter>();
```

### 示例 3: 文件日志写入器（带日志轮转）

将日志写入文件，支持按日期轮转：

```csharp
using MiCake.AspNetCore.ApiLogging;
using System;
using System.IO;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Writes API logs to daily rotating files.
/// </summary>
public class FileApiLogWriter : IApiLogWriter
{
    private readonly string _logDirectory;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public FileApiLogWriter(string logDirectory)
    {
        _logDirectory = logDirectory;
        _jsonOptions = new JsonSerializerOptions { WriteIndented = false };
        Directory.CreateDirectory(_logDirectory);
    }

    public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken = default)
    {
        var fileName = $"api-log-{DateTime.UtcNow:yyyy-MM-dd}.jsonl";
        var filePath = Path.Combine(_logDirectory, fileName);
        
        var json = JsonSerializer.Serialize(entry, _jsonOptions);
        
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            await File.AppendAllLinesAsync(filePath, new[] { json }, cancellationToken);
        }
        finally
        {
            _semaphore.Release();
        }
    }
}

// 注册
services.AddSingleton<IApiLogWriter>(sp => 
    new FileApiLogWriter(Path.Combine(env.ContentRootPath, "logs")));
```

### 示例 4: 批量写入优化

对于高吞吐量场景，使用批量写入减少 I/O 操作：

```csharp
using MiCake.AspNetCore.ApiLogging;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Batches API log entries for improved throughput.
/// </summary>
public class BatchingApiLogWriter : IApiLogWriter, IDisposable
{
    private readonly IApiLogWriter _innerWriter;
    private readonly ConcurrentQueue<ApiLogEntry> _queue = new();
    private readonly Timer _timer;
    private readonly int _batchSize;

    public BatchingApiLogWriter(IApiLogWriter innerWriter, int batchSize = 100)
    {
        _innerWriter = innerWriter;
        _batchSize = batchSize;
        _timer = new Timer(FlushBatch, null, TimeSpan.FromSeconds(5), TimeSpan.FromSeconds(5));
    }

    public Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken = default)
    {
        _queue.Enqueue(entry);
        
        if (_queue.Count >= _batchSize)
        {
            _ = Task.Run(() => FlushBatch(null), cancellationToken);
        }
        
        return Task.CompletedTask;
    }

    private async void FlushBatch(object? state)
    {
        var batch = new List<ApiLogEntry>();
        
        while (batch.Count < _batchSize && _queue.TryDequeue(out var entry))
        {
            batch.Add(entry);
        }

        if (batch.Count > 0)
        {
            foreach (var entry in batch)
            {
                await _innerWriter.WriteAsync(entry);
            }
        }
    }

    public void Dispose()
    {
        _timer?.Dispose();
        FlushBatch(null);
    }
}

// 注册
services.AddSingleton<IApiLogWriter>(sp => 
    new BatchingApiLogWriter(
        new DatabaseApiLogWriter(sp.GetRequiredService<IDbContextFactory<LogDbContext>>()),
        batchSize: 100));
```

---

## 自定义日志处理器

实现 `IApiLogProcessor` 可以在日志写入前进行自定义处理。

### 接口定义

```csharp
/// <summary>
/// Defines a processor that can modify API log entries before they are written.
/// </summary>
public interface IApiLogProcessor
{
    /// <summary>
    /// Gets the execution order of this processor.
    /// Lower values execute first.
    /// </summary>
    int Order { get; }

    /// <summary>
    /// Processes an API log entry.
    /// </summary>
    /// <param name="entry">The log entry to process</param>
    /// <param name="context">The processing context</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>The processed entry, or null to skip logging</returns>
    Task<ApiLogEntry?> ProcessAsync(
        ApiLogEntry entry,
        ApiLogProcessingContext context,
        CancellationToken cancellationToken = default);
}
```

### 内置处理器

MiCake 提供两个内置处理器：

1. **SensitiveMaskProcessor** (Order = 0) - 敏感数据脱敏
2. **TruncationProcessor** (Order = 10) - 响应体截断

### 示例 1: 添加业务上下文处理器

向日志条目添加业务相关信息：

```csharp
using MiCake.AspNetCore.ApiLogging;
using System.Linq;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Adds business context (user info, tenant, etc.) to log entries.
/// </summary>
public class BusinessContextProcessor : IApiLogProcessor
{
    private readonly IHttpContextAccessor _httpContextAccessor;

    // Execute before masking (Order = 0) and truncation (Order = 10)
    public int Order => -10;

    public BusinessContextProcessor(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public Task<ApiLogEntry?> ProcessAsync(
        ApiLogEntry entry,
        ApiLogProcessingContext context,
        CancellationToken cancellationToken = default)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext == null)
        {
            return Task.FromResult<ApiLogEntry?>(entry);
        }

        // Add user information
        var userId = httpContext.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = httpContext.User?.FindFirst(ClaimTypes.Name)?.Value;
        
        // Add tenant information (if multi-tenant)
        var tenantId = httpContext.User?.FindFirst("TenantId")?.Value;

        // Add custom properties
        entry.CustomProperties ??= new Dictionary<string, object?>();
        entry.CustomProperties["UserId"] = userId;
        entry.CustomProperties["UserName"] = userName;
        entry.CustomProperties["TenantId"] = tenantId;
        entry.CustomProperties["UserAgent"] = httpContext.Request.Headers["User-Agent"].ToString();
        entry.CustomProperties["ClientIP"] = httpContext.Connection.RemoteIpAddress?.ToString();

        return Task.FromResult<ApiLogEntry?>(entry);
    }
}

// 注册
services.AddHttpContextAccessor();
services.AddSingleton<IApiLogProcessor, BusinessContextProcessor>();
```

### 示例 2: 性能分析处理器

标记慢请求并添加性能分析信息：

```csharp
using MiCake.AspNetCore.ApiLogging;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Marks slow requests and adds performance metrics.
/// </summary>
public class PerformanceAnalysisProcessor : IApiLogProcessor
{
    private readonly int _slowThresholdMs;

    public int Order => 20;  // Run after masking and truncation

    public PerformanceAnalysisProcessor(int slowThresholdMs = 1000)
    {
        _slowThresholdMs = slowThresholdMs;
    }

    public Task<ApiLogEntry?> ProcessAsync(
        ApiLogEntry entry,
        ApiLogProcessingContext context,
        CancellationToken cancellationToken = default)
    {
        entry.CustomProperties ??= new Dictionary<string, object?>();

        // Mark slow requests
        if (entry.ElapsedMilliseconds > _slowThresholdMs)
        {
            entry.CustomProperties["IsSlowRequest"] = true;
            entry.CustomProperties["PerformanceTier"] = "Slow";
        }
        else if (entry.ElapsedMilliseconds > _slowThresholdMs / 2)
        {
            entry.CustomProperties["PerformanceTier"] = "Medium";
        }
        else
        {
            entry.CustomProperties["PerformanceTier"] = "Fast";
        }

        // Add performance categories
        entry.CustomProperties["ResponseTime"] = entry.ElapsedMilliseconds switch
        {
            < 100 => "Excellent",
            < 500 => "Good",
            < 1000 => "Acceptable",
            < 3000 => "Slow",
            _ => "Critical"
        };

        return Task.FromResult<ApiLogEntry?>(entry);
    }
}

// 注册
services.AddSingleton<IApiLogProcessor>(new PerformanceAnalysisProcessor(slowThresholdMs: 1000));
```

### 示例 3: 错误分类处理器

对错误进行分类和增强：

```csharp
using MiCake.AspNetCore.ApiLogging;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Categorizes errors and adds error classification.
/// </summary>
public class ErrorClassificationProcessor : IApiLogProcessor
{
    public int Order => 15;

    public Task<ApiLogEntry?> ProcessAsync(
        ApiLogEntry entry,
        ApiLogProcessingContext context,
        CancellationToken cancellationToken = default)
    {
        // Only process error responses
        if (entry.Response.StatusCode < 400)
        {
            return Task.FromResult<ApiLogEntry?>(entry);
        }

        entry.CustomProperties ??= new Dictionary<string, object?>();

        // Classify error type
        var errorType = entry.Response.StatusCode switch
        {
            400 => "BadRequest",
            401 => "Unauthorized",
            403 => "Forbidden",
            404 => "NotFound",
            409 => "Conflict",
            422 => "ValidationError",
            429 => "RateLimitExceeded",
            >= 500 => "ServerError",
            _ => "ClientError"
        };

        entry.CustomProperties["ErrorType"] = errorType;
        entry.CustomProperties["IsError"] = true;
        
        // Add severity
        entry.CustomProperties["Severity"] = entry.Response.StatusCode >= 500 
            ? "Critical" 
            : "Warning";

        return Task.FromResult<ApiLogEntry?>(entry);
    }
}

// 注册
services.AddSingleton<IApiLogProcessor, ErrorClassificationProcessor>();
```

---

## 自定义配置提供者

实现 `IApiLoggingConfigProvider` 可以动态加载配置（例如从数据库、配置中心）。

### 接口定义

```csharp
/// <summary>
/// Provides API logging configuration.
/// </summary>
public interface IApiLoggingConfigProvider
{
    /// <summary>
    /// Gets the effective API logging configuration.
    /// </summary>
    Task<ApiLoggingEffectiveConfig> GetEffectiveConfigAsync(
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Refreshes the configuration cache.
    /// </summary>
    Task RefreshAsync(CancellationToken cancellationToken = default);
}
```

### 示例: 数据库配置提供者

从数据库动态加载配置，支持运行时更新：

```csharp
using MiCake.AspNetCore.ApiLogging;
using Microsoft.EntityFrameworkCore;
using System.Threading;
using System.Threading.Tasks;

/// <summary>
/// Loads API logging configuration from database.
/// </summary>
public class DatabaseApiLoggingConfigProvider : IApiLoggingConfigProvider
{
    private readonly IDbContextFactory<ConfigDbContext> _dbContextFactory;
    private volatile ApiLoggingEffectiveConfig? _cachedConfig;
    private readonly SemaphoreSlim _lock = new(1, 1);

    public DatabaseApiLoggingConfigProvider(IDbContextFactory<ConfigDbContext> dbContextFactory)
    {
        _dbContextFactory = dbContextFactory;
    }

    public async Task<ApiLoggingEffectiveConfig> GetEffectiveConfigAsync(
        CancellationToken cancellationToken = default)
    {
        if (_cachedConfig != null)
        {
            return _cachedConfig;
        }

        await _lock.WaitAsync(cancellationToken);
        try
        {
            if (_cachedConfig != null)
            {
                return _cachedConfig;
            }

            await using var dbContext = await _dbContextFactory.CreateDbContextAsync(cancellationToken);
            
            var config = await dbContext.ApiLoggingConfigs
                .Where(c => c.IsActive)
                .OrderByDescending(c => c.Priority)
                .FirstOrDefaultAsync(cancellationToken);

            if (config == null)
            {
                // Fallback to default
                _cachedConfig = ApiLoggingEffectiveConfig.FromOptions(new ApiLoggingOptions());
            }
            else
            {
                var options = new ApiLoggingOptions
                {
                    Enabled = config.Enabled,
                    ExcludeStatusCodes = ParseIntList(config.ExcludeStatusCodes),
                    ExcludedPaths = ParseStringList(config.ExcludedPaths),
                    SensitiveFields = ParseStringList(config.SensitiveFields),
                    MaxRequestBodySize = config.MaxRequestBodySize,
                    MaxResponseBodySize = config.MaxResponseBodySize,
                    LogRequestHeaders = config.LogRequestHeaders,
                    LogResponseHeaders = config.LogResponseHeaders
                };

                _cachedConfig = ApiLoggingEffectiveConfig.FromOptions(options);
            }

            return _cachedConfig;
        }
        finally
        {
            _lock.Release();
        }
    }

    public Task RefreshAsync(CancellationToken cancellationToken = default)
    {
        _cachedConfig = null;
        return Task.CompletedTask;
    }

    private static List<int> ParseIntList(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv))
            return new List<int>();
        
        return csv.Split(',')
            .Select(s => int.TryParse(s.Trim(), out var val) ? val : 0)
            .Where(v => v > 0)
            .ToList();
    }

    private static List<string> ParseStringList(string? csv)
    {
        if (string.IsNullOrWhiteSpace(csv))
            return new List<string>();
        
        return csv.Split(',')
            .Select(s => s.Trim())
            .Where(s => !string.IsNullOrEmpty(s))
            .ToList();
    }
}

// 配置刷新端点
[ApiController]
[Route("api/admin")]
public class AdminController : ControllerBase
{
    private readonly IApiLoggingConfigProvider _configProvider;

    public AdminController(IApiLoggingConfigProvider configProvider)
    {
        _configProvider = configProvider;
    }

    [HttpPost("refresh-logging-config")]
    public async Task<IActionResult> RefreshLoggingConfig()
    {
        await _configProvider.RefreshAsync();
        return Ok(new { Message = "API logging configuration refreshed" });
    }
}

// 注册
services.AddSingleton<IApiLoggingConfigProvider, DatabaseApiLoggingConfigProvider>();
```

---

## 自定义敏感数据脱敏

实现 `ISensitiveDataMasker` 可以自定义敏感数据脱敏逻辑。

### 接口定义

```csharp
/// <summary>
/// Defines a contract for masking sensitive data in request/response bodies.
/// </summary>
public interface ISensitiveDataMasker
{
    /// <summary>
    /// Masks sensitive data in the given content.
    /// </summary>
    /// <param name="content">The content to mask</param>
    /// <param name="sensitiveFields">The list of sensitive field names</param>
    /// <param name="contentType">The content type of the data</param>
    /// <returns>The masked content</returns>
    string? Mask(string? content, List<string> sensitiveFields, string? contentType = null);
}
```

### 示例: XML 敏感数据脱敏器

支持 XML 格式的敏感数据脱敏：

```csharp
using MiCake.AspNetCore.ApiLogging;
using System.Xml.Linq;

/// <summary>
/// Masks sensitive data in XML content.
/// </summary>
public class XmlSensitiveDataMasker : ISensitiveDataMasker
{
    private const string MaskValue = "***";

    public string? Mask(string? content, List<string> sensitiveFields, string? contentType = null)
    {
        if (string.IsNullOrWhiteSpace(content))
            return content;

        // Only process XML content
        if (contentType == null || 
            (!contentType.Contains("xml", StringComparison.OrdinalIgnoreCase) &&
             !contentType.Contains("application/xml", StringComparison.OrdinalIgnoreCase)))
        {
            return content;
        }

        try
        {
            var doc = XDocument.Parse(content);
            MaskXmlElement(doc.Root, sensitiveFields);
            return doc.ToString(SaveOptions.DisableFormatting);
        }
        catch
        {
            return content;
        }
    }

    private static void MaskXmlElement(XElement? element, List<string> sensitiveFields)
    {
        if (element == null)
            return;

        // Mask element value if element name is sensitive
        if (sensitiveFields.Any(f => element.Name.LocalName.Equals(f, StringComparison.OrdinalIgnoreCase)))
        {
            element.Value = MaskValue;
        }

        // Mask attributes
        foreach (var attr in element.Attributes())
        {
            if (sensitiveFields.Any(f => attr.Name.LocalName.Equals(f, StringComparison.OrdinalIgnoreCase)))
            {
                attr.Value = MaskValue;
            }
        }

        // Recursively process child elements
        foreach (var child in element.Elements())
        {
            MaskXmlElement(child, sensitiveFields);
        }
    }
}

// 注册（可以同时注册多个脱敏器）
services.AddSingleton<ISensitiveDataMasker, JsonSensitiveDataMasker>();  // 内置
services.AddSingleton<ISensitiveDataMasker, XmlSensitiveDataMasker>();   // 自定义
```

---

## 最佳实践

### 1. 合理配置排除规则

❌ **不推荐**：记录所有请求
```csharp
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int>();
asp.ApiLoggingOptions.ExcludedPaths = new List<string>();
```

✅ **推荐**：排除常见的健康检查和成功响应
```csharp
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };
asp.ApiLoggingOptions.ExcludedPaths = new List<string>
{
    "/health",
    "/metrics",
    "/swagger/**",
    "/_framework/**"  // Blazor
};
```

### 2. 敏感字段配置

根据业务需求添加敏感字段：

```csharp
asp.ApiLoggingOptions.SensitiveFields.AddRange(new[]
{
    // 默认已包含: password, token, secret, key, authorization
    
    // 个人信息
    "email",
    "phoneNumber",
    "phone",
    "idCard",
    "ssn",
    
    // 支付信息
    "creditCard",
    "cardNumber",
    "cvv",
    "bankAccount",
    
    // 业务敏感
    "apiKey",
    "apiSecret",
    "accessToken",
    "refreshToken"
});
```

### 3. 使用特性精确控制

在控制器方法上使用特性，而不是全局排除：

```csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet]  // 正常记录
    public IActionResult GetAll() => Ok(_users);
    
    [HttpGet("{id}")]  // 正常记录
    public IActionResult Get(int id) => Ok(_users[id]);
    
    [HttpPost]
    [AlwaysLog]  // 创建用户 - 始终记录
    public IActionResult Create([FromBody] User user) => Created();
    
    [HttpPut("{id}")]
    [AlwaysLog]  // 更新用户 - 始终记录
    public IActionResult Update(int id, [FromBody] User user) => NoContent();
    
    [HttpGet("export")]
    [SkipApiLogging]  // 导出数据 - 跳过（数据量大）
    public IActionResult Export() => File(data, "text/csv");
}
```

### 4. 环境差异化配置

```csharp
services.AddMiCakeWithDefault<YourModule, YourDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        asp.UseApiLogging = true;
        
        if (env.IsDevelopment())
        {
            // 开发环境：详细日志
            asp.ApiLoggingOptions.LogRequestHeaders = true;
            asp.ApiLoggingOptions.LogResponseHeaders = true;
            asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int>();
        }
        else if (env.IsStaging())
        {
            // 预发布环境：中等详细度
            asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };
        }
        else // Production
        {
            // 生产环境：仅记录异常
            asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 201, 204 };
            asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
            asp.ApiLoggingOptions.MaxRequestBodySize = 2048;
            asp.ApiLoggingOptions.MaxResponseBodySize = 2048;
        }
    };
})
.Build();
```

### 5. 监控日志性能

定期检查日志量和性能影响：

```csharp
/// <summary>
/// Monitoring processor that tracks logging overhead.
/// </summary>
public class LoggingMonitoringProcessor : IApiLogProcessor
{
    private readonly IMetricsCollector _metrics;

    public int Order => 100;  // Execute last

    public Task<ApiLogEntry?> ProcessAsync(
        ApiLogEntry entry,
        ApiLogProcessingContext context,
        CancellationToken cancellationToken = default)
    {
        // Track metrics
        _metrics.Increment("api_logs_total");
        _metrics.Histogram("api_log_request_size", entry.Request.Body?.Length ?? 0);
        _metrics.Histogram("api_log_response_size", entry.Response.Body?.Length ?? 0);
        
        if (entry.Response.IsTruncated)
        {
            _metrics.Increment("api_logs_truncated");
        }

        return Task.FromResult<ApiLogEntry?>(entry);
    }
}
```

---

## 性能考虑

### 内置优化

MiCake API 日志功能已经包含以下性能优化：

1. **正则表达式缓存** - Glob 模式编译后缓存，避免重复编译
2. **ArrayPool 缓冲区** - 使用共享缓冲池减少内存分配
3. **ConfigureAwait(false)** - 所有异步方法避免捕获同步上下文
4. **特性缓存** - 控制器/操作特性信息缓存
5. **按需缓冲** - 仅在需要时启用请求体缓冲

### 性能建议

#### 1. 控制日志量

```csharp
// 生产环境：只记录错误和关键操作
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 201, 204 };

// 使用 [AlwaysLog] 标记关键操作
[AlwaysLog]
[HttpPost("payment")]
public IActionResult ProcessPayment() { ... }
```

#### 2. 限制响应体大小

```csharp
// 限制大小，避免记录大型响应
asp.ApiLoggingOptions.MaxResponseBodySize = 4096;  // 4KB
asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
```

#### 3. 使用异步写入

确保 `IApiLogWriter` 实现是异步的，避免阻塞请求处理：

```csharp
public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken)
{
    // ✅ 使用异步 I/O（直接使用原生 EF DbContext，无 UoW 写入按原生语义放行）
    await _dbContext.ApiLogs.AddAsync(logRecord, cancellationToken);
    await _dbContext.SaveChangesAsync(cancellationToken);
    
    // ❌ 避免同步 I/O
    // _dbContext.ApiLogs.Add(logRecord);
    // _dbContext.SaveChanges();
}
```

#### 4. 考虑批量写入

对于高吞吐量场景，使用批量写入：

```csharp
services.AddSingleton<IApiLogWriter>(sp => 
    new BatchingApiLogWriter(
        new DatabaseApiLogWriter(...),
        batchSize: 100,
        flushIntervalSeconds: 5));
```

### 性能监控

添加性能监控以识别瓶颈：

```csharp
public class PerformanceMonitoringLogWriter : IApiLogWriter
{
    private readonly IApiLogWriter _innerWriter;
    private readonly ILogger _logger;

    public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken)
    {
        var sw = Stopwatch.StartNew();
        
        try
        {
            await _innerWriter.WriteAsync(entry, cancellationToken);
        }
        finally
        {
            sw.Stop();
            if (sw.ElapsedMilliseconds > 100)
            {
                _logger.LogWarning(
                    "Slow log write detected: {ElapsedMs}ms", 
                    sw.ElapsedMilliseconds);
            }
        }
    }
}
```

---

## 故障排查

### 问题 1: 日志未记录

**症状**: API 调用后没有看到任何日志

**检查清单**:
1. ✅ 确认 `UseApiLogging = true`
2. ✅ 检查路径是否在 `ExcludedPaths` 中
3. ✅ 检查状态码是否在 `ExcludeStatusCodes` 中
4. ✅ 检查是否使用了 `[SkipApiLogging]` 特性
5. ✅ 检查 `Enabled = true`
6. ✅ 验证 `IApiLogWriter` 已正确注册

**调试代码**:
```csharp
// 临时启用详细日志
services.Configure<LoggerFilterOptions>(options =>
{
    options.AddFilter("MiCake.AspNetCore.ApiLogging", LogLevel.Debug);
});
```

### 问题 2: 敏感数据未脱敏

**症状**: 日志中仍然显示密码等敏感信息

**检查**:
```csharp
// 确认字段名匹配（大小写不敏感）
asp.ApiLoggingOptions.SensitiveFields.Add("password");  // ✅
asp.ApiLoggingOptions.SensitiveFields.Add("Password");  // ✅ 也可以

// 检查 JSON 字段名
// 如果 API 返回 {"userPassword": "..."}
asp.ApiLoggingOptions.SensitiveFields.Add("userPassword");  // ✅ 精确匹配
```

### 问题 3: 日志写入失败

**症状**: 应用日志中看到警告 "API log processor failed"

**诊断**:
```csharp
// 添加详细错误日志
public class DiagnosticApiLogWriter : IApiLogWriter
{
    private readonly ILogger _logger;

    public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken)
    {
        try
        {
            // 您的写入逻辑
            await WriteToDestinationAsync(entry, cancellationToken);
            
            _logger.LogDebug("Successfully wrote log for {Path}", entry.Request.Path);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, 
                "Failed to write API log for {Path}. Entry: {@Entry}", 
                entry.Request.Path, 
                entry);
            throw;
        }
    }
}
```

### 问题 4: 性能影响过大

**症状**: API 响应时间显著增加

**优化步骤**:
1. 减少日志量
```csharp
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };
```

2. 减小日志大小
```csharp
asp.ApiLoggingOptions.MaxRequestBodySize = 1024;   // 1KB
asp.ApiLoggingOptions.MaxResponseBodySize = 1024;
asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
```

3. 使用异步批量写入
4. 考虑使用专门的日志写入线程