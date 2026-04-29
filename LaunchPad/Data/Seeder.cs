using System.Linq;
using LaunchPad.Models;
using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Data
{
    public class Seeder
    {
        private readonly ApplicationDbContext _context;
        private readonly IWebHostEnvironment _hosting;

        public Seeder(ApplicationDbContext context, IWebHostEnvironment hosting)
        {
            _context = context;
            _hosting = hosting;
        }

        public void Seed()
        {
            _context.Database.Migrate();

            if (!_context.Roles.Any())
            {
                _context.Roles.AddRange(
                    new Role { Name = "Administrator" },
                    new Role { Name = "Author" },
                    new Role { Name = "Launcher" });
                _context.SaveChanges();
            }

            if (!_context.Categories.Any())
            {
                _context.Categories.Add(new Category { Name = "General" });
                _context.SaveChanges();
            }

            if (!_context.Users.Any(u => u.Username == "administrator"))
            {
                var admin = new User { Username = "administrator" };
                _context.Users.Add(admin);
                _context.SaveChanges();

                foreach (var role in _context.Roles.ToList())
                {
                    _context.UserRoles.Add(new UserRole { UserId = admin.Id, RoleId = role.Id });
                }
                foreach (var category in _context.Categories.ToList())
                {
                    _context.UserCategory.Add(new UserCategory { UserId = admin.Id, CategoryId = category.Id });
                }
                _context.SaveChanges();
            }
        }
    }
}
