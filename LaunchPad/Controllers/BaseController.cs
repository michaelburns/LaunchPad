using LaunchPad.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.Controllers
{
    public class BaseController : Controller
    {
        private readonly ApplicationDbContext _context;

        public BaseController(ApplicationDbContext context)
        {
            this._context = context;
        }

        protected IEnumerable<int> GetUserCategoryIds()
        {
            var rawName = User.Identity?.Name;
            if (string.IsNullOrEmpty(rawName))
                return Enumerable.Empty<int>();

            var bareName = rawName.Contains('\\') ? rawName.Split('\\', 2)[1] : rawName;
            var lowered = bareName.ToLowerInvariant();

            var user = _context.Users
                                .Include(ur => ur.UserRoles)
                                .ThenInclude(ur => ur.Role)
                                .Include(ur => ur.Categories)
                                .ThenInclude(ur => ur.Category)
                                .AsNoTracking()
                                .FirstOrDefault(u => u.Username.ToLower() == lowered);
            return user?.Categories.Select(x => x.CategoryId) ?? Enumerable.Empty<int>();
        }

        protected bool UserHasAccessToCategory(int categoryId)
        {
            return GetUserCategoryIds().Contains(categoryId);
        }
    }
}
