using AutoMapper;
using Hangfire;
using LaunchPad.Data;
using LaunchPad.Models;
using LaunchPad.Services;
using LaunchPad.ViewModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;

namespace LaunchPad.Controllers
{
    [Authorize]
    public class PowerShellController : BaseController
    {
        private IScriptRepository _scriptRepository;
        private IScriptIO _scriptIO;
        private IMapper _mapper;

        public PowerShellController(IScriptRepository scriptRepository, IScriptIO scriptIO, IMapper mapper, ApplicationDbContext context) : base(context)
        {
            _scriptRepository = scriptRepository;
            _scriptIO = scriptIO;
            _mapper = mapper;
        }

        // GET: /PowerShell — the script roster is now rendered by HomeController.Index.
        public IActionResult Index() => RedirectToAction("Index", "Home");

        // GET: /PowerShell/Create
        [HttpGet]
        [Authorize(Policy = "Author")]
        public IActionResult Create()
        {
            ViewBag.Categories = new SelectList(_scriptRepository.GetCategories().ToList(), "Id", "Name");
            return View(new PowerShellViewModel { Script = ScriptScaffold });
        }

        // Starter template surfaced in the editor on Create. Comments above blank lines
        // so first-time authors see the shape (param block, output) without ceremony.
        private const string ScriptScaffold =
            "# Runs on this LaunchPad host. Output is captured live via Out-String.\n" +
            "# Uncomment and edit the param block to expose inputs in the launch UI.\n" +
            "\n" +
            "# param(\n" +
            "#     [string]$Name = \"world\"\n" +
            "# )\n" +
            "\n" +
            "Write-Output \"Hello from $($PSVersionTable.OS)\"\n";

        // POST: /PowerShell/Create
        [HttpPost, ValidateAntiForgeryToken]
        [Authorize(Policy = "Author")]
        public IActionResult Create(PowerShellViewModel newScript)
        {
            if (_scriptIO.ScriptExists(newScript.Name))
            {
                ModelState.AddModelError("Name", "A script with this name already exists. Pick a different name.");
                ViewBag.Categories = new SelectList(_scriptRepository.GetCategories().ToList(), "Id", "Name", newScript.Category?.Id);
                return View(newScript);
            }

            var script = _mapper.Map<PowerShellViewModel, Script>(newScript);
            script.Author = User.Identity.Name;

            if (TryValidateModel(script))
            {
                script.Category = _scriptRepository.GetCategories().FirstOrDefault(c => c.Id == newScript.Category.Id);

                if (_scriptIO.Write(newScript.Name, newScript.Script))
                {
                    _scriptRepository.InsertScript(script);
                    _scriptRepository.Save();
                    return RedirectToAction("Details", new { id = script.Id });
                }
            }
            ViewBag.Categories = new SelectList(_scriptRepository.GetCategories().ToList(), "Id", "Name", newScript.Category?.Id);
            return View(newScript);
        }

        // GET: PowerShell/Edit/5
        [Authorize(Policy = "Author")]
        public ActionResult Edit(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) { return RedirectToAction("Index"); }
            if (!UserHasAccessToCategory(script.Category.Id)) { return RedirectToAction("Index"); }

            var scriptView = _mapper.Map<Script, PowerShellViewModel>(script);
            scriptView.Script = _scriptIO.Read(script.Name);

            ViewBag.Categories = new SelectList(_scriptRepository.GetCategories().ToList(), "Id", "Name");

            return View(scriptView);
        }

        // POST: PowerShell/Edit/5
        [HttpPost] //TODO: //Need to turn off ValidateInput
        [ValidateAntiForgeryToken]
        [Authorize(Policy = "Author")]
        public ActionResult Edit(PowerShellViewModel vmScript)
        {
            var script = _scriptRepository.GetScriptById(vmScript.Id);

            if (TryValidateModel(script))
            {
                // Set the category
                script.Category = _scriptRepository.GetCategories().FirstOrDefault(c => c.Id == vmScript.Category.Id);

                //Write File and Save Metadata
                if (_scriptIO.Write(vmScript.Name, vmScript.Script))
                {
                    _scriptRepository.UpdateScript(script);
                    _scriptRepository.Save();
                    return RedirectToAction("Details", new { id = script.Id });
                }
            }
            ViewBag.Categories = new SelectList(_scriptRepository.GetCategories().ToList(), "Id", "Name", vmScript.Category?.Id);
            return View(vmScript);
        }


