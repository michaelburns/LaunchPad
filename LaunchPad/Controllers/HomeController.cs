using System;
using System.Linq;
using LaunchPad.Data;
using LaunchPad.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Controllers
{
    public class HomeController : BaseController
    {
        private readonly IScriptRepository _scripts;

        public HomeController(IScriptRepository scripts, ApplicationDbContext context) : base(context)
        {
            _scripts = scripts;
        }

        public IActionResult Index()
        {
            var categoryIds = GetUserCategoryIds().ToHashSet();
            var visibleScripts = _scripts.GetScripts()
                .Include(s => s.Category)
                .Where(s => s.Category != null && categoryIds.Contains(s.Category.Id))
                .OrderBy(s => s.Name)
                .ToList();

            var since = DateTime.Now.AddHours(-24);
            var recentJobs = _scripts.GetJobs()
                .Include(j => j.Script)
                .Where(j => j.Date >= since)
                .OrderByDescending(j => j.Id)
                .Take(8)
                .ToList();

            var running = _scripts.GetJobs()
                .Include(j => j.Script)
                .Where(j => j.Status == Status.Running || j.Status == Status.Started)
                .OrderByDescending(j => j.Id)
                .FirstOrDefault();

            ViewBag.Scripts = visibleScripts;
            ViewBag.RecentJobs = recentJobs;
            ViewBag.RunningJob = running;
            ViewBag.FailedCount24h = recentJobs.Count(j => j.Status == Status.Failed);
            ViewBag.CompletedCount24h = recentJobs.Count(j => j.Status == Status.Completed);

            return View();
        }

        public IActionResult Error()
        {
            return View();
        }

        // Lightweight state poll for the home view. Returns the running job, the last 8
        // jobs in 24h, and the failed/completed counts so the page can update without reload.
        public IActionResult Heartbeat()
        {
            var since = DateTime.Now.AddHours(-24);
            var categoryIds = GetUserCategoryIds().ToHashSet();

            var recent = _scripts.GetJobs()
                .Include(j => j.Script).ThenInclude(s => s.Category)
                .Where(j => j.Date >= since)
                .Where(j => j.Script != null && j.Script.Category != null && categoryIds.Contains(j.Script.Category.Id))
                .OrderByDescending(j => j.Id)
                .Take(8)
                .Select(j => new
                {
                    id        = j.Id,
                    scriptId  = j.ScriptId,
                    name      = j.Script != null ? j.Script.Name : "(deleted)",
                    status    = j.Status.ToString(),
                    date      = j.Date
                })
                .ToList();

            var running = recent.FirstOrDefault(j => j.status == "Running" || j.status == "Started");
            var failed  = recent.Count(j => j.status == "Failed");
            var done    = recent.Count(j => j.status == "Completed");

            return Json(new
            {
                running,
                recent,
                failed24h    = failed,
                completed24h = done,
                serverTime   = DateTime.Now
            });
        }
    }
}
