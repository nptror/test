using SmartDine.Application.Constants;
using SmartDine.Application.DTOs.Auth;
using SmartDine.Domain.Entities;
using SmartDine.Domain.Exceptions;
using SmartDine.Domain.Interfaces;
using System;
using System.Threading.Tasks;

namespace SmartDine.Application.Services;

/// <summary>
/// Service xử lý authentication cho cả Nhân viên (User) và Khách hàng (Customer).
/// </summary>
public class AuthService 
{
    private readonly IUnitOfWork _uow;
    private readonly IJwtTokenService _jwtService;
    private readonly IPasswordHasher _passwordHasher;

    public AuthService(IUnitOfWork uow, IJwtTokenService jwtService, IPasswordHasher passwordHasher)
    {
        _uow = uow;
        _jwtService = jwtService;
        _passwordHasher = passwordHasher;
    }

    public async Task<TokenResponse> LoginAsync(LoginRequest request)
    {
        // 1. Kiểm tra tài khoản Nhân viên (User) trước
        var user = await _uow.Users.GetByEmailAsync(request.Email);
        if (user == null)
        {
            throw new ResourceNotFoundException(ValidationMessages.NOT_FOUND);
        }
        if (user != null && user.IsActive)
        {
            if (!_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
                throw new BusinessRuleViolationException(ValidationMessages.EMAIL_OR_PASSSWORD_INVALID);

            return GenerateTokenResponse(user.Id, user.Email, user.FullName, user.Role);
        }

        // 2. Nếu không phải nhân viên, kiểm tra tài khoản Khách hàng (Customer)
        var customer = await _uow.Customers.GetByEmailAsync(request.Email);
        if (customer != null)
        {
            if (customer.PasswordHash == null || !_passwordHasher.VerifyPassword(request.Password, customer.PasswordHash))
                throw new BusinessRuleViolationException("Email hoặc mật khẩu không đúng.");

            return GenerateTokenResponse(customer.Id, customer.Email ?? string.Empty, customer.FullName ?? "Customer", "CUSTOMER");
        }

        throw new BusinessRuleViolationException("Email hoặc mật khẩu không đúng.");
    }

    public async Task<TokenResponse> RegisterAsync(RegisterRequest request)
    {
        // Kiểm tra email trùng ở cả 2 bảng
        if (await _uow.Users.ExistsAsync(request.Email) || await _uow.Customers.GetByEmailAsync(request.Email) != null)
            throw new BusinessRuleViolationException("Email đã được sử dụng.");

        if (await _uow.Customers.GetByPhoneAsync(request.PhoneNumber) != null)
            throw new BusinessRuleViolationException("Số điện thoại đã được sử dụng.");

        // Tạo Customer profile mới
        var customer = new Customer
        {
            FullName = request.FullName,
            Email = request.Email,
            Phone = request.PhoneNumber,
            PasswordHash = _passwordHasher.HashPassword(request.Password),
            LoyaltyPoints = 0,
            MembershipLevel = "BRONZE",
            TotalSpent = 0.00m,
            VisitCount = 0
        };

        await _uow.Customers.AddAsync(customer);
        await _uow.SaveChangesAsync();

        return GenerateTokenResponse(customer.Id, customer.Email, customer.FullName, "CUSTOMER");
    }

    public async Task<UserInfoResponse> GetCurrentUserAsync(int id, string role)
    {
        if (role == "CUSTOMER")
        {
            var customer = await _uow.Customers.GetByIdAsync(id);
            if (customer != null)
            {
                return new UserInfoResponse
                {
                    Id = customer.Id,
                    FullName = customer.FullName ?? "Customer",
                    Email = customer.Email ?? string.Empty,
                    Role = "CUSTOMER"
                };
            }
        }
        else
        {
            var user = await _uow.Users.GetByIdAsync(id);
            if (user != null)
            {
                return new UserInfoResponse
                {
                    Id = user.Id,
                    FullName = user.FullName,
                    Email = user.Email,
                    Role = user.Role
                };
            }
        }

        throw new EntityNotFoundException("User/Customer", id);
    }

    private TokenResponse GenerateTokenResponse(int id, string email, string fullName, string role)
    {
        var accessToken = _jwtService.GenerateAccessToken(id, email, fullName, role);
        var refreshToken = _jwtService.GenerateRefreshToken();

        return new TokenResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresIn = 3600, // 60 minutes
            User = new UserInfoResponse
            {
                Id = id,
                FullName = fullName,
                Email = email,
                Role = role
            }
        };
    }
}
