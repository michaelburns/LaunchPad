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
            return View(_context.Users.ToList());
        }

        public IActionResult Create()
        {
            return View();
        }

        [HttpPost]
        public IActionResult Create(AdminEditViewModel newUser)
        {
            if (ModelState.IsValid)
            {
                User user = new User
                {
                    Username = newUser.User.Username
                };

                _context.Add(user);
                _context.SaveChanges();
                return RedirectToAction("Index");
            }

            return View(newUser);
        }

        public IActionResult Edit(int? id)
        {
            if (id == null) { return RedirectToAction("Index"); }

            var user = _context.Users.Include(u => u.UserRoles).FirstOrDefault(u => u.Id == id);

            if (user == null)
                return RedirectToAction("Index");

            AdminEditViewModel adminVM = new AdminEditViewModel
            {
                User = user,
                SelectedRoles = from ur in user.UserRoles.ToList()
                                select ur.RoleId
            };

            ViewBag.Roles = new SelectList(_context.Roles.ToList(), "Id", "Name");

            return View(adminVM);
        }

        [HttpPost]
        public IActionResult Edit(AdminEditViewModel editUser)
        {
            if (ModelState.IsValid)
            {
                var user = _context.Users.Include(u => u.UserRoles).FirstOrDefault(u => u.Id == editUser.User.Id);

                if(user != null)
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
                    return RedirectToAction("Index");
                }                
            }

            ViewBag.Roles = new SelectList(_context.Roles.ToList(), "Id", "Name");

            return View(editUser);
        }

        public IActionResult Disable(int id)
        {
            var user = _context.Users.Include(u => u.UserRoles).FirstOrDefault(u => u.Id == id);

            if (user != null)
            {
                _context.UserRoles.RemoveRange(user.UserRoles); // ToDo:  Test this logic on a user with and without roles
            }
            _context.SaveChanges();

            return RedirectToAction("Index");
        }
    }
}
