using System;
using System.Linq;
using System.Threading.Tasks;
using LaunchPad.Data;
using LaunchPad.Models;
using Microsoft.AspNetCore.Authorization;

namespace LaunchPad.Policies
{
    public class AuthorHandler : AuthorizationHandler<AuthorRequirement>
    {
        private readonly ApplicationDbContext _context;

        public AuthorHandler(ApplicationDbContext context)
        {
            _context = context;
        }    
        protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, AuthorRequirement requirement)
        {
            var user = _context.Users.FirstOrDefault(u => String.Equals(u.Username, context.User.Identity.Name, StringComparison.CurrentCultureIgnoreCase));

            if (user != null && user.Access >= UserType.Author)
            {
                context.Succeed(requirement);
            }

            return Task.CompletedTask;
        }
    }
}
