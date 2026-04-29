using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace LaunchPad.Auth
{
    // Development-only fallback: when Negotiate produces no authenticated principal
    // (e.g. running on macOS without an AD-joined machine), sign the request in as
    // the seeded "administrator" account so the role-based pages are reachable for
    // local dogfooding. Wired up only in IsDevelopment in Program.cs.
    //
    // Implemented as middleware (not IClaimsTransformation) because
    // IClaimsTransformation is skipped entirely when authentication fails, which
    // is exactly the case on a machine without AD.
    public class DevAutoSignInMiddleware
    {
        public const string DevAdminUsername = "administrator";

        private readonly RequestDelegate _next;

        public DevAutoSignInMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public Task InvokeAsync(HttpContext context)
        {
            if (context.User?.Identity?.IsAuthenticated != true)
            {
                var identity = new ClaimsIdentity(
                    new[] { new Claim(ClaimTypes.Name, DevAdminUsername) },
                    authenticationType: "DevAutoSignIn");
                context.User = new ClaimsPrincipal(identity);
            }
            return _next(context);
        }
    }
}
