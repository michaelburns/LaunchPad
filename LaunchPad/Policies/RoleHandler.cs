using System;
using System.Linq;
using System.Threading.Tasks;
using LaunchPad.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Policies
{
    //Todo: The only change in the authorization handlers is the role name, let's see if we can refactor to one and pass the required role name in Startup.cs
    public class RoleHandler : AuthorizationHandler<RoleRequirement>
    {
        private readonly ApplicationDbContext _context;

        public RoleHandler(ApplicationDbContext context)
        {
            _context = context;
        }
        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, RoleRequirement requirement)
        {
            var rawName = context.User.Identity?.Name;
            if (string.IsNullOrEmpty(rawName))
                return Task.CompletedTask;

            // Negotiate yields names like DOMAIN\user; match against the bare username.
            var bareName = rawName.Contains('\\') ? rawName.Split('\\', 2)[1] : rawName;
            var lowered = bareName.ToLowerInvariant();

            var user = _context.Users
                .Include(ur => ur.UserRoles)
                .ThenInclude(ur => ur.Role)
                .AsNoTracking()
                .FirstOrDefault(u => u.Username.ToLower() == lowered);

            if (user == null)
                return Task.CompletedTask;

            var userIsAdmin = user.UserRoles.Any(ur => ur.Role.Name == requirement.Role);
            
            if (userIsAdmin)
            {
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}
