---
title: API Logging Usage
description: Learn how to use MiCake's API logging feature, including configuration, attributes, and custom writers
---

## Feature Overview

MiCake's API logging enhancement provides comprehensive HTTP request/response logging capabilities, designed for production environments, with the following core features:

### Core Features

+ **Automatic logging** - non-intrusively records all API requests and responses  
+ **Sensitive data masking** - automatically masks sensitive information such as passwords and tokens  
+ **Configurable filtering** - flexible path, status code, and content type filtering  
+ **Performance optimization** - built-in truncation, caching, and ArrayPool optimizations  
+ **Extensible architecture** - customize log writing, processing, and configuration through interfaces  
+ **Attribute control** - use attributes to precisely control the logging behavior of individual endpoints

## Quick Start

### 1. Enable API Logging

Configure it through `MiCakeAspNetOptions` in `Startup.cs` or `Program.cs`:

```csharp
services.AddMiCakeWithDefault<YourModule, YourDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        // Enable the API logging feature
        asp.UseApiLogging = true;
    };
})
.Build();
```

### 2. Custom Configuration (Optional)

```csharp
services.AddMiCakeWithDefault<YourModule, YourDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        asp.UseApiLogging = true;
        
        // Exclude successful responses
        asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };
        
        // Add sensitive fields
        asp.ApiLoggingOptions.SensitiveFields.Add("phoneNumber");
        asp.ApiLoggingOptions.SensitiveFields.Add("email");
        
        // Exclude specific paths
        asp.ApiLoggingOptions.ExcludedPaths.Add("/health");
        asp.ApiLoggingOptions.ExcludedPaths.Add("/metrics");
        asp.ApiLoggingOptions.ExcludedPaths.Add("/swagger/**");
    };
})
.Build();
```

### 3. Verify the Configuration

After starting the application, call any API endpoint and you will see output similar to this in the logs:

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

## Configuration Options in Detail

### The Complete ApiLoggingOptions Configuration

```csharp
asp.ApiLoggingOptions = new ApiLoggingOptions
{
    // Feature switches
    Enabled = true,  // Whether logging is enabled (default: true)
    
    // Request/response control
    LogRequestHeaders = false,   // Whether to log request headers (default: false)
    LogResponseHeaders = false,  // Whether to log response headers (default: false)
    LogRequestBody = true,       // Whether to log the request body (default: true)
    LogResponseBody = true,      // Whether to log the response body (default: true)
    
    // Size limits
    MaxRequestBodySize = 4096,   // Maximum request body size in bytes (default: 4KB)
    MaxResponseBodySize = 4096,  // Maximum response body size in bytes (default: 4KB)
    
    // Truncation strategy
    TruncationStrategy = TruncationStrategy.TruncateWithSummary,
    // - SimpleTruncate: simple truncation
    // - TruncateWithSummary: truncate and append a summary (recommended)
    // - MetadataOnly: log only the metadata (size, type)
    
    // Exclusion rules
    ExcludeStatusCodes = new List<int>(),  // Status codes to exclude
    ExcludedPaths = new List<string>       // Paths to exclude (glob supported)
    { 
        "/health", 
        "/metrics" 
    },
    ExcludedContentTypes = new List<string>  // Content types to exclude
    { 
        "application/octet-stream",
        "image/*",
        "video/*" 
    },
    
    // Sensitive data
    SensitiveFields = new List<string>  // Field names that need masking
    { 
        "password",
        "token",
        "secret",
        "key",
        "authorization"
    }
};
```

### Configuration Best Practices

#### Development Environment

```csharp
asp.ApiLoggingOptions.LogRequestHeaders = true;
asp.ApiLoggingOptions.LogResponseHeaders = true;
asp.ApiLoggingOptions.MaxRequestBodySize = 16384;  // 16KB
asp.ApiLoggingOptions.MaxResponseBodySize = 16384;
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int>();  // Log all status codes
```

#### Production Environment

```csharp
asp.ApiLoggingOptions.LogRequestHeaders = false;  // Reduce log volume
asp.ApiLoggingOptions.LogResponseHeaders = false;
asp.ApiLoggingOptions.MaxRequestBodySize = 4096;  // 4KB
asp.ApiLoggingOptions.MaxResponseBodySize = 4096;
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };  // Log only exceptions
asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
```

