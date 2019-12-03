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

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult UserList()
        {
            return View(_context.Users.Include(ur => ur.UserRoles).ThenInclude(r => r.Role).ToList());
        }

        public IActionResult UserCreate()
        {
            var adminVM = new AdminViewModel
            {
                AvailableRoles = new SelectList(_context.Roles.ToList(), "Id", "Name")
            };

            return View(adminVM);
        }

        [HttpPost]
        public IActionResult UserCreate(AdminViewModel newUser)
        {
            if (ModelState.IsValid)
            {
                User user = new User
                {
                    Username = newUser.User.Username,
                    UserRoles = (from ur in newUser.SelectedRoles
                                 select new UserRole
                                 {
                                     RoleId = ur,
                                     UserId = newUser.User.Id
                                 }).ToList()
                };

                _context.Add(user);
                _context.SaveChanges();
                return RedirectToAction("UserList");
            }

            return View(newUser);
        }

        public IActionResult UserEdit(int? id)
        {
            if (id == null) { return RedirectToAction("UserList"); }

            var user = _context.Users.Include(u => u.UserRoles).FirstOrDefault(u => u.Id == id);

            if (user == null)
                return RedirectToAction("UserList");

            AdminViewModel adminVM = new AdminViewModel
            {
                User = user,
                SelectedRoles = from ur in user.UserRoles.ToList()
                                select ur.RoleId,
                AvailableRoles = new SelectList(_context.Roles.ToList(), "Id", "Name")
            };

            return View(adminVM);
        }

        [HttpPost]
        public IActionResult UserEdit(AdminViewModel editUser)
        {
            if (ModelState.IsValid)
            {
                var user = _context.Users.Include(u => u.UserRoles).FirstOrDefault(u => u.Id == editUser.User.Id);

                if (user != null)
                {

                    // Clear user roles
                    _context.UserRoles.RemoveRange(user.UserRoles);
                    _context.SaveChanges();

                    if (editUser.SelectedRoles != null)
                    {
                        user.UserRoles = (from ur in editUser.SelectedRoles
                                          select new UserRole
                                          {
                                              RoleId = ur,
                                              UserId = editUser.User.Id
                                          }).ToList();
                    }

                    user.Username = editUser.User.Username;
                    _context.Entry(user).State = EntityState.Modified;
                    _context.SaveChanges();
                    return RedirectToAction("UserList");
                }
            }

            return View(editUser);
        }

        public IActionResult UserDisable(int id)
        {
            var user = _context.Users.Include(u => u.UserRoles).FirstOrDefault(u => u.Id == id);

            if (user != null)
            {
                _context.UserRoles.RemoveRange(user.UserRoles); // ToDo:  Test this logic on a user with and without roles
            }
            _context.SaveChanges();

            return RedirectToAction("UserIndex");
        }

        public IActionResult CategoryList()
        {
            return View(_context.Categories.ToList());
        }

        public IActionResult CategoryCreate()
        {
            return View();
        }

        [HttpPost]
        public IActionResult CategoryCreate(Category category)
        {
            if (!ModelState.IsValid)
                return View(category);

            _context.Add(category);
            _context.SaveChanges();
            return RedirectToAction("CategoryList");
        }

        public IActionResult CategoryEdit(int? id)
        {
            if (id == null) { return RedirectToAction("CategoryIndex"); }

            var category = _context.Categories.Include(x => x.CategoryRoles).FirstOrDefault(c => c.Id == id);

            if (category == null)
                return RedirectToAction("CategoryIndex");

            var viewModel = new CategoryViewModel()
            {
                Category = category,
                SelectedRoles = from ur in category.CategoryRoles.ToList()
                                select ur.RoleId,
                AvailableRoles = new SelectList(_context.Roles.ToList(), "Id", "Name")
            };

            return View(viewModel);
        }

        [HttpPost]
        public IActionResult CategoryEdit(CategoryViewModel category)
        {
            if (ModelState.IsValid)
            {
                /*
                 TODO: 
                 
                var user = _context.Users.Include(u => u.UserRoles).FirstOrDefault(u => u.Id == editUser.User.Id);

                if (user != null)
                {

                    // Clear user roles
                    _context.UserRoles.RemoveRange(user.UserRoles);
                    _context.SaveChanges();

                    if (editUser.SelectedRoles != null)
                    {
                        user.UserRoles = (from ur in editUser.SelectedRoles
                                          select new UserRole
                                          {
                                              RoleId = ur,
                                              UserId = editUser.User.Id
                                          }).ToList();
                    }
                */
                _context.Entry(category.Category).State = EntityState.Modified;
                _context.SaveChanges();
                return RedirectToAction("CategoryList");
            }

            return View(category);
        }

    }
}
