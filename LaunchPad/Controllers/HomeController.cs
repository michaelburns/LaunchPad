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
                .Where(s => !s.Name.StartsWith("_"))   // hide sentinel/system scripts (e.g. _adhoc)
                .OrderBy(s => s.Name)
                .ToList();

            var since = DateTime.Now.AddHours(-24);
            var recentJobs = _scripts.GetJobs()
                .Include(j => j.Script)
                .Where(j => j.Date >= since)
                .Where(j => j.Script != null && !j.Script.Name.StartsWith("_"))
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

        // GET /Home/PaletteData — backs the universal command palette (⌘K). Returns
        // the categorized payload the palette renders in its no-query state plus
        // the scripts list the search box filters across. Filtered to the caller's
        // category grants. Sentinel scripts (name starts with "_") are excluded.
        public IActionResult PaletteData()
        {
            var categoryIds = GetUserCategoryIds().ToHashSet();
            var visibleScripts = _scripts.GetScripts()
                .Include(s => s.Category)
                .Where(s => s.Category != null && categoryIds.Contains(s.Category.Id))
                .Where(s => !s.Name.StartsWith("_"))
                .OrderBy(s => s.Name)
                .Select(s => new { id = s.Id, name = s.Name, category = s.Category.Name })
                .ToList();

            // Recents: most-launched in the last 7 days for visible scripts. Falls back
            // to all-time top-5 if the 7-day window has no data — avoids an empty
            // RECENT section for fresh installs.
            var since7d = DateTime.Now.AddDays(-7);
            var recentByScript = _scripts.GetJobs()
                .Include(j => j.Script).ThenInclude(s => s.Category)
                .Where(j => j.Script != null
                            && j.Script.Category != null
                            && categoryIds.Contains(j.Script.Category.Id)
                            && !j.Script.Name.StartsWith("_")
                            && j.Date >= since7d)
                .GroupBy(j => new { j.ScriptId, j.Script.Name })
                .Select(g => new
                {
                    id       = g.Key.ScriptId,
                    name     = g.Key.Name,
                    count    = g.Count(),
                    lastRun  = g.Max(j => j.Date)
                })
                .OrderByDescending(x => x.count)
                .ThenByDescending(x => x.lastRun)
                .Take(7)
                .ToList();

            if (recentByScript.Count == 0)
            {
                recentByScript = _scripts.GetJobs()
                    .Include(j => j.Script).ThenInclude(s => s.Category)
                    .Where(j => j.Script != null
                                && j.Script.Category != null
                                && categoryIds.Contains(j.Script.Category.Id)
                                && !j.Script.Name.StartsWith("_"))
                    .GroupBy(j => new { j.ScriptId, j.Script.Name })
                    .Select(g => new
                    {
                        id       = g.Key.ScriptId,
                        name     = g.Key.Name,
                        count    = g.Count(),
                        lastRun  = g.Max(j => j.Date)
                    })
                    .OrderByDescending(x => x.count)
                    .ThenByDescending(x => x.lastRun)
                    .Take(5)
                    .ToList();
            }

            return Json(new
            {
                recents = recentByScript,
                scripts = visibleScripts
            });
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
                .Where(j => !j.Script.Name.StartsWith("_")) // hide ad-hoc + sentinel scripts from rail
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