---

## Controller-Level Control

You can use attributes to precisely control the logging behavior of individual controllers or actions.

### SkipApiLogging - Skip Logging

Skip logging entirely, suitable for:
- High-frequency polling endpoints
- Health check endpoints
- File download/upload
- Endpoints that already have another logging mechanism

```csharp
/// <summary>
/// Skip logging for the entire controller
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
/// Skip logging for a single action
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class FileController : ControllerBase
{
    [HttpGet("download/{id}")]
    [SkipApiLogging]  // File downloads are not logged
    public async Task<IActionResult> Download(long id)
    {
        var stream = await _fileService.GetFileStreamAsync(id);
        return File(stream, "application/octet-stream");
    }
}
```

### AlwaysLog - Force Logging

Ignores the `ExcludeStatusCodes` configuration and forces logging. Suitable for:
- Critical business operations (payments, orders)
- Security-sensitive operations (login, password changes)
- Operations that need auditing

```csharp
[ApiController]
[Route("api/[controller]")]
public class PaymentController : ControllerBase
{
    /// <summary>
    /// Payment operation - always logs for auditing
    /// </summary>
    [HttpPost("process")]
    [AlwaysLog]  // Logged even if ExcludeStatusCodes = [200] is configured
    public async Task<IActionResult> ProcessPayment([FromBody] PaymentRequest request)
    {
        var result = await _paymentService.ProcessAsync(request);
        return Ok(result);
    }
}
```

### LogFullResponse - Log the Full Response

Ignores the size limit and logs the full response body. Suitable for:
- Debugging a specific endpoint
- Export operations
- Report generation

```csharp
[ApiController]
[Route("api/[controller]")]
public class ReportController : ControllerBase
{
    /// <summary>
    /// Generate a report - log the full response for auditing
    /// </summary>
    [HttpGet("generate")]
    [LogFullResponse]  // Ignores the MaxResponseBodySize limit
    public async Task<IActionResult> GenerateReport()
    {
        var report = await _reportService.GenerateAsync();
        return Ok(report);
    }
    
    /// <summary>
    /// Export data - log up to 64KB
    /// </summary>
    [HttpGet("export")]
    [LogFullResponse(MaxSize = 65536)]  // Custom size limit
    public async Task<IActionResult> ExportData()
    {
        var data = await _exportService.ExportAsync();
        return Ok(data);
    }
}
```

---

## Custom Log Writers

Implement the `IApiLogWriter` interface to write logs to any destination.

### The Interface Definition

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

### Example 1: A Database Log Writer

Write logs to a database for long-term storage and querying:

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
        // Uses the raw EF Core DbContext directly (bypassing repositories/UoW).
        // Direct DbContext writes without a UoW are allowed with native EF Core semantics (implicit transaction, no rollback/lifecycle guarantees).
        await dbContext.SaveChangesAsync(cancellationToken);
    }
}

// Registration
services.AddDbContextFactory<LogDbContext>(options => 
    options.UseSqlServer(connectionString));
services.AddSingleton<IApiLogWriter, DatabaseApiLogWriter>();
```

### Example 2: An Elasticsearch Log Writer

Write logs to Elasticsearch for high-performance search and analytics:

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

// Registration
var settings = new ElasticsearchClientSettings(new Uri("http://localhost:9200"));
var client = new ElasticsearchClient(settings);
services.AddSingleton(client);
services.AddSingleton<IApiLogWriter, ElasticsearchApiLogWriter>();
```

### Example 3: A File Log Writer (with Log Rotation)

Write logs to files with daily rotation:

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

// Registration
services.AddSingleton<IApiLogWriter>(sp => 
    new FileApiLogWriter(Path.Combine(env.ContentRootPath, "logs")));
```

### Example 4: Batch-Write Optimization

For high-throughput scenarios, use batch writing to reduce I/O operations:

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

// Registration
services.AddSingleton<IApiLogWriter>(sp => 
    new BatchingApiLogWriter(
        new DatabaseApiLogWriter(sp.GetRequiredService<IDbContextFactory<LogDbContext>>()),
        batchSize: 100));
```

---

## Custom Log Processors

Implement `IApiLogProcessor` to perform custom processing before the log is written.

### The Interface Definition

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

### Built-In Processors

MiCake provides two built-in processors:

