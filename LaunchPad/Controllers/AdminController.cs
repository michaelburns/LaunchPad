using System.Linq;
using LaunchPad.Data;
using LaunchPad.Models;
using LaunchPad.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Controllers
{
    [Authorize(Policy = "Administrator")]
    public class AdminController : Controller
    {
        private readonly ApplicationDbContext _context;

        public AdminController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: /Admin — landing with live counts + anomaly signals so the page is opinionated,
        // not just informative. The strip surfaces "what's drifted" so admins notice users
        // who can't log into anything (no roles) and categories that nobody owns scripts in.
        public IActionResult Index()
        {
            ViewBag.UserCount     = _context.Users.Count();
            ViewBag.AdminCount    = _context.Users.Count(u => u.UserRoles.Any(r => r.Role.Name == "Administrator"));
            ViewBag.CategoryCount = _context.Categories.Count();
            ViewBag.ScriptCount   = _context.Scripts.Count();

            ViewBag.UsersWithoutRoles  = _context.Users.Count(u => !u.UserRoles.Any());
            var emptyCategoryIds = _context.Categories
                .Where(c => !_context.Scripts.Any(s => s.Category != null && s.Category.Id == c.Id))
                .Select(c => c.Id)
                .ToList();
            ViewBag.EmptyCategories = emptyCategoryIds.Count;

            return View();
        }

        // ============== Users ===========================================

        public IActionResult UserList()
        {
            return View(_context.Users
                .Include(u => u.UserRoles).ThenInclude(r => r.Role)
                .Include(u => u.Categories).ThenInclude(uc => uc.Category)
                .OrderBy(u => u.Username)
                .ToList());
        }

        public IActionResult UserCreate()
        {
            var adminVM = new AdminViewModel
            {
                AvailableRoles      = new SelectList(_context.Roles.ToList(), "Id", "Name"),
                AvailableCategories = new SelectList(_context.Categories.ToList(), "Id", "Name")
            };
            return View(adminVM);
        }

        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult UserCreate(AdminViewModel newUser)
        {
            if (ModelState.IsValid)
            {
                var user = new User
                {
                    Username = newUser.User.Username,
                    UserRoles = (newUser.SelectedRoles ?? System.Linq.Enumerable.Empty<int>())
                        .Select(rid => new UserRole { RoleId = rid }).ToList(),
                    Categories = (newUser.SelectedCategories ?? System.Linq.Enumerable.Empty<int>())
                        .Select(cid => new UserCategory { CategoryId = cid }).ToList()
                };
                _context.Add(user);
                _context.SaveChanges();
                return RedirectToAction("UserList");
            }

            // Re-bind for re-render so the user's input survives validation failures.
            newUser.AvailableRoles      = new SelectList(_context.Roles.ToList(), "Id", "Name");
            newUser.AvailableCategories = new SelectList(_context.Categories.ToList(), "Id", "Name");
            return View(newUser);
        }

        public IActionResult UserEdit(int? id)
        {
            if (id == null) return RedirectToAction("UserList");

            var user = _context.Users
                .Include(u => u.UserRoles)
                .Include(u => u.Categories)
                .FirstOrDefault(u => u.Id == id);
            if (user == null) return RedirectToAction("UserList");

            var adminVM = new AdminViewModel
            {
                User                = user,
                SelectedRoles       = user.UserRoles.Select(ur => ur.RoleId).ToList(),
                AvailableRoles      = new SelectList(_context.Roles.ToList(), "Id", "Name"),
                SelectedCategories  = user.Categories.Select(uc => uc.CategoryId).ToList(),
                AvailableCategories = new SelectList(_context.Categories.ToList(), "Id", "Name")
            };

            // Surface the same guard logic to the view so the danger-zone buttons can
            // disable themselves with a tooltip explaining why.
            ViewBag.IsSelf = IsSignedInUser(_context.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .First(u => u.Id == id));
            ViewBag.IsLastAdmin = WouldOrphanAdmin(_context.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .First(u => u.Id == id));

            return View(adminVM);
        }

        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult UserEdit(AdminViewModel editUser)
        {
            if (!ModelState.IsValid)
            {
                editUser.AvailableRoles      = new SelectList(_context.Roles.ToList(), "Id", "Name");
                editUser.AvailableCategories = new SelectList(_context.Categories.ToList(), "Id", "Name");
                return View(editUser);
            }

            var user = _context.Users
                .Include(u => u.UserRoles)
                .Include(u => u.Categories)
                .FirstOrDefault(u => u.Id == editUser.User.Id);
            if (user == null) return RedirectToAction("UserList");

            _context.UserRoles.RemoveRange(user.UserRoles);
            _context.UserCategory.RemoveRange(user.Categories);
            _context.SaveChanges();

            user.Username = editUser.User.Username;
            user.UserRoles = (editUser.SelectedRoles ?? System.Linq.Enumerable.Empty<int>())
                .Select(rid => new UserRole { RoleId = rid, UserId = user.Id }).ToList();
            user.Categories = (editUser.SelectedCategories ?? System.Linq.Enumerable.Empty<int>())
                .Select(cid => new UserCategory { CategoryId = cid, UserId = user.Id }).ToList();
            _context.Entry(user).State = EntityState.Modified;
            _context.SaveChanges();
            return RedirectToAction("UserList");
        }

        // POST: /Admin/RevokeAccess/1 — strips all roles. The user account stays so
        // history rows referencing it remain meaningful; they just can't satisfy any
        // policy until an admin grants roles again.
        // Guards: refuses to act on the signed-in admin (no self-lockout) and refuses
        // to revoke the last Administrator on the system (no system-wide lockout).
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult RevokeAccess(int id)
        {
            var user = _context.Users.Include(u => u.UserRoles).ThenInclude(ur => ur.Role).FirstOrDefault(u => u.Id == id);
            if (user == null) return RedirectToAction("UserList");

            if (IsSignedInUser(user))
            {
                TempData["AdminError"] = "You can't revoke your own roles. Ask another administrator to do it.";
                return RedirectToAction("UserEdit", new { id });
            }
            if (WouldOrphanAdmin(user))
            {
                TempData["AdminError"] = $"Can't revoke {user.Username}'s roles — they're the last Administrator on the system. Grant another user the Administrator role first.";
                return RedirectToAction("UserEdit", new { id });
            }

            _context.UserRoles.RemoveRange(user.UserRoles);
            _context.SaveChanges();
            TempData["AdminNotice"] = $"Roles revoked for {user.Username}. They'll need a new grant to access anything.";
            return RedirectToAction("UserEdit", new { id });
        }

        // POST: /Admin/UserDelete/1 — hard delete. Removes role + category grants,
        // then the user row. Job history rows that referenced the user keep their
        // string username (Job.UserName is denormalized) so the audit log stays intact.
        // Guards: refuses to act on the signed-in admin and refuses to delete the
        // last Administrator on the system.
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult UserDelete(int id)
        {
            var user = _context.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .Include(u => u.Categories)
                .FirstOrDefault(u => u.Id == id);
            if (user == null) return RedirectToAction("UserList");

            if (IsSignedInUser(user))
            {
                TempData["AdminError"] = "You can't delete your own user account. Ask another administrator to do it.";
                return RedirectToAction("UserEdit", new { id });
            }
            if (WouldOrphanAdmin(user))
            {
                TempData["AdminError"] = $"Can't delete {user.Username} — they're the last Administrator on the system. Grant another user the Administrator role first.";
                return RedirectToAction("UserEdit", new { id });
            }

            var name = user.Username;
            _context.UserRoles.RemoveRange(user.UserRoles);
            _context.UserCategory.RemoveRange(user.Categories);
            _context.Users.Remove(user);
            _context.SaveChanges();
            TempData["AdminNotice"] = $"User {name} deleted.";
            return RedirectToAction("UserList");
        }

        // True if `user` is the signed-in account. We compare the User row's Username
        // to the auth principal's Identity.Name — same source the rest of the app uses
        // (e.g. JobServices stamps Job.UserName from User.Identity.Name on launch).
        private bool IsSignedInUser(User user)
        {
            var current = User?.Identity?.Name;
            if (string.IsNullOrEmpty(current) || string.IsNullOrEmpty(user?.Username)) return false;
            return string.Equals(current, user.Username, System.StringComparison.OrdinalIgnoreCase);
        }

        // True if removing this user (or stripping their roles) would leave zero
        // Administrators in the system — which would lock everyone out of /Admin.
        private bool WouldOrphanAdmin(User user)
        {
            var isAdmin = user.UserRoles?.Any(ur => ur.Role != null && ur.Role.Name == "Administrator") ?? false;
            if (!isAdmin) return false;
            var otherAdmins = _context.Users
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .Count(u => u.Id != user.Id && u.UserRoles.Any(ur => ur.Role.Name == "Administrator"));
            return otherAdmins == 0;
        }

        // ============== Categories ======================================

        public IActionResult CategoryList()
        {
            var categories = _context.Categories.OrderBy(c => c.Name).ToList();
            ViewBag.ScriptCounts = _context.Scripts
                .Where(s => s.Category != null)
                .GroupBy(s => s.Category.Id)
                .ToDictionary(g => g.Key, g => g.Count());
            return View(categories);
        }

        public IActionResult CategoryCreate() => View();

        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult CategoryCreate(Category category)
        {
            if (!ModelState.IsValid) return View(category);

            _context.Add(category);
            _context.SaveChanges();
            return RedirectToAction("CategoryList");
        }

        public IActionResult CategoryEdit(int? id)
        {
            if (id == null) return RedirectToAction("CategoryList");

            var category = _context.Categories.FirstOrDefault(c => c.Id == id);
            if (category == null) return RedirectToAction("CategoryList");

            return View(new CategoryViewModel { Category = category });
        }

        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult CategoryEdit(CategoryViewModel viewModel)
        {
            if (!ModelState.IsValid) return View(viewModel);

            var category = _context.Categories.FirstOrDefault(c => c.Id == viewModel.Category.Id);
            if (category == null) return RedirectToAction("CategoryList");

            // Latent bug fix: previous version flipped the EF state to Modified without
            // actually copying any field across, so the edit was a no-op.
            category.Name = viewModel.Category.Name;
            _context.Entry(category).State = EntityState.Modified;
            _context.SaveChanges();
            return RedirectToAction("CategoryList");
        }

        // POST: /Admin/CategoryDelete/1 — refuses to delete a category that still owns
        // scripts (would orphan them in the roster); also strips the per-user grants.
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult CategoryDelete(int id)
        {
            var category = _context.Categories.FirstOrDefault(c => c.Id == id);
            if (category == null) return RedirectToAction("CategoryList");

            var scriptsInCategory = _context.Scripts.Count(s => s.Category != null && s.Category.Id == id);
            if (scriptsInCategory > 0)
            {
                TempData["AdminError"] =
                    $"Can't delete '{category.Name}' — {scriptsInCategory} script(s) are in this category. Move or delete them first.";
                return RedirectToAction("CategoryList");
            }

            var grants = _context.UserCategory.Where(uc => uc.CategoryId == id).ToList();
            _context.UserCategory.RemoveRange(grants);
            _context.Categories.Remove(category);
            _context.SaveChanges();
            TempData["AdminNotice"] = $"Category '{category.Name}' deleted.";
            return RedirectToAction("CategoryList");
        }
    }
}
