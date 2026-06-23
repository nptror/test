using System.Security.Claims;

namespace SmartDine.Domain.Interfaces;

public interface IJwtTokenService
{
    string GenerateAccessToken(int id, string email, string fullName, string role);
    string GenerateRefreshToken();
    ClaimsPrincipal? GetPrincipalFromExpiredToken(string token);
}
