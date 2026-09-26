using System;
using System.Collections.Generic;
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
                .Take(24)
                .ToList();

            var running = _scripts.GetJobs()
                .Include(j => j.Script)
                .Where(j => j.Status == Status.Running || j.Status == Status.Started)
                .OrderByDescending(j => j.Id)
                .FirstOrDefault();

            // Telemetry for the home deck: a 14-day activity series plus per-script
            // run history ("runway lights") and success rates. Projected to the three
            // columns we need so a busy recurring script doesn't drag Outcome blobs along.
            var visibleIds = visibleScripts.Select(s => s.Id).ToHashSet();
            var since14d = DateTime.Today.AddDays(-13);
            var window = _scripts.GetJobs()
                .Where(j => j.Date >= since14d && visibleIds.Contains(j.ScriptId))
                .Select(j => new { j.ScriptId, j.Date, j.Status })
                .ToList();

            var days = Enumerable.Range(0, 14).Select(i => since14d.AddDays(i)).ToList();
            ViewBag.Activity = days.Select(d => new ActivityDay
            {
                Day       = d,
                Completed = window.Count(j => j.Date.Date == d && j.Status == Status.Completed),
                Failed    = window.Count(j => j.Date.Date == d && j.Status == Status.Failed),
                Other     = window.Count(j => j.Date.Date == d && j.Status != Status.Completed && j.Status != Status.Failed)
            }).ToList();

            var history = new Dictionary<int, List<Status>>();
            var rates = new Dictionary<int, (int ok, int total)>();
            foreach (var id in visibleIds)
            {
                history[id] = _scripts.GetJobs()
                    .Where(j => j.ScriptId == id && j.Status != Status.Recurring && j.Status != Status.Scheduled)
                    .OrderByDescending(j => j.Id)
                    .Take(24)
                    .Select(j => j.Status)
                    .ToList();
                var finished = history[id].Where(s => s == Status.Completed || s == Status.Failed).ToList();
                rates[id] = (finished.Count(s => s == Status.Completed), finished.Count);
            }
            ViewBag.RunHistory = history;
            ViewBag.LastRunDates = _scripts.GetJobs()
                .Where(j => visibleIds.Contains(j.ScriptId) && j.Status != Status.Recurring && j.Status != Status.Scheduled)
                .GroupBy(j => j.ScriptId)
                .Select(g => new { g.Key, Last = g.Max(j => j.Date) })
                .ToDictionary(x => x.Key, x => x.Last);
            ViewBag.SuccessRates = rates;

            var since24 = DateTime.Now.AddHours(-24);
            var last24 = window.Where(j => j.Date >= since24).ToList();

            ViewBag.Scripts = visibleScripts;
            ViewBag.RecentJobs = recentJobs;
            ViewBag.RunningJob = running;
            ViewBag.FailedCount24h = last24.Count(j => j.Status == Status.Failed);
            ViewBag.CompletedCount24h = last24.Count(j => j.Status == Status.Completed);
            ViewBag.NextRecurring = _scripts.GetJobs()
                .Include(j => j.Script)
                .Where(j => j.Status == Status.Recurring && visibleIds.Contains(j.ScriptId))
                .OrderByDescending(j => j.Id)
                .FirstOrDefault();

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
                .Take(40)
                .Select(j => new
                {
                    id        = j.Id,
                    scriptId  = j.ScriptId,
                    name      = j.Script != null ? j.Script.Name : "(deleted)",
                    status    = j.Status.ToString(),
                    user      = j.UserName,
                    date      = j.Date
                })
                .ToList();

            var running = recent.FirstOrDefault(j => j.status == "Running" || j.status == "Started");
            var window24 = _scripts.GetJobs()
                .Where(j => j.Date >= since)
                .Where(j => j.Script != null && j.Script.Category != null && categoryIds.Contains(j.Script.Category.Id))
                .Where(j => !j.Script.Name.StartsWith("_"));
            var failed  = window24.Count(j => j.Status == Status.Failed);
            var done    = window24.Count(j => j.Status == Status.Completed);

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

    public class ActivityDay
    {
        public DateTime Day { get; set; }
        public int Completed { get; set; }
        public int Failed { get; set; }
        public int Other { get; set; }
        public int Total => Completed + Failed + Other;
    }
}