1. **SensitiveMaskProcessor** (Order = 0) - sensitive data masking
2. **TruncationProcessor** (Order = 10) - response body truncation

### Example 1: A Business Context Processor

Add business-related information to log entries:

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

// Registration
services.AddHttpContextAccessor();
services.AddSingleton<IApiLogProcessor, BusinessContextProcessor>();
```

### Example 2: A Performance Analysis Processor

Mark slow requests and add performance analysis information:

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

// Registration
services.AddSingleton<IApiLogProcessor>(new PerformanceAnalysisProcessor(slowThresholdMs: 1000));
```

### Example 3: An Error Classification Processor

Categorize and enhance errors:

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

// Registration
services.AddSingleton<IApiLogProcessor, ErrorClassificationProcessor>();
```

---

## Custom Configuration Providers

Implement `IApiLoggingConfigProvider` to load configuration dynamically (e.g. from a database or a configuration center).

### The Interface Definition

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

### Example: A Database Configuration Provider

Load configuration dynamically from a database with runtime updates:

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

// Configuration refresh endpoint
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

// Registration
services.AddSingleton<IApiLoggingConfigProvider, DatabaseApiLoggingConfigProvider>();
```

---

## Custom Sensitive Data Masking

Implement `ISensitiveDataMasker` to customize the sensitive data masking logic.

### The Interface Definition

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

### Example: An XML Sensitive Data Masker

Supports sensitive data masking for XML content:

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

// Registration (multiple maskers can be registered at the same time)
services.AddSingleton<ISensitiveDataMasker, JsonSensitiveDataMasker>();  // Built-in
services.AddSingleton<ISensitiveDataMasker, XmlSensitiveDataMasker>();   // Custom
```

---

## Best Practices

### 1. Configure Exclusion Rules Sensibly

❌ **Not recommended**: log all requests
```csharp
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int>();
asp.ApiLoggingOptions.ExcludedPaths = new List<string>();
```

✅ **Recommended**: exclude common health checks and successful responses
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

### 2. Configure Sensitive Fields

Add sensitive fields based on your business needs:

```csharp
asp.ApiLoggingOptions.SensitiveFields.AddRange(new[]
{
    // Included by default: password, token, secret, key, authorization
    
    // Personal information
    "email",
    "phoneNumber",
    "phone",
    "idCard",
    "ssn",
    
    // Payment information
    "creditCard",
    "cardNumber",
    "cvv",
    "bankAccount",
    
    // Business-sensitive
    "apiKey",
    "apiSecret",
    "accessToken",
    "refreshToken"
});
```

### 3. Use Attributes for Precise Control

Use attributes on controller methods instead of global exclusions:

```csharp
[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    [HttpGet]  // Logged normally
    public IActionResult GetAll() => Ok(_users);
    
    [HttpGet("{id}")]  // Logged normally
    public IActionResult Get(int id) => Ok(_users[id]);
    
    [HttpPost]
    [AlwaysLog]  // Create user - always logged
    public IActionResult Create([FromBody] User user) => Created();
    
    [HttpPut("{id}")]
    [AlwaysLog]  // Update user - always logged
    public IActionResult Update(int id, [FromBody] User user) => NoContent();
    
    [HttpGet("export")]
    [SkipApiLogging]  // Export data - skipped (large amount of data)
    public IActionResult Export() => File(data, "text/csv");
}
```

### 4. Differentiated Configuration by Environment

```csharp
services.AddMiCakeWithDefault<YourModule, YourDbContext>(options =>
{
    options.AspNetConfig = asp =>
    {
        asp.UseApiLogging = true;
        
        if (env.IsDevelopment())
        {
            // Development environment: detailed logs
            asp.ApiLoggingOptions.LogRequestHeaders = true;
            asp.ApiLoggingOptions.LogResponseHeaders = true;
            asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int>();
        }
        else if (env.IsStaging())
        {
            // Staging environment: medium detail
            asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };
        }
        else // Production
        {
            // Production environment: log only exceptions
            asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 201, 204 };
            asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
            asp.ApiLoggingOptions.MaxRequestBodySize = 2048;
            asp.ApiLoggingOptions.MaxResponseBodySize = 2048;
        }
    };
})
.Build();
```

### 5. Monitor Logging Performance

Regularly check the log volume and performance impact:

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

## Performance Considerations

### Built-In Optimizations

The MiCake API logging feature already includes the following performance optimizations:

1. **Regex caching** - glob patterns are compiled and cached to avoid recompilation
2. **ArrayPool buffers** - uses shared buffer pools to reduce memory allocation
3. **ConfigureAwait(false)** - all async methods avoid capturing the synchronization context
4. **Attribute caching** - controller/action attribute information is cached
5. **On-demand buffering** - request body buffering is only enabled when needed

### Performance Recommendations

#### 1. Control the Log Volume

```csharp
// Production environment: log only errors and critical operations
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 201, 204 };

