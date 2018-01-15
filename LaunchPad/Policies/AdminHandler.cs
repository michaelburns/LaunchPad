using System;
using System.Linq;
using System.Threading.Tasks;
using LaunchPad.Data;
using LaunchPad.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Policies
{
    public class AdminHandler : AuthorizationHandler<AdminRequirement>
    {
        private readonly ApplicationDbContext _context;

        public AdminHandler(ApplicationDbContext context)
        {
            _context = context;
        }    
        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, AdminRequirement requirement)
        {
            var user = _context.Users.AsNoTracking().FirstOrDefault(u => String.Equals(u.Username, context.User.Identity.Name, StringComparison.CurrentCultureIgnoreCase));

            if (user != null && user.Access == UserType.Administrator)
            {
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}
