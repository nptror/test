using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using System;

namespace SmartDine.Tests;

public class CustomWebApplicationFactory<TProgram> : WebApplicationFactory<TProgram> where TProgram : class
{
    static CustomWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable("UseInMemoryDatabase", "true");
        Environment.SetEnvironmentVariable("ConnectionStrings__DefaultConnection", "InMemoryDbForTesting");
        Environment.SetEnvironmentVariable("Jwt__SecretKey", "SuperSecretKeyForTestingSuperSecretKeyForTesting");
        Environment.SetEnvironmentVariable("Jwt__Issuer", "SmartDineTest");
        Environment.SetEnvironmentVariable("Jwt__Audience", "SmartDineTest");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
    }
}
