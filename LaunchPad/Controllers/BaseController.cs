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
            var user = _context.Users
                                .Include(ur => ur.UserRoles)
                                .ThenInclude(ur => ur.Role)
                                .Include(ur => ur.Categories)
                                .ThenInclude(ur => ur.Category)
                                .AsNoTracking()
                                .FirstOrDefault(u => String.Equals(u.Username, User.Identity.Name, StringComparison.CurrentCultureIgnoreCase));
            return user.Categories.Select(x => x.CategoryId);
        }

        protected bool UserHasAccessToCategory(int categoryId)
        {
            return GetUserCategoryIds().Contains(categoryId);
        }
    }
}
