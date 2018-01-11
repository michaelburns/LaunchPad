using System.Linq;
using LaunchPad.Data;
using LaunchPad.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
        public IActionResult Create(User newUser)
        {
            if (ModelState.IsValid)
            {
                _context.Add(newUser);
                _context.SaveChanges();
                return RedirectToAction("Index");
            }

            return View(newUser);
        }

        public IActionResult Edit(int? id)
        {
            if (id == null) { return RedirectToAction("Index"); }

            var user = _context.Users.FirstOrDefault(u => u.Id == id);

            if (user == null) { return RedirectToAction("Index"); }

            return View(user);
        }

        [HttpPost]
        public IActionResult Edit(User editUser)
        {
            if (ModelState.IsValid)
            {
                _context.Entry(editUser).State = EntityState.Modified;
                _context.SaveChanges();
                return RedirectToAction("Index");
            }

            return View(editUser);
        }

        public IActionResult Disable(int id)
        {
            var user = _context.Users.FirstOrDefault(u => u.Id == id);

            if (user != null) user.Access = UserType.Disabled;
            _context.SaveChanges();

            return RedirectToAction("Index");
        }
    }
}
