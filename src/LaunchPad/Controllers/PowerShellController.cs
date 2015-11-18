using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using Hangfire;
using Microsoft.AspNet.Mvc;
using LaunchPad.DAL;
using LaunchPad.Models;
using LaunchPad.Services;
using LaunchPad.ViewModels;

// For more information on enabling MVC for empty projects, visit http://go.microsoft.com/fwlink/?LinkID=397860

namespace LaunchPad.Controllers
{
    public class PowerShellController : Controller
    {
        private IScriptRepository _scriptRepository;

        public PowerShellController(IScriptRepository scriptRepository)
        {
            _scriptRepository = scriptRepository;
        }

        // GET: /<controller>/
        public IActionResult Index()
        {
            return View(_scriptRepository.GetScripts());
        }

        // GET: /<controller>/Create
        public IActionResult Create()
        {
            return View();
        }

        // POST: /<controller>/Create
        [HttpPost] //TODO: Need to turn off ValidateInput
        [ValidateAntiForgeryToken]
        public ActionResult Create([Bind("Name,Script")] PowerShellViewModel newScript)
        {
            var script = ConvertServices.CreateScript(newScript, User.Identity.Name);

            if (ScriptIO.ScriptExists(newScript.Name)) //TODO: Ensure this works on ViewModel - Having Issues - 11/16/2015
            {
                ModelState.AddModelError("Name", "This Name Already Exists");
            }
            if (TryValidateModel(script))
            {
                //Write File and Save Metadata
                if (ScriptIO.Write(newScript.Name, newScript.Script))
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
        public ActionResult Edit(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) { return RedirectToAction("Index"); }

            var scriptContents = ScriptIO.Read(script.Name);

            var scriptView = new PowerShellViewModel()
            {
                Id = script.Id,
                Name = script.Name,
                Script = scriptContents
            };
            return View(scriptView);
        }

        // POST: PowerShell/Edit/5
        [HttpPost] //TODO: //Need to turn off ValidateInput
        [AllowAnonymous]
        [ValidateAntiForgeryToken]
        public ActionResult Edit(PowerShellViewModel vmScript)
        {
            //For now - only editning the file - will need to allow for renames
            if (ScriptIO.Write(vmScript.Name, vmScript.Script))
            {
                return RedirectToAction("Details", new { id = vmScript.Id });
            }
            return View(vmScript);
        }

        // GET: PowerShell/Details/1
        public ActionResult Details(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) { return RedirectToAction("Index"); }

            var scriptContents = ScriptIO.Read(script.Name);

            var scriptView = new PowerShellViewModel()
            {
                Id = script.Id,
                Name = script.Name,
                Script = scriptContents
            };
            return View(scriptView);
        }

        //Get PowerShell/JobDetails/1
        public ActionResult JobDetails(int id)
        {
            var job = _scriptRepository.GetJobById(id);

            return PartialView(job);
        }

        //Get PowerShell/JobHistory/1
        public ActionResult JobHistory(int? id, int history = 6)
        {
            if (id == null) { return PartialView(); }

            var jobs = _scriptRepository.GetJobs()
                        .OrderByDescending(e => e.Id)
                        .Take(history)
                        .Where(e => e.ScriptId == id && e.JobType != JobType.ScheduledWithRecurring && e.JobType != JobType.Recurring);

            return PartialView(jobs);
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
            var jobServices = new JobServices(_scriptRepository);
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
        public ActionResult Delete(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null)
            {
                return RedirectToAction("Index");
            }
            return View(script);
        }

        // POST: PowerShell/Delete/1
        [HttpPost, ActionName("Delete")]
        [ValidateAntiForgeryToken]
        public ActionResult DeleteConfirmed(int id)
        {
            var psMetadata = _scriptRepository.GetScriptById(id);

            if (ScriptIO.Delete(psMetadata.Name))
            {
                _scriptRepository.DeleteScript(id);
                _scriptRepository.Save();
            }

            return RedirectToAction("Index");
        }

        //Job ActionResults
        // GET: PowerShell/Run/1
        public ActionResult Run(int id)
        {
            var jobServices = new JobServices(_scriptRepository);
            var script = _scriptRepository.GetScriptById(id);
            jobServices.LaunchScript(User.Identity.Name, script);
            return RedirectToAction("Details", new { id });
        }

        // JSON GET: PowerShell/GetParams/1
        public JsonResult GetParams(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null)
            {
                return Json(HttpNotFound());
            }

            var psParams = ScriptIO.ScriptParams(script.Name) ??
                           new Dictionary<string, string> { { "Null", "Null" } };

            return Json(psParams);
        }

        //Get PowerShell/RunWithParams/1
        public ActionResult RunWithParams(int id)
        {
            var script = _scriptRepository.GetScriptById(id);

            if (script == null) return HttpNotFound();

            var scriptParams = ScriptIO.ScriptParams(script.Name);

            if (scriptParams == null) return HttpNotFound();

            var psParams = new PowerShellParam()
            {
                Id = id,
                PSparams = scriptParams
            };

            return PartialView(psParams);
        }

        //TryToPost
        [HttpPost]
        public ActionResult RunWithParams(PowerShellParam psParam)
        {
            var jobServices = new JobServices(_scriptRepository);
            jobServices.LaunchScriptWithParams(User.Identity.Name, psParam);
            return RedirectToAction("Details", new { id = psParam.Id });
        }


        //GET: PowerShell/Schedule/1
        public ActionResult Schedule(int id)
        {
            var script = _scriptRepository.GetScriptById(id);
            if (script == null) return HttpNotFound();

            var scriptParams = ScriptIO.ScriptParams(script.Name) ??
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
        public ActionResult Schedule(PowerShellSchedule schedule)
        {
            var jobServices = new JobServices(_scriptRepository);
            var psMetadata = _scriptRepository.GetScriptById(schedule.Id);
            if (psMetadata == null) return HttpNotFound();
            jobServices.Schedule(psMetadata, schedule, User.Identity.Name);
            return RedirectToAction("Details", new { id = schedule.Id });
        }


        protected override void Dispose(bool disposing)
        {
            _scriptRepository.Dispose();
            base.Dispose(disposing);
        }
    }

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