        // GET: /PowerShell/Details/1
        public IActionResult Details(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) { return RedirectToAction("Index"); }
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) { return RedirectToAction("Index"); }

            var scriptView = _mapper.Map<Script, PowerShellViewModel>(script);
            scriptView.Script = _scriptIO.Read(script.Name);

            var jobs = _scriptRepository.GetJobs()
                .Where(j => j.ScriptId == id)
                .OrderByDescending(j => j.Id)
                .ToList();

            var running = jobs.FirstOrDefault(j => j.Status == Status.Running || j.Status == Status.Started);
            var recent = jobs
                .Where(j => j.JobType != JobType.ScheduledWithRecurring && j.JobType != JobType.Recurring)
                .Take(10)
                .ToList();
            var recurring = jobs
                .Where(j => j.JobType == JobType.Recurring && j.Status != Status.Cancelled)
                .ToList();

            ViewBag.ScriptParams    = _scriptIO.ScriptParams(script.Name);
            ViewBag.RunningJob      = running;
            ViewBag.RecentJobs      = recent;
            ViewBag.RecurringJobs   = recurring;
            ViewBag.RecurringOptions = JobServices.RecurringOptions();

            return View(scriptView);
        }

        // GET: /PowerShell/Pulse/1 — JSON poll for the Details page (running job, recent, recurring).
        public IActionResult Pulse(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) return NotFound();
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) return Forbid();

            var jobs = _scriptRepository.GetJobs()
                .Where(j => j.ScriptId == id)
                .OrderByDescending(j => j.Id)
                .ToList();

            var running = jobs.FirstOrDefault(j => j.Status == Status.Running || j.Status == Status.Started);
            var recent = jobs
                .Where(j => j.JobType != JobType.ScheduledWithRecurring && j.JobType != JobType.Recurring)
                .Take(10)
                .Select(j => new
                {
                    id       = j.Id,
                    status   = j.Status.ToString(),
                    started  = j.Date,
                    userName = j.UserName,
                    outcome  = j.Outcome
                })
                .ToList();
            var recurringJobs = jobs
                .Where(j => j.JobType == JobType.Recurring && j.Status != Status.Cancelled)
                .Select(j => new
                {
                    id        = j.Id,
                    started   = j.Date,
                    userName  = j.UserName,
                    cadence   = j.Outcome
                })
                .ToList();

            System.Collections.Generic.Dictionary<string, string> runningArgs = null;
            if (running != null && !string.IsNullOrEmpty(running.Args))
            {
                try { runningArgs = System.Text.Json.JsonSerializer.Deserialize<System.Collections.Generic.Dictionary<string, string>>(running.Args); }
                catch { runningArgs = null; }
            }

            return Json(new
            {
                running = running == null ? null : new
                {
                    jobId    = running.Id,
                    status   = running.Status.ToString(),
                    started  = running.Date,
                    userName = running.UserName,
                    outcome  = running.Outcome ?? string.Empty,
                    args     = runningArgs
                },
                recent,
                recurring  = recurringJobs,
                serverTime = DateTime.Now
            });
        }

        // POST: /PowerShell/CancelRunningJob/1 — soft-cancel an in-flight script run. The
        // running job's status flips to Cancelled, the streaming worker polls its own
        // status and stops the runspace. Hangfire's BackgroundJob.Delete is also called
        // so a stuck pipeline gets removed from the queue.
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult CancelRunningJob(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) return RedirectToAction("Index", "Home");
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) return RedirectToAction("Index", "Home");

            var running = _scriptRepository.GetJobs()
                .Where(j => j.ScriptId == id && (j.Status == Status.Running || j.Status == Status.Started))
                .OrderByDescending(j => j.Id)
                .FirstOrDefault();

            if (running != null)
            {
                BackgroundJob.Delete(running.JobId.ToString());
                running.Status = Status.Cancelled;
                _scriptRepository.UpdateJob(running);
                _scriptRepository.Save();
            }

            return RedirectToAction("Details", new { id });
        }

        // POST: /PowerShell/Retry/{jobId} — re-launch the script that produced this job,
        // replaying any saved Args so the operator doesn't have to retype params.
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult Retry(int id)
        {
            var src = _scriptRepository.GetJobById(id);
            if (src == null) return RedirectToAction("Index", "Home");
            var script = _scriptRepository.GetScriptById(src.ScriptId);
            if (script == null) return RedirectToAction("Index", "Home");
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) return RedirectToAction("Index", "Home");

            var jobServices = new JobServices(_scriptRepository, _scriptIO);
            if (!string.IsNullOrEmpty(src.Args))
            {
                try
                {
                    var psParams = System.Text.Json.JsonSerializer
                        .Deserialize<System.Collections.Generic.Dictionary<string, string>>(src.Args);
                    if (psParams != null && psParams.Count > 0)
                    {
                        jobServices.LaunchScriptWithParams(User.Identity.Name,
                            new PowerShellParam { Id = script.Id, PSparams = psParams });
                        return RedirectToAction("Details", new { id = script.Id });
                    }
                }
                catch { /* fall through to no-params launch */ }
            }
            jobServices.LaunchScript(User.Identity.Name, script);
            return RedirectToAction("Details", new { id = script.Id });
        }

        // POST: /PowerShell/AdHoc — admin-only one-off PowerShell from the command palette.
        // Creates a Job row pointing at the sentinel _adhoc Script (lazily created on
        // first call), enqueues a Hangfire job that calls JobServices.RunAdHoc, and
        // returns the dbJobId so the palette can poll JobPulse for streaming output.
        [HttpPost, ValidateAntiForgeryToken]
        [Authorize(Policy = "Administrator")]
        public IActionResult AdHoc([FromForm] string snippet)
        {
            if (string.IsNullOrWhiteSpace(snippet))
                return BadRequest(new { error = "snippet is empty" });

            var sentinel = _scriptRepository.GetScripts().FirstOrDefault(s => s.Name == "_adhoc");
            if (sentinel == null)
            {
                var anyCategory = _scriptRepository.GetCategories().FirstOrDefault();
                if (anyCategory == null)
                    return BadRequest(new { error = "no categories defined; create one first" });
                sentinel = new Script { Name = "_adhoc", Author = "system", Category = anyCategory };
                _scriptRepository.InsertScript(sentinel);
                _scriptRepository.Save();
            }

            var job = new Job
            {
                UserName = User.Identity?.Name ?? "unknown",
                ScriptId = sentinel.Id,
                Date     = DateTime.Now,
                Status   = Status.Started,
                JobType  = JobType.Launched
            };
            _scriptRepository.InsertJob(job);
            _scriptRepository.Save();

            var hangfireId = BackgroundJob.Enqueue<IJobServices>(x => x.RunAdHoc(job.Id, snippet));
            job.JobId = int.Parse(hangfireId);
            _scriptRepository.UpdateJob(job);
            _scriptRepository.Save();

            return Json(new { jobId = job.Id });
        }

        // GET: /PowerShell/JobPulse/{id} — single-job poll used by the palette drawer.
        // Different from /PowerShell/Pulse/{scriptId} which returns a script's most-
        // recent state; ad-hoc runs share a sentinel script so we need per-job polling.
        public IActionResult JobPulse(int id)
        {
            var job = _scriptRepository.GetJobs()
                .Include(j => j.Script)
                .FirstOrDefault(j => j.Id == id);
            if (job == null) return NotFound();

            return Json(new
            {
                id       = job.Id,
                status   = job.Status.ToString(),
                started  = job.Date,
                userName = job.UserName,
                outcome  = job.Outcome ?? string.Empty
            });
        }

        // POST: /PowerShell/PreviewParams — debounced live parse for the author editor.
        // Returns the param block as the launch UI would surface it, plus any AST parse
        // errors. Used by ps-editor.src.js on Edit and Create.
        [HttpPost]
        [Authorize(Policy = "Author")]
        [ValidateAntiForgeryToken]
        public IActionResult PreviewParams([FromForm] string body)
        {
            if (string.IsNullOrEmpty(body))
            {
                return Json(new
                {
                    parameters = System.Array.Empty<object>(),
                    errors     = System.Array.Empty<object>()
                });
            }

            var ast = System.Management.Automation.Language.Parser
                .ParseInput(body, out var tokens, out var parseErrors);

            var parameters = ast?.ParamBlock?.Parameters
                .Select(p => new
                {
                    key  = p.Name?.VariablePath?.UserPath ?? p.Name?.ToString() ?? string.Empty,
                    type = p.StaticType?.Name ?? "Object"
                })
                .ToArray() ?? System.Array.Empty<object>();

            var errors = parseErrors?
                .Take(5)
                .Select(e => new
                {
                    line    = e.Extent?.StartLineNumber ?? 0,
                    message = e.Message
                })
                .ToArray() ?? System.Array.Empty<object>();

            return Json(new { parameters, errors });
        }

        // GET: PowerShell/JobHistory/1
        public IActionResult JobHistory(int? id, int history = 6)
        {
            if (id == null) { return PartialView(); }

            var jobs = _scriptRepository.GetJobs()
                        .OrderByDescending(e => e.Id)
                        .Where(e => e.ScriptId == id && e.JobType != JobType.ScheduledWithRecurring && e.JobType != JobType.Recurring)
                        .Take(history);

            return PartialView(jobs);
        }

        // GET: PowerShell/JobDetails/1
        public IActionResult JobDetails(int id)
        {
            var job = _scriptRepository.GetJobById(id);

            return PartialView(job);
        }

        // POST: PowerShell/Run/1 — execution must be deliberate; GET is rejected so a stray
        // browser back/refresh or copy-pasted URL can never start a script.
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult Run(int id)
        {
            var jobServices = new JobServices(_scriptRepository, _scriptIO); // TODO: This can't be right.
            var script = _scriptRepository.GetScriptById(id);
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) { return RedirectToAction("Index"); }
            jobServices.LaunchScript(User.Identity.Name, script);
            return RedirectToAction("Details", new { id });
        }

        // GET: PowerShell/RunWithParams/1
        public IActionResult RunWithParams(int id)
        {
            var script = _scriptRepository.GetScriptById(id);

            if (script == null) return NotFound();
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) { return RedirectToAction("Index"); }

            var scriptParams = _scriptIO.ScriptParams(script.Name);

            if (scriptParams == null) return NotFound();

            var psParams = new PowerShellParam()
            {
                Id = id,
                PSparams = scriptParams
            };

            return PartialView(psParams);
        }


        // Post: PowerShell/RunWithParams/
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult RunWithParams(PowerShellParam psParam)
        {
            var jobServices = new JobServices(_scriptRepository, _scriptIO);
            jobServices.LaunchScriptWithParams(User.Identity.Name, psParam);
            return RedirectToAction("Details", new { id = psParam.Id });
        }


        //GET: PowerShell/Schedule/1
        public IActionResult Schedule(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) return NotFound();
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) { return RedirectToAction("Index"); }

            var scriptParams = _scriptIO.ScriptParams(script.Name) ??
                               new Dictionary<string, string>();

            var scheduleView = new PowerShellSchedule()
            {
                Id = script.Id,
                Date = DateTime.Now,
                Recurring = JobServices.RecurringOptions(),
                PSparams = scriptParams
            };

            return PartialView(scheduleView);
        }

        //POST: PowerShell/Schedule/1
        [HttpPost, ValidateAntiForgeryToken]
        public IActionResult Schedule(PowerShellSchedule schedule)
        {
            var jobServices = new JobServices(_scriptRepository, _scriptIO);
            var psMetadata = _scriptRepository.GetScriptById(schedule.Id);
            if (psMetadata == null) return NotFound();
            if (psMetadata.Category != null && !UserHasAccessToCategory(psMetadata.Category.Id)) { return RedirectToAction("Index"); }
            jobServices.Schedule(psMetadata, schedule, User.Identity.Name);
            return RedirectToAction("Details", new { id = schedule.Id });
        }

        //Get PowerShell/CancelJob/1
        public ActionResult CancelJob(int id)
        {
            var job = _scriptRepository.GetJobById(id);

            return PartialView(job);
        }

        // POST: PowerShell/Delete/5
        [HttpPost, ActionName("CancelJob")]
        [ValidateAntiForgeryToken]
        public ActionResult CancelJobConfirmed(Job job)
        {
            var jobServices = new JobServices(_scriptRepository, _scriptIO);
            //Get Recurring and Original Job Info
            var recurringJob = _scriptRepository.GetJobById(job.Id);
            BackgroundJob.Delete(recurringJob.JobId.ToString());

            if (recurringJob.JobType == JobType.Recurring)
            {
                var originalJob = _scriptRepository.GetJobById(recurringJob.RecurringId);
                BackgroundJob.Delete(originalJob.JobId.ToString());

                jobServices.UpdateJobStatus(recurringJob, Status.Cancelled);
            }

            RecurringJob.RemoveIfExists(recurringJob.RecurringId.ToString());
            jobServices.UpdateJobStatus(recurringJob, Status.Cancelled);

            return RedirectToAction("Details", new { id = recurringJob.ScriptId });
        }


        // GET: PowerShell/Delete/1
        [Authorize(Policy = "Author")]
        public ActionResult Delete(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null)
            {
                return RedirectToAction("Index");
            }
            if (script.Category != null && !UserHasAccessToCategory(script.Category.Id)) { return RedirectToAction("Index"); }
            return View(script);
        }

        // POST: PowerShell/Delete/1
        [Authorize(Policy = "Author")]
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public ActionResult DeleteConfirmed(int id)
        {
            var psMetadata = _scriptRepository.GetScriptById(id);
            if (psMetadata == null) return RedirectToAction("Index", "Home");
            if (psMetadata.Category != null && !UserHasAccessToCategory(psMetadata.Category.Id)) { return RedirectToAction("Index", "Home"); }

            // Cascade-cancel any non-terminal jobs for this script before removing it.
            // BackgroundJob.Delete drops queued/scheduled work; RecurringJob.RemoveIfExists
            // unschedules the cron entry. The Job rows flip to Cancelled so the audit log
            // keeps a record of what was killed by the delete.
            var jobServices = new JobServices(_scriptRepository, _scriptIO);
            var liveJobs = _scriptRepository.GetJobs()
                .Where(j => j.ScriptId == id
                            && j.Status != Status.Completed
                            && j.Status != Status.Failed
                            && j.Status != Status.Cancelled)
                .ToList();
            foreach (var job in liveJobs)
            {
                try { BackgroundJob.Delete(job.JobId.ToString()); } catch { /* already gone */ }
                if (job.JobType == JobType.Recurring || job.JobType == JobType.ScheduledWithRecurring)
                {
                    try { RecurringJob.RemoveIfExists(job.RecurringId.ToString()); } catch { /* already gone */ }
                }
                jobServices.UpdateJobStatus(job, Status.Cancelled);
            }

            if (_scriptIO.Delete(psMetadata.Name))
            {
                _scriptRepository.DeleteScript(id);
                _scriptRepository.Save();
            }

            return RedirectToAction("Index", "Home");
        }



        // TODO: I might move this into an API and sitch to Angular 2 for Front-End


        // JSON GET: /PowerShell/GetParams/1
        public IActionResult GetParams(int id)
        {
            var scriptName = _scriptRepository.GetScriptById(id).Name;
            if (scriptName == null) { return Json(NotFound()); }


            var psParams = _scriptIO.ScriptParams(scriptName) ??
                           new Dictionary<string, string> { { "Null", "Null" } };

            return Json(psParams);
        }

    }

    // TODO: Might be good to move ViewComponents

    public class Partials : ViewComponent
    {
        private IScriptRepository _scriptRepository;

        public Partials(IScriptRepository scriptRepository)
        {
            _scriptRepository = scriptRepository;
        }

        public IViewComponentResult Invoke(int id)
        {
            var jobs = _scriptRepository.GetJobs()
                 .OrderByDescending(e => e.Id)
                 .Where(e => e.ScriptId == id && e.JobType == JobType.Recurring && e.Status != Status.Cancelled);

            return View("RecurringJobs", jobs);
        }
    }
}
