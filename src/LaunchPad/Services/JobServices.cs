using System;
using System.Collections.Generic;
using System.Management.Automation;
using System.Management.Automation.Runspaces;
using System.Text;
using Hangfire;
using LaunchPad.DAL;
using LaunchPad.Models;
using Job = LaunchPad.Models.Job;
using System.Linq;
using LaunchPad.ViewModels;
using Microsoft.AspNet.Mvc.Rendering;
using Microsoft.Data.Entity;
using Microsoft.Data.Entity.Infrastructure;

namespace LaunchPad.Services
{
    //TODO: Cleanup and  Implement Interface
    public class JobServices : IDisposable
    {

        private IScriptRepository _scriptRepository;

        public JobServices(IScriptRepository scriptRepository)
        {
            _scriptRepository = scriptRepository;
        }

        //Default Constructor for Hangfire:
        public JobServices()
        {
            _scriptRepository = new PowerShellRepository(new ApplicationDbContext());
        }



        //Laucnh/Schedule Jobs
        public void LaunchScript(string name, Script script)
        {
            //ToDo: Add Logic to Return True/False if successful
            var newJob = new Job()
            {
                UserName = name,
                ScriptId = script.Id,
                Date = DateTime.Now,
                JobId = Int32.Parse(BackgroundJob.Enqueue(() => Run(script.Name))),
                Status = Status.Started
            };
            _scriptRepository.InsertJob(newJob);
            _scriptRepository.Save();

        }

        public void LaunchScriptWithParams(string name, PowerShellParam psParam)
        {
            var jobServices = new JobServices(_scriptRepository);
            //ToDo: Add Logic to Return True / False if successful
            var script = _scriptRepository.GetScriptById(psParam.Id);

            var newJob = new Job()
            {
                UserName = name,
                ScriptId = script.Id,
                Date = DateTime.Now,
                JobId = Int32.Parse(BackgroundJob.Enqueue(() => jobServices.Run(script.Name, psParam.PSparams))),
                Status = Status.Started
            };

            _scriptRepository.InsertJob(newJob);
            _scriptRepository.Save();
        }

        //Invoke Script
        [UpdateJobStatusFilter]
        [AutomaticRetry(Attempts = 0)]
        public void Run(string name)
        {
            //Create Runspace
            var runspace = RunspaceFactory.CreateRunspace();
            runspace.Open();

            //Create Pipeline
            var pipeline = runspace.CreatePipeline();

            //Pass in the Scripts text
            pipeline.Commands.AddScript(ScriptIO.Read(name));
            pipeline.Commands.Add("Out-String");

            //Invoke and Save Results
            var results = pipeline.Invoke();
            SaveResults(name, results);
            runspace.Close();

        }

        //TODO: FOR TESTING WILL MERGE WITH RUN(name)!
        [UpdateJobStatusFilter]
        [AutomaticRetry(Attempts = 0)]
        public void Run(string name, Dictionary<string, string> psParams)
        {
            //Create Runspace
            Runspace runspace = RunspaceFactory.CreateRunspace();
            runspace.Open();

            //Create Pipeline
            Pipeline pipeline = runspace.CreatePipeline();

            //TODO: Testing - Please REMOVE!
            var command = new Command(ScriptIO.FileLocation(name));

            if (psParams != null)
            {
                //TODO: DoEs This Need Item Key or Will Params Run in Order?
                foreach (var item in psParams)
                {
                    command.Parameters.Add(null, item.Value);
                }
            }

            pipeline.Commands.Add(command);

            //Pass in the Scripts text
            //pipeline.Commands.AddScript(scriptContents); //Previous Way - would allow for script storage in DB
            pipeline.Commands.Add("Out-String");

            //Invoke and Save Results
            var results = pipeline.Invoke();
            SaveResults(name, results);

            runspace.Close();
        }

        public void RunOnSchedule(int id, string name, string recurring, Dictionary<string, string> psParams)
        {
            var recurringSwitch = new Dictionary<string, string>
            {
                {"Minutely", Cron.Minutely()},
                {"Hourly", Cron.Hourly()},
                {"Weekly", Cron.Weekly()},
                {"Monthly", Cron.Monthly()},
                {"Yearly", Cron.Yearly()}
            };

            RecurringJob.AddOrUpdate(id.ToString(), () => Run(name, psParams), recurringSwitch[recurring]);
        }