// Use [AlwaysLog] to mark critical operations
[AlwaysLog]
[HttpPost("payment")]
public IActionResult ProcessPayment() { ... }
```

#### 2. Limit the Response Body Size

```csharp
// Limit the size to avoid logging large responses
asp.ApiLoggingOptions.MaxResponseBodySize = 4096;  // 4KB
asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
```

#### 3. Use Asynchronous Writing

Make sure the `IApiLogWriter` implementation is asynchronous to avoid blocking request processing:

```csharp
public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken)
{
    // ✅ Use asynchronous I/O (raw EF DbContext; writes without a UoW are allowed with native semantics)
    await _dbContext.ApiLogs.AddAsync(logRecord, cancellationToken);
    await _dbContext.SaveChangesAsync(cancellationToken);
    
    // ❌ Avoid synchronous I/O
    // _dbContext.ApiLogs.Add(logRecord);
    // _dbContext.SaveChanges();
}
```

#### 4. Consider Batch Writing

For high-throughput scenarios, use batch writing:

```csharp
services.AddSingleton<IApiLogWriter>(sp => 
    new BatchingApiLogWriter(
        new DatabaseApiLogWriter(...),
        batchSize: 100,
        flushIntervalSeconds: 5));
```

### Performance Monitoring

Add performance monitoring to identify bottlenecks:

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

## Troubleshooting

### Issue 1: Logs Are Not Being Recorded

**Symptoms**: no logs after API calls

**Checklist**:
1. ✅ Confirm `UseApiLogging = true`
2. ✅ Check whether the path is in `ExcludedPaths`
3. ✅ Check whether the status code is in `ExcludeStatusCodes`
4. ✅ Check whether the `[SkipApiLogging]` attribute is used
5. ✅ Check `Enabled = true`
6. ✅ Verify that `IApiLogWriter` is registered correctly

**Debugging code**:
```csharp
// Temporarily enable detailed logging
services.Configure<LoggerFilterOptions>(options =>
{
    options.AddFilter("MiCake.AspNetCore.ApiLogging", LogLevel.Debug);
});
```

### Issue 2: Sensitive Data Is Not Masked

**Symptoms**: sensitive information such as passwords still appears in the logs

**Check**:
```csharp
// Confirm that the field name matches (case-insensitive)
asp.ApiLoggingOptions.SensitiveFields.Add("password");  // ✅
asp.ApiLoggingOptions.SensitiveFields.Add("Password");  // ✅ also works

// Check the JSON field name
// If the API returns {"userPassword": "..."}
asp.ApiLoggingOptions.SensitiveFields.Add("userPassword");  // ✅ exact match
```

### Issue 3: Log Writing Fails

**Symptoms**: the warning "API log processor failed" appears in the application logs

**Diagnosis**:
```csharp
// Add detailed error logging
public class DiagnosticApiLogWriter : IApiLogWriter
{
    private readonly ILogger _logger;

    public async Task WriteAsync(ApiLogEntry entry, CancellationToken cancellationToken)
    {
        try
        {
            // Your writing logic
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

### Issue 4: Too Much Performance Impact

**Symptoms**: API response times increase noticeably

**Optimization steps**:
1. Reduce the log volume
```csharp
asp.ApiLoggingOptions.ExcludeStatusCodes = new List<int> { 200, 204 };
```

2. Reduce the log size
```csharp
asp.ApiLoggingOptions.MaxRequestBodySize = 1024;   // 1KB
asp.ApiLoggingOptions.MaxResponseBodySize = 1024;
asp.ApiLoggingOptions.TruncationStrategy = TruncationStrategy.MetadataOnly;
```

3. Use asynchronous batch writing
4. Consider using a dedicated log-writing thread
