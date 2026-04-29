using System;
using System.Collections.Generic;
using System.Management.Automation;
using System.Management.Automation.Runspaces;
using System.Text;
using System.Threading;
using Hangfire;
using LaunchPad.Data;
using LaunchPad.Models;
using Job = LaunchPad.Models.Job;
using System.Linq;
using LaunchPad.ViewModels;
using Microsoft.AspNetCore.Mvc.Rendering;
using System.Diagnostics;
using Microsoft.EntityFrameworkCore;

namespace LaunchPad.Services
{

    // TODO: Move this to a separate interface class
    public interface IJobServices
    {
        [UpdateJobStatusFilter]
        [AutomaticRetry(Attempts = 0)]
        void Run(string name);

        [UpdateJobStatusFilter]
        [AutomaticRetry(Attempts = 0)]
        void Run(string name, Dictionary<string, string> psParams);

        void RunOnSchedule(int id, string name, string recurring, Dictionary<string, string> psParams, DateTime schedule);
        void SaveResults(string scriptName, IEnumerable<PSObject> results);
        void UpdateJob(string id, Status status, string outcome = null, string scriptName = null);
    }

    //TODO: Cleanup and  Implement Interface
    public class JobServices : IJobServices
    {

        private IScriptRepository _scriptRepository;
        private IScriptIO _scriptIO;

        public JobServices(IScriptRepository scriptRepository, IScriptIO scriptIO)
        {
            _scriptRepository = scriptRepository;
            _scriptIO = scriptIO;
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
                JobId = Int32.Parse(BackgroundJob.Enqueue<IJobServices>(x => x.Run(script.Name))),
                Status = Status.Started,
                Args = null
            };
            _scriptRepository.InsertJob(newJob);
            _scriptRepository.Save();

        }

        public void LaunchScriptWithParams(string name, PowerShellParam psParam)
        {
            //ToDo: Add Logic to Return True / False if successful
            var script = _scriptRepository.GetScriptById(psParam.Id);

            var newJob = new Job()
            {
                UserName = name,
                ScriptId = script.Id,
                Date = DateTime.Now,
                JobId = Int32.Parse(BackgroundJob.Enqueue<IJobServices>(x => x.Run(script.Name, psParam.PSparams))),
                Status = Status.Started,
                Args = SerializeArgs(psParam.PSparams)
            };

            _scriptRepository.InsertJob(newJob);
            _scriptRepository.Save();
        }

        // Serialize the params dictionary so the Details page can echo them back live.
        // Stored as a small JSON object on the Job row; null when there were no params.
        private static string SerializeArgs(System.Collections.Generic.Dictionary<string, string> psParams)
        {
            if (psParams == null || psParams.Count == 0) return null;
            return System.Text.Json.JsonSerializer.Serialize(psParams);
        }

        //Invoke Script
        [UpdateJobStatusFilter, AutomaticRetry(Attempts = 0)]
        public void Run(string name) => RunStreaming(name, null);

        [UpdateJobStatusFilter]
        [AutomaticRetry(Attempts = 0)]
        public void Run(string name, Dictionary<string, string> psParams) => RunStreaming(name, psParams);

