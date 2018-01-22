using System;
using System.Linq;
using System.Threading.Tasks;
using LaunchPad.Data;
using LaunchPad.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Policies
{
    public class LauncherHandler : AuthorizationHandler<LauncherRequirement>
    {
        private readonly ApplicationDbContext _context;

        public LauncherHandler(ApplicationDbContext context)
        {
            _context = context;
        }

        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, LauncherRequirement requirement)
        {
            var user = _context.Users
                .Include(ur => ur.UserRoles)
                .ThenInclude(ur => ur.Role)
                .AsNoTracking()
                .FirstOrDefault(u => String.Equals(u.Username, context.User.Identity.Name, StringComparison.CurrentCultureIgnoreCase));

            if (user == null)
                return Task.CompletedTask;

            var userIsLauncher = user.UserRoles.Any(ur => ur.Role.Name == "Launcher");

            if (userIsLauncher)
            {
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}
