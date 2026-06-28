# Graph Report - test  (2026-06-27)

## Corpus Check
- 165 files · ~60,820 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 838 nodes · 1471 edges · 67 communities (44 shown, 23 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3ea9dfc3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]

## God Nodes (most connected - your core abstractions)
1. `BaseEntity` - 33 edges
2. `main()` - 21 edges
3. `Order` - 20 edges
4. `GenericRepository` - 20 edges
5. `compilerOptions` - 20 edges
6. `MenuItem` - 18 edges
7. `IRepository` - 17 edges
8. `Robot` - 16 edges
9. `SmartDine.Infrastructure` - 11 edges
10. `MenuService` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AuthController` --references--> `AuthService`  [EXTRACTED]
  PRM_SU26/BE/SmartDine.API/Controllers/AuthController.cs → PRM_SU26/BE/SmartDine.Application/Services/AuthService.cs
- `OrdersController` --references--> `OrderService`  [EXTRACTED]
  PRM_SU26/BE/SmartDine.API/Controllers/OrdersController.cs → PRM_SU26/BE/SmartDine.Application/Services/OrderService.cs
- `IntegrationTests` --references--> `Program`  [EXTRACTED]
  PRM_SU26/BE/SmartDine.Tests/IntegrationTests.cs → PRM_SU26/BE/SmartDine.API/Program.cs
- `AuthService` --references--> `IUnitOfWork`  [EXTRACTED]
  PRM_SU26/BE/SmartDine.Application/Services/AuthService.cs → PRM_SU26/BE/SmartDine.Domain/Interfaces/IUnitOfWork.cs
- `MenuService` --references--> `IUnitOfWork`  [EXTRACTED]
  PRM_SU26/BE/SmartDine.Application/Services/MenuService.cs → PRM_SU26/BE/SmartDine.Domain/Interfaces/IUnitOfWork.cs

## Import Cycles
- None detected.

## Communities (67 total, 23 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (28): DiningSessionConfiguration, PaymentConfiguration, TableConfiguration, DateTime, DbSet, DiningSession, MenuItem, Order (+20 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (33): getObjectColor(), getObjectIcon(), MapCanvas(), MapObjectShape(), MapObjectShapeProps, objectPhysicalSizes, toolLabels, InspectorFormProps (+25 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (16): Authorize, ControllerBase, AuthController, MenuItemsController, OrdersController, TablesController, HttpDelete, HttpGet (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (17): LoginRequest, RefreshTokenRequest, RegisterRequest, TokenResponse, UserInfoResponse, ClaimsPrincipal, IConfiguration, IJwtTokenService (+9 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (18): CancellationToken, DbContext, IDisposable, IUnitOfWork, InitialCreate, SmartDine.Infrastructure.Migrations, SmartDine.Infrastructure.Migrations, UpdateDatabaseSchema (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (18): RobotConfiguration, ValidationMessages, getNodeTypeName(), main(), Robot, init_devices(), main(), set_robot_velocity() (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.12
Nodes (37): HeapNode, adjust_goal_for_inflation(), check_path_blocked_by_dynamic(), clear_path_file(), compute_distance_transform(), compute_wheel_speeds(), decay_dynamic_map(), dwa_control() (+29 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (33): AutoMapper.Extensions.Microsoft.DependencyInjection (12.0.1), BCrypt.Net-Next (4.0.3), coverlet.collector (6.0.4), FluentValidation.DependencyInjectionExtensions (12.1.1), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.8), Microsoft.AspNetCore.Mvc.Testing (9.0.2), Microsoft.EntityFrameworkCore.Design (9.0.1), Microsoft.EntityFrameworkCore.Tools (9.0.1) (+25 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (13): ApiResponse, PaginatedResponse, CreateMenuItemRequest, List, MenuItemResponse, OrderDetailRequest, OrderDetailResponse, OrderResponse (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (33): dependencies, antd, axios, lucide-react, react, react-dom, react-redux, react-router-dom (+25 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (23): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+15 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (17): _dio, DioClient, instance, _secureStorage, Dio get, FlutterSecureStorage, package:dio/dio, package:flutter_secure_storage/flutter_secure_storage.dart (+9 more)

### Community 12 - "Community 12"
Cohesion: 0.15
Nodes (7): apiClient, failedQueue, menuService, CreateMenuItemRequest, MenuCategoryResponse, MenuItemResponse, UpdateMenuItemRequest

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (16): author, dependencies, body-parser, cors, express, description, keywords, license (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.17
Nodes (10): authSlice, AuthState, initialState, loginUser, selectAuthError(), selectAuthLoading(), selectCurrentUser(), selectIsAuthenticated() (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.13
Nodes (15): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, applicationUrl, commandName (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (14): GoRouter, build, _buildItem, HomeScreen, main, MenuScreen, MyApp, _router (+6 more)

### Community 17 - "Community 17"
Cohesion: 0.14
Nodes (4): salesData, StaffMember, Transaction, App()

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (8): Fact, IClassFixture, IWebHostBuilder, Program, CustomWebApplicationFactory, IntegrationTests, TProgram, WebApplicationFactory

### Community 19 - "Community 19"
Cohesion: 0.23
Nodes (4): UserConfiguration, User, IUserRepository, UserRepository

### Community 20 - "Community 20"
Cohesion: 0.21
Nodes (6): Migration, MigrationBuilder, InitialCreate, SmartDine.Infrastructure.Migrations, SmartDine.Infrastructure.Migrations, UpdateDatabaseSchema

### Community 21 - "Community 21"
Cohesion: 0.29
Nodes (4): CustomerConfiguration, Customer, ICustomerRepository, CustomerRepository

### Community 22 - "Community 22"
Cohesion: 0.20
Nodes (6): Exception, BusinessRuleViolationException, DomainException, EntityNotFoundException, ResourceNotFoundException, SmartDine.Domain.Exceptions

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (9): 1. Cấu hình Cơ sở dữ liệu (Database Setup), 2. Khởi chạy Backend (ASP.NET Core Web API), 3. Khởi chạy Web Dashboard (FE Admin/Staff), 4. Khởi chạy Mobile App (FE Customer App), Cấu trúc Dự án (Project Structure), Hướng dẫn Cài đặt & Khởi chạy (Quick Start Guide), SmartDine - Hệ thống Quản lý và Đặt món thông minh, Thông tin Bảo mật & Môi trường (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.39
Nodes (5): TableManagementPage(), useSocket(), tableService, Table, TableStatus

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (3): IHubContext, IOrderNotificationService, OrderNotificationService

### Community 26 - "Community 26"
Cohesion: 0.29
Nodes (4): CustomerActivityConfiguration, BaseEntity, CustomerActivity, Table

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (7): compilerOptions, allowSyntheticDefaultImports, composite, module, moduleResolution, skipLibCheck, include

### Community 28 - "Community 28"
Cohesion: 0.38
Nodes (4): MenuCategoryConfiguration, MenuItemConfiguration, MenuCategory, IEntityTypeConfiguration

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (3): BusinessContextLogConfiguration, ReviewConfiguration, BusinessContextLog

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (5): app, cors, express, fs, path

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (4): HttpContext, ILogger, ExceptionHandlingMiddleware, RequestDelegate

### Community 33 - "Community 33"
Cohesion: 0.40
Nodes (4): CreateMenuItemRequest, MenuCategoryResponse, MenuItemResponse, UpdateMenuItemRequest

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (3): AppDispatch, RootState, store

## Knowledge Gaps
- **173 isolated node(s):** `$schema`, `commandName`, `dotnetRunMessages`, `launchBrowser`, `applicationUrl` (+168 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `BaseEntity` connect `Community 26` to `Community 0`, `Community 5`, `Community 19`, `Community 21`, `Community 28`, `Community 29`, `Community 35`, `Community 36`, `Community 37`, `Community 38`, `Community 39`, `Community 40`, `Community 41`, `Community 42`, `Community 43`, `Community 44`, `Community 45`, `Community 46`, `Community 47`, `Community 48`, `Community 49`, `Community 50`, `Community 51`, `Community 52`, `Community 53`, `Community 54`?**
  _High betweenness centrality (0.151) - this node is a cross-community bridge._
- **Why does `Robot` connect `Community 5` to `Community 26`, `Community 6`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `MenuItem` connect `Community 0` to `Community 32`, `Community 8`, `Community 26`, `Community 28`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **What connects `$schema`, `commandName`, `dotnetRunMessages` to the rest of the system?**
  _173 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0500990099009901 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.10204081632653061 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.10083256244218317 - nodes in this community are weakly interconnected._