        // Streaming PowerShell run. Drops Out-String so we capture raw PSObjects, then
        // emits a typed segment stream (text + table) into Job.Outcome as JSON. The
        // Details renderer reads the JSON and paints text segments as console lines and
        // table segments as inline tables. A separate poll checks the job status
        // (AsNoTracking, fresh from DB) so the controller's CancelRunningJob action can
        // stop the runspace cooperatively. Pre-feature outcomes (plain text) still
        // render correctly via the parse-fail fallback on the client.
        private void RunStreaming(string name, Dictionary<string, string> psParams)
        {
            var initial = InitialSessionState.CreateDefault();

            // ExecutionPolicy is only honored on Windows; setter throws on non-Windows.
            if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows))
            {
                initial.ExecutionPolicy = Microsoft.PowerShell.ExecutionPolicy.Bypass;
            }

            using var runspace = RunspaceFactory.CreateRunspace(initial);
            runspace.Open();

            using var ps = PowerShell.Create();
            ps.Runspace = runspace;

            var segments = new List<OutputSegment>();
            var segLock = new object();
            var lastFlush = DateTime.UtcNow.AddSeconds(-1);
            var dirty = false;
            int? jobIdCache = null;

            int? FindJobId()
            {
                if (jobIdCache.HasValue) return jobIdCache;
                var script = _scriptRepository.GetScripts().FirstOrDefault(s => s.Name == name);
                if (script == null) return null;
                var job = _scriptRepository.GetJobs()
                    .Where(j => j.ScriptId == script.Id && (j.Status == Status.Started || j.Status == Status.Running))
                    .OrderByDescending(j => j.Id)
                    .FirstOrDefault();
                if (job != null) jobIdCache = job.Id;
                return jobIdCache;
            }

            string Serialize()
            {
                lock (segLock)
                {
                    return System.Text.Json.JsonSerializer.Serialize(segments);
                }
            }

            void Flush(bool force = false)
            {
                string snapshot;
                lock (segLock)
                {
                    if (!dirty && !force) return;
                    snapshot = System.Text.Json.JsonSerializer.Serialize(segments);
                    dirty = false;
                }
                var id = FindJobId();
                if (!id.HasValue) return;
                var live = _scriptRepository.GetJobById(id.Value);
                if (live == null) return;
                live.Outcome = snapshot;
                _scriptRepository.UpdateJob(live);
                try { _scriptRepository.Save(); } catch { /* transient EF/SQLite contention; final flush will retry */ }
                lastFlush = DateTime.UtcNow;
            }

            // Append a text line. Coalesce into the trailing text segment if there is one,
            // otherwise start a new text segment.
            void AppendText(string s)
            {
                if (s == null) return;
                lock (segLock)
                {
                    var last = segments.Count > 0 ? segments[^1] : null;
                    if (last != null && last.T == "text")
                    {
                        last.V = (last.V ?? "") + (last.V?.Length > 0 ? "\n" : "") + s;
                    }
                    else
                    {
                        segments.Add(new OutputSegment { T = "text", V = s });
                    }
                    dirty = true;
                }
                if ((DateTime.UtcNow - lastFlush).TotalMilliseconds >= 250) Flush();
            }

            // Append a structured object as a table row. Coalesce into the trailing table
            // segment if the column shape matches; otherwise start a new table segment.
            void AppendObject(PSObject obj)
            {
                if (obj == null) return;

                // String-like, value-types, and property-less objects get text treatment.
                if (obj.BaseObject == null
                    || obj.BaseObject is string
                    || obj.BaseObject is System.ValueType
                    || obj.Properties == null)
                {
                    AppendText(obj.ToString());
                    return;
                }

                // Capture up to 32 properties — far enough to cover Get-Process and
                // similar wide objects without exploding row size on pathological cases.
                // The renderer caps the *visible* column count at 8 by default, with a
                // "+N more" reveal chip for the rest.
                var props = obj.Properties.Take(32).ToList();
                if (props.Count == 0)
                {
                    AppendText(obj.ToString());
                    return;
                }

                var cols = props.Select(p => p.Name).ToList();
                var row = props.Select(p => CoerceValue(p.Value)).ToList();

                lock (segLock)
                {
                    var last = segments.Count > 0 ? segments[^1] : null;
                    if (last != null && last.T == "table"
                        && last.Cols != null && last.Cols.SequenceEqual(cols))
                    {
                        last.Rows!.Add(row);
                    }
                    else
                    {
                        segments.Add(new OutputSegment
                        {
                            T = "table",
                            Cols = cols,
                            Rows = new List<List<object?>> { row }
                        });
                    }
                    dirty = true;
                }
                if ((DateTime.UtcNow - lastFlush).TotalMilliseconds >= 250) Flush();
            }

            // Coerce a property value to a JSON-friendly primitive. PSCustomObject
            // properties commonly arrive wrapped in a PSObject — unwrap to the
            // underlying CLR type before deciding the JSON shape so numbers stay
            // numeric (Phase 2 sort relies on this).
            static object? CoerceValue(object? v)
            {
                if (v is PSObject ps) v = ps.BaseObject;
                return v switch
                {
                    null => null,
                    bool b => b,
                    int i => i,
                    long l => l,
                    short sh => (int)sh,
                    byte by => (int)by,
                    double d => d,
                    float f => (double)f,
                    decimal dec => (double)dec,
                    string s => s,
                    System.DateTime dt => dt.ToString("o"),
                    System.Enum e => e.ToString(),
                    _ => v.ToString()
                };
            }

            // Subscribe to every PowerShell stream the operator might care about.
            ps.Streams.Information.DataAdded += (_, e) =>
                AppendText(ps.Streams.Information[e.Index]?.MessageData?.ToString() ?? "");
            ps.Streams.Verbose.DataAdded += (_, e) =>
                AppendText("VERBOSE: " + ps.Streams.Verbose[e.Index]?.Message);
            ps.Streams.Warning.DataAdded += (_, e) =>
                AppendText("WARNING: " + ps.Streams.Warning[e.Index]?.Message);
            ps.Streams.Error.DataAdded += (_, e) =>
                AppendText("ERROR: " + (ps.Streams.Error[e.Index]?.Exception?.Message ?? ps.Streams.Error[e.Index]?.ToString()));

            // Build the command chain. We deliberately do NOT add Out-String here —
            // we want the raw PSObjects so we can render them as tables. The
            // typed-segment renderer on the client falls back to text for non-tabular
            // shapes, so behaviour is graceful for every script.
            if (psParams != null && psParams.Count > 0)
            {
                var cmd = new Command(_scriptIO.FileLocation(name));
                foreach (var item in psParams)
                {
                    cmd.Parameters.Add(null, item.Value);
                }
                ps.Commands.AddCommand(cmd);
            }
            else
            {
                ps.AddScript(_scriptIO.Read(name));
            }

            var output = new PSDataCollection<PSObject>();
            output.DataAdded += (_, e) => AppendObject(output[e.Index]);

            var asyncResult = ps.BeginInvoke<PSObject, PSObject>(null, output);

            // Cooperative cancel + first-flush. Tick every 500ms while the script runs;
            // if the controller marks the job Cancelled, stop the runspace.
            try
            {
                while (!asyncResult.AsyncWaitHandle.WaitOne(500))
                {
                    var id = FindJobId();
                    if (id.HasValue && _scriptRepository.GetJobStatusFresh(id.Value) == Status.Cancelled)
                    {
                        ps.Stop();
                        break;
                    }
                    if (dirty) Flush();
                }
                ps.EndInvoke(asyncResult);
            }
            catch (PipelineStoppedException) { /* expected when ps.Stop() is called from cancel */ }

            Flush(force: true); // guaranteed final flush

            // Preserve the existing post-run contract: SaveResults writes Script.LastOutput,
            // which the UpdateJobStatusFilter then copies into Outcome on Completed. We
            // write the same JSON snapshot so the filter's overwrite is a no-op for
            // structured runs (and stays correct text for legacy code paths).
            var script2 = _scriptRepository.GetScripts().FirstOrDefault(s => s.Name == name);
            if (script2 != null)
            {
                script2.LastOutput = Serialize();
                _scriptRepository.UpdateScript(script2);
                try { _scriptRepository.Save(); } catch { /* swallow — flush already persisted Outcome */ }
            }

            runspace.Close();
        }

        public void RunOnSchedule(int id, string name, string recurring, Dictionary<string, string> psParams, DateTime schedule)
        {
            var recurringSwitch = new Dictionary<string, string>
            {
                {"Minutely", Cron.Minutely()},
                {"Hourly", Cron.Hourly(schedule.Minute)},
                {"Daily", Cron.Daily(schedule.Hour, schedule.Minute)},
                {"Weekly", Cron.Weekly(schedule.DayOfWeek, schedule.Hour, schedule.Minute)},
                {"Monthly", Cron.Monthly(schedule.Day, schedule.Hour, schedule.Minute)},
                {"Yearly", Cron.Yearly(schedule.Month, schedule.Day, schedule.Hour, schedule.Minute)}
            };

            RecurringJob.AddOrUpdate<IJobServices>(id.ToString(), x => x.Run(name, psParams), recurringSwitch[recurring], TimeZoneInfo.Local);
        }

        public void Schedule(Script script, PowerShellSchedule schedule, string username)
        {
            var job = new Job()
            {
                UserName = username,
                ScriptId = schedule.Id,
                Date = schedule.Date,
                JobId =
                    Int32.Parse(BackgroundJob.Schedule<IJobServices>(x => x.Run(script.Name, schedule.PSparams),
                        new DateTime(schedule.Date.Ticks))),
                Status = Status.Scheduled,
                JobType = JobType.Scheduled,
                Args = SerializeArgs(schedule.PSparams)
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
                            BackgroundJob.Schedule<IJobServices>(x => x.RunOnSchedule(job.Id, script.Name,
                                    schedule.SelectedRecurring, schedule.PSparams, schedule.Date),
                                new DateTime(schedule.Date.Ticks))),
                    RecurringId = job.Id,
                    Status = Status.Scheduled,
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

            if (Int32.TryParse(id, out int jobId))
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
                    Text = "Daily",
                    Value = "Daily"
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
    }
}