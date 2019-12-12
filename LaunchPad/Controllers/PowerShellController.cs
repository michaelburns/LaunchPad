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
    public class PowerShellController : Controller
    {
        private IScriptRepository _scriptRepository;
        private IScriptIO _scriptIO;
        private IMapper _mapper;
        private readonly ApplicationDbContext _context;

        public PowerShellController(IScriptRepository scriptRepository, IScriptIO scriptIO, IMapper mapper, ApplicationDbContext context)
        {
            _scriptRepository = scriptRepository;
            _scriptIO = scriptIO;
            _mapper = mapper;
            _context = context;
        }

        // GET: /PowerShell
        public IActionResult Index()
        {
            var scripts = _scriptRepository.GetScripts();
            var categoryIds = GetUserCategoryIds();
            var authorizeScripts = scripts.Where(s => categoryIds.Contains(s.Category.Id));
            return View(authorizeScripts);
        }

        // GET: /PowerShell/Create
        [HttpGet]
        [Authorize(Policy = "Author")]
        public IActionResult Create()
        {
            ViewBag.Categories = new SelectList(_scriptRepository.GetCategories().ToList(), "Id", "Name");
            return View();
        }

        // POST: /PowerShell/Create
        [HttpPost, ValidateAntiForgeryToken]
        [Authorize(Policy = "Author")]
        public IActionResult Create(PowerShellViewModel newScript)
        {
            if (_scriptIO.ScriptExists(newScript.Name))
            {
                ModelState.AddModelError("Name", "This Name Already Exists");
                return View(); // TODO : Does newScript need to be passed to the view?
            }

            var script = _mapper.Map<PowerShellViewModel, Script>(newScript);
            script.Author = User.Identity.Name;

            if (TryValidateModel(script))
            {
                // Set the category
                script.Category = _scriptRepository.GetCategories().FirstOrDefault(c => c.Id == newScript.Category.Id);

                //Write File and Save Metadata
                if (_scriptIO.Write(newScript.Name, newScript.Script))
                {
                    //Save PowerShell Script
                    _scriptRepository.InsertScript(script);
                    _scriptRepository.Save();
                    //TODO: return RedirectToAction("Details", new { id = psScript.Id });
                    return RedirectToAction("Index");
                }
            }
            return View(newScript);
        }

        // GET: PowerShell/Edit/5
        [Authorize(Policy = "Author")]
        public ActionResult Edit(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) { return RedirectToAction("Index"); }
            if (!GetUserCategoryIds().Contains(script.Category.Id)) { return RedirectToAction("Index"); }

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
                    //Save PowerShell Script
                    _scriptRepository.UpdateScript(script);
                    _scriptRepository.Save();
                    //TODO: return RedirectToAction("Details", new { id = psScript.Id });
                    return RedirectToAction("Index");
                }
            }
            return View(vmScript);
        }


        // GET: /PowerShell/Details/1
        public IActionResult Details(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) { return RedirectToAction("Index"); }
            if (script.Category != null && !GetUserCategoryIds().Contains(script.Category.Id)) { return RedirectToAction("Index"); }

            var scriptView = _mapper.Map<Script, PowerShellViewModel>(script);
            scriptView.Script = _scriptIO.Read(script.Name);

            return View(scriptView);
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

        // Job ActionResults
        // GET: PowerShell/Run/1
        public IActionResult Run(int id)
        {
            var jobServices = new JobServices(_scriptRepository, _scriptIO); // TODO: This can't be right.
            var script = _scriptRepository.GetScriptById(id);
            if (script.Category != null && !GetUserCategoryIds().Contains(script.Category.Id)) { return RedirectToAction("Index"); }
            jobServices.LaunchScript(User.Identity.Name, script);
            return RedirectToAction("Details", new { id });
        }

        // GET: PowerShell/RunWithParams/1
        public IActionResult RunWithParams(int id)
        {
            var script = _scriptRepository.GetScriptById(id);

            if (script == null) return NotFound();
            if (script.Category != null && !GetUserCategoryIds().Contains(script.Category.Id)) { return RedirectToAction("Index"); }

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
        [HttpPost]
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
            if (script.Category != null && !GetUserCategoryIds().Contains(script.Category.Id)) { return RedirectToAction("Index"); }

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
        [HttpPost]
        public IActionResult Schedule(PowerShellSchedule schedule)
        {
            var jobServices = new JobServices(_scriptRepository, _scriptIO);
            var psMetadata = _scriptRepository.GetScriptById(schedule.Id);
            if (psMetadata == null) return NotFound();
            if (psMetadata.Category != null && !GetUserCategoryIds().Contains(psMetadata.Category.Id)) { return RedirectToAction("Index"); }
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
            if (script.Category != null && !GetUserCategoryIds().Contains(script.Category.Id)) { return RedirectToAction("Index"); }
            return View(script);
        }

        // POST: PowerShell/Delete/1
        [Authorize(Policy = "Author")]
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public ActionResult DeleteConfirmed(int id)
        {
            var psMetadata = _scriptRepository.GetScriptById(id);
            if (psMetadata.Category != null && !GetUserCategoryIds().Contains(psMetadata.Category.Id)) { return RedirectToAction("Index"); }

            if (_scriptIO.Delete(psMetadata.Name))
            {
                _scriptRepository.DeleteScript(id);
                _scriptRepository.Save();
            }

            return RedirectToAction("Index");
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

        private IEnumerable<int> GetUserCategoryIds()
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
