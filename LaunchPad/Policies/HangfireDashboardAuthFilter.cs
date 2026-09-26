using Hangfire.Dashboard;
using LaunchPad.Data;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Policies
{
    // Replaces Hangfire's default LocalRequestsOnlyAuthorizationFilter so the
    // /Scripts/Jobs dashboard ("Audit") is reachable from outside the server.
    // Gated to AD-authenticated users with the Administrator role — Hangfire's UI
    // exposes destructive actions (delete jobs, requeue, etc.).
    public class HangfireDashboardAuthFilter : IDashboardAuthorizationFilter
    {
        public bool Authorize(DashboardContext context)
        {
            var http = context.GetHttpContext();
            var rawName = http.User.Identity?.Name;
            if (string.IsNullOrEmpty(rawName)) return false;

            var bareName = rawName.Contains('\\') ? rawName.Split('\\', 2)[1] : rawName;
            var lowered  = bareName.ToLowerInvariant();

            var db = http.RequestServices.GetService(typeof(ApplicationDbContext)) as ApplicationDbContext;
            if (db == null) return false;

            return db.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .AsNoTracking()
                .Where(u => u.Username.ToLower() == lowered)
                .SelectMany(u => u.UserRoles)
                .Any(ur => ur.Role.Name == "Administrator");
        }
    }
}
