using LaunchPad.Models;
using Microsoft.AspNetCore.Hosting;
using System.Linq;

namespace LaunchPad.Data
{
    public class Seeder
    {
        private readonly ApplicationDbContext _context;
        private readonly IHostingEnvironment _hosting;

        public Seeder(ApplicationDbContext context, IHostingEnvironment hosting)
        {
            _context = context;
            _hosting = hosting;
        }

        public void Seed()
        {
            _context.Database.EnsureCreated();

            // Create Default Roles
            if (!_context.Roles.Any())
            {
                _context.Roles.AddRange(
                    new Role { Name = "Administrator" },
                    new Role { Name = "Author" },
                    new Role { Name = "Launcher" });
            }

            // Create First User
            if (!_context.Users.Any())
            {
                _context.Users.Add(new User
                {
                    Username = "administrator", // Todo: Get current user fron http context
                    // Todo: Set initial UserRoles
                });
            }

            _context.SaveChanges();
;        }
    }
}