        public void Schedule(Script script, PowerShellSchedule schedule, string username)
        {
            var job = new Job()
            {
                UserName = username,
                ScriptId = schedule.Id,
                Date = schedule.Date,
                JobId =
                    Int32.Parse(BackgroundJob.Schedule(() => Run(script.Name, schedule.PSparams),
                        new DateTime(schedule.Date.Ticks))),
                Status = Status.Scheduled,
                JobType = JobType.Scheduled
            };

            _scriptRepository.InsertJob(job);
            _scriptRepository.Save();

            if (schedule.SelectedRecurring != null)
            {
                // Change Job Type and Set Recurring Job
                // This is important to ensure CancelJob cancels associated recurring jobs
                // TODO: Review Logic
                job.JobType = JobType.ScheduledWithRecurring;
                _scriptRepository.UpdateJob(job);
                var recurringJob = new Job()
                {
                    UserName = username,
                    ScriptId = script.Id,
                    Date = schedule.Date,
                    JobId =
                        Int32.Parse(
                            BackgroundJob.Schedule(
                                () => RunOnSchedule(job.Id, script.Name,
                                    schedule.SelectedRecurring, schedule.PSparams),
                                new DateTime(schedule.Date.Ticks))),
                    RecurringId = job.Id,
                    Status =  Status.Scheduled,
                    JobType = JobType.Recurring,
                    Outcome = schedule.SelectedRecurring
                };
                _scriptRepository.InsertJob(recurringJob);
                _scriptRepository.Save();
            }

        }

        public void SaveResults(string scriptName, IEnumerable<PSObject> results)
        {
            var stringBuilder = new StringBuilder();
            foreach (var obj in results)
            {
                stringBuilder.AppendLine(obj.ToString());
            }
            var output = stringBuilder.ToString();
            var script = _scriptRepository.GetScripts().FirstOrDefault(e => e.Name == scriptName);
            if (script != null)
            {
                script.LastOutput = output;
                _scriptRepository.UpdateScript(script);
                _scriptRepository.Save();
            }
        }

        public void UpdateJob(string id, Status status, string outcome = null, string scriptName = null)
        {
            int jobId;

            if (Int32.TryParse(id, out jobId))
            {
                var job = _scriptRepository.GetJobs().FirstOrDefault(e => e.JobId == jobId);

                if (job != null)
                {
                    if (status == Status.Completed)
                    {
                        var script = _scriptRepository.GetScriptById(job.ScriptId);
                        if (script != null)
                            outcome = script.LastOutput;
                    }
                    UpdateJobStatus(job, status, outcome);
                }

                //Scheduled Jobs Craeted Here:
                if (id != null && job == null) //Maybe just job==null
                {
                    var newJob = new Job()
                    {
                        UserName = "Job Schedule",
                        ScriptId = _scriptRepository.GetScripts().FirstOrDefault(e => e.Name == scriptName).Id, //TODO: What is script was deleted but still scheduled?
                        Date = DateTime.Now,
                        JobId = jobId,
                        Status = Status.Completed
                    };
                    _scriptRepository.InsertJob(newJob);
                    _scriptRepository.Save();
                }

            }
        }

        public void UpdateJobStatus(Job job, Status status, string outcome = null)
        {
            if (job.JobType == JobType.ScheduledWithRecurring)
            {
                job.JobType = JobType.Scheduled;
            }
            job.Status = status;

            if (!String.IsNullOrEmpty(outcome))
            {
                job.Outcome = outcome;
            }
            _scriptRepository.UpdateJob(job);
            _scriptRepository.Save();

        }


        //TODO: Move to DB and add to admin to enable/disable Scheduling options 
        public static IEnumerable<SelectListItem> RecurringOptions()
        {
            return new List<SelectListItem>()
            {
                new SelectListItem
                {
                    Text = "Every Minute",
                    Value = "Minutely"
                },
                new SelectListItem
                {
                    Text = "Hourly",
                    Value = "Hourly"
                },
                new SelectListItem
                {
                    Text = "Weekly",
                    Value = "Weekly"
                },
                new SelectListItem
                {
                    Text = "Monthly",
                    Value = "Monthly"
                },
                new SelectListItem
                {
                    Text = "Yearly",
                    Value = "Yearly"
                }
            };
        }


        public void Dispose()
        {
            _scriptRepository.Dispose();
        }
    }
}