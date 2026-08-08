---
title: 快速开始
---

本指南将帮助您通过模板项目创建一个基于MiCake的`ASP.NET Core`应用：

## 前置要求

在开始之前，请确保您的开发环境满足以下要求：

- **.NET Core 10.0** 或更高版本
- **Visual Studio Code** 或者 **Visual Studio 2022（或更高版本）**
- 基本的 **C#** 和 **ASP.NET Core** 知识
- 了解 **Entity Framework Core** 基础（可选）

## 从模板开始

下面的步骤将指导您如何使用 MiCake 提供的`dotnet new`模板来快速创建一个新的项目。
在此之前请确保您已经安装了最新的.NET SDK。

如果你想基于自己的项目来构建，请参考[现有项目集成](/getting-started/from-custom/) 

### 1. 安装模板集合

首先，安装 MiCake.Templates 模板包：

```bash
dotnet new install MiCake.Templates
```

### 2. 创建新项目

MiCake.Templates 提供了两个模板：

- **标准 WebAPI 模板** (`micake-webapi`)：基于 MiCake 的标准 ASP.NET Core Web API 模板，包含基本的 DDD 架构。
- **带 RBAC 的 WebAPI 模板** (`micake-webapi-rbac`)：在标准模板基础上增加了基于角色的访问控制 (RBAC) 功能。

选择合适的模板创建项目：

```bash
# 创建标准 WebAPI 项目
dotnet new micake-webapi -n MyProjectName

# 或创建带 RBAC 的 WebAPI 项目
dotnet new micake-webapi-rbac -n MyProjectName
```

### 3. 配置和运行项目

进入项目目录：

```bash
cd MyProjectName
```

构建项目：

```bash
dotnet build
```

运行项目：

```bash
dotnet run
```

项目启动后，您可以在浏览器中访问 `http://localhost:port/scalar/v1` 查看 API 文档（开发环境默认启用 Scalar OpenAPI 界面）。

### 4. 数据库配置（可选）

模板默认使用 PostgreSQL。如果需要运行完整功能，请确保数据库已配置：

- 更新 `appsettings.Development.json` 中的连接字符串。
- 使用 EF Core 迁移工具初始化数据库（参考项目中的 README 文件）。


## 下一步

恭喜！您已经成功搭建了一个基于 MiCake 的 DDD 应用。接下来可以：

- 学习 [核心概念](/getting-started/core-concepts/) 深入理解 MiCake 的设计
- 阅读 [实体](/domain-driven/entity/) 了解实体的详细用法
- 探索 [聚合根](/domain-driven/aggregate-root/) 学习聚合的设计原则
- 查看 [领域事件](/domain-driven/domain-event/) 掌握事件驱动开发
- 学习 [仓储](/domain-driven/repository/) 了解数据持久化的最佳实践

## 获取帮助

如果遇到问题，可以：
- 查看 [GitHub Issues](https://github.com/MiCake/MiCake/issues)
- 阅读详细的功能文档
- 参考示例代码